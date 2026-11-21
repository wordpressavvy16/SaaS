from __future__ import annotations

import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import BusinessRow, ContactRow, SessionLocal, UserRow, WorkflowRow, init_db

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be configured in the backend environment")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
app = FastAPI(title="Enterprise SaaS Platform", version="1.0.0")
api = APIRouter(prefix="/api")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BootstrapAdmin(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str = Field(min_length=12)
    bootstrap_token: str


class BusinessSignup(BaseModel):
    name: str
    description: str | None = None
    domain: str | None = None
    owner_email: EmailStr
    owner_name: str
    owner_username: str
    owner_password: str = Field(min_length=12)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ContactInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=80)
    company: str | None = Field(default=None, max_length=255)
    position: str | None = Field(default=None, max_length=255)
    source: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    lead_score: int = Field(default=0, ge=0, le=100)
    status: str = Field(default="new", min_length=1, max_length=40)


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=80)
    company: str | None = Field(default=None, max_length=255)
    position: str | None = Field(default=None, max_length=255)
    source: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    lead_score: int | None = Field(default=None, ge=0, le=100)
    status: str | None = Field(default=None, min_length=1, max_length=40)
    assigned_to: str | None = None


class WorkflowInput(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]] = Field(default_factory=list)


class BusinessUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    domain: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    settings: dict[str, Any] | None = None


async def get_db():
    async with SessionLocal() as session:
        yield session


def user_public(user: UserRow) -> dict[str, Any]:
    return {"id": user.id, "email": user.email, "username": user.username,
            "full_name": user.full_name, "role": user.role, "business_id": user.business_id,
            "is_active": user.is_active, "created_at": user.created_at,
            "updated_at": user.updated_at}


def business_public(business: BusinessRow | None) -> dict[str, Any] | None:
    if business is None:
        return None
    return {"id": business.id, "name": business.name, "description": business.description,
            "domain": business.domain, "logo_url": business.logo_url,
            "primary_color": business.primary_color, "secondary_color": business.secondary_color,
            "status": business.status, "owner_id": business.owner_id,
            "settings": business.settings or {}, "created_at": business.created_at,
            "approved_at": business.approved_at, "approved_by": business.approved_by}


def contact_public(contact: ContactRow) -> dict[str, Any]:
    return {column.name: getattr(contact, column.name) for column in ContactRow.__table__.columns}


def issue_token(user: UserRow) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user.id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


async def current_user(credentials: HTTPAuthorizationCredentials = Depends(security),
                       db: AsyncSession = Depends(get_db)) -> UserRow:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Could not validate credentials") from exc
    user = await db.get(UserRow, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    return user


def require_super_admin(user: UserRow = Depends(current_user)) -> UserRow:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


async def current_business(user: UserRow, db: AsyncSession) -> BusinessRow:
    if not user.business_id:
        raise HTTPException(status_code=404, detail="Business not found for this account")
    business = await db.get(BusinessRow, user.business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@api.post("/auth/bootstrap-super-admin", status_code=201)
async def bootstrap_super_admin(data: BootstrapAdmin, db: AsyncSession = Depends(get_db)):
    """One-time Super Admin setup. Requires SUPERADMIN_BOOTSTRAP_TOKEN in server env."""
    expected = os.environ.get("SUPERADMIN_BOOTSTRAP_TOKEN", "")
    if not expected or not hmac.compare_digest(data.bootstrap_token, expected):
        raise HTTPException(status_code=403, detail="Invalid or missing bootstrap token")
    count = await db.scalar(select(func.count()).select_from(UserRow).where(UserRow.role == "super_admin"))
    if count:
        raise HTTPException(status_code=409, detail="Super Admin setup has already been completed")
    user = UserRow(id=str(uuid.uuid4()), email=data.email.lower(), username=data.username,
                   full_name=data.full_name, role="super_admin", business_id=None,
                   hashed_password=pwd_context.hash(data.password), is_active=True)
    db.add(user)
    await db.commit()
    return {"message": "Super Admin account created. You can now sign in."}


@api.post("/auth/register-business", status_code=201)
async def register_business(data: BusinessSignup, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(UserRow).where(UserRow.email == data.owner_email.lower()))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    business = BusinessRow(name=data.name, description=data.description, domain=data.domain, status="pending")
    db.add(business)
    await db.flush()
    user = UserRow(email=data.owner_email.lower(), username=data.owner_username,
                   full_name=data.owner_name, role="business_admin", business_id=business.id,
                   hashed_password=pwd_context.hash(data.owner_password), is_active=False)
    db.add(user)
    await db.flush()
    business.owner_id = user.id
    await db.commit()
    return {"message": "Business registration submitted for approval", "business_id": business.id}


@api.post("/auth/login")
async def login(data: LoginInput, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(UserRow).where(UserRow.email == data.email.lower()))
    if not user or not pwd_context.verify(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive - awaiting business approval")
    business = await db.get(BusinessRow, user.business_id) if user.business_id else None
    return {"access_token": issue_token(user), "token_type": "bearer",
            "user": user_public(user), "business": business_public(business)}


@api.get("/auth/me")
async def who_am_i(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await db.get(BusinessRow, user.business_id) if user.business_id else None
    return {"user": user_public(user), "business": business_public(business)}


@api.get("/admin/businesses")
async def list_businesses(db: AsyncSession = Depends(get_db), _: UserRow = Depends(require_super_admin)):
    rows = (await db.scalars(select(BusinessRow).order_by(BusinessRow.created_at.desc()))).all()
    return [business_public(row) for row in rows]


@api.post("/admin/businesses/{business_id}/approve")
async def approve_business(business_id: str, db: AsyncSession = Depends(get_db), admin: UserRow = Depends(require_super_admin)):
    business = await db.get(BusinessRow, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    business.status = "approved"
    business.approved_at = datetime.now(timezone.utc)
    business.approved_by = admin.id
    owner = await db.scalar(select(UserRow).where(UserRow.business_id == business_id, UserRow.role == "business_admin"))
    if owner:
        owner.is_active = True
    await db.commit()
    return {"message": "Business approved successfully"}


@api.post("/admin/businesses/{business_id}/reject")
async def reject_business(business_id: str, db: AsyncSession = Depends(get_db), _: UserRow = Depends(require_super_admin)):
    business = await db.get(BusinessRow, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    business.status = "rejected"
    await db.commit()
    return {"message": "Business rejected"}


@api.get("/business/profile")
async def get_business_profile(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return business_public(await current_business(user, db))


@api.put("/business/profile")
async def update_business_profile(data: BusinessUpdate, user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if user.role != "business_admin":
        raise HTTPException(status_code=403, detail="Business Admin access required")
    business = await current_business(user, db)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(business, key, value)
    await db.commit()
    await db.refresh(business)
    return business_public(business)


@api.post("/crm/contacts", status_code=201)
async def create_contact(data: ContactInput, user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    contact = ContactRow(business_id=business.id, created_by=user.id, **data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact_public(contact)


@api.get("/crm/contacts")
async def get_contacts(
    q: str | None = Query(default=None, max_length=200),
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    """List this tenant's contacts; supports text search, status/source filters and pagination."""
    business = await current_business(user, db)
    stmt = select(ContactRow).where(ContactRow.business_id == business.id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(or_(ContactRow.first_name.ilike(term), ContactRow.last_name.ilike(term),
                              ContactRow.email.ilike(term), ContactRow.company.ilike(term),
                              ContactRow.phone.ilike(term)))
    if status_filter:
        stmt = stmt.where(ContactRow.status == status_filter)
    if source:
        stmt = stmt.where(ContactRow.source.ilike(source.strip()))
    stmt = stmt.order_by(ContactRow.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.scalars(stmt)).all()
    return [contact_public(row) for row in rows]


@api.put("/crm/contacts/{contact_id}")
@api.patch("/crm/contacts/{contact_id}")
async def update_contact(contact_id: str, data: ContactUpdate,
                         user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    contact = await db.scalar(select(ContactRow).where(
        ContactRow.id == contact_id, ContactRow.business_id == business.id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    await db.commit()
    await db.refresh(contact)
    return contact_public(contact)


@api.delete("/crm/contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: str, user: UserRow = Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    contact = await db.scalar(select(ContactRow).where(
        ContactRow.id == contact_id, ContactRow.business_id == business.id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
    return Response(status_code=204)


@api.post("/ai/workflows", status_code=201)
async def create_workflow(data: WorkflowInput, user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    row = WorkflowRow(business_id=business.id, created_by=user.id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {column.name: getattr(row, column.name) for column in WorkflowRow.__table__.columns}


@api.get("/ai/workflows")
async def get_workflows(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    rows = (await db.scalars(select(WorkflowRow).where(WorkflowRow.business_id == business.id))).all()
    return [{column.name: getattr(row, column.name) for column in WorkflowRow.__table__.columns} for row in rows]


@api.get("/analytics/dashboard")
async def analytics(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
    business = await current_business(user, db)
    contacts = await db.scalar(select(func.count()).select_from(ContactRow).where(ContactRow.business_id == business.id))
    workflows = await db.scalar(select(func.count()).select_from(WorkflowRow).where(WorkflowRow.business_id == business.id))
    active = await db.scalar(select(func.count()).select_from(WorkflowRow).where(
        WorkflowRow.business_id == business.id, WorkflowRow.is_active.is_(True)))
    return {"total_contacts": contacts, "total_workflows": workflows, "active_workflows": active,
            "business_status": business.status, "business_name": business.name}


@api.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(select(1))
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}


@app.on_event("startup")
async def startup():
    await init_db()
    # Optional deterministic demo tenant/data; enable with SEED_DEMO_DATA=true.
    if os.environ.get("SEED_DEMO_DATA", "false").lower() == "true":
        async with SessionLocal() as db:
            demo = await db.scalar(select(BusinessRow).where(BusinessRow.domain == "demo.example"))
            if not demo:
                demo = BusinessRow(name="Demo Workspace", domain="demo.example", status="approved")
                db.add(demo)
                await db.flush()
                admin = await db.scalar(select(UserRow).where(UserRow.email == "demo-admin@example.test"))
                if not admin:
                    admin = UserRow(email="demo-admin@example.test", username="demo-admin", full_name="Demo Admin",
                                    role="business_admin", business_id=demo.id,
                                    hashed_password=pwd_context.hash(str(uuid.uuid4())), is_active=False)
                    db.add(admin)
                    await db.flush()
                    demo.owner_id = admin.id
                for first, last, company in [("Alex", "Morgan", "Northwind"), ("Jamie", "Lee", "Contoso"),
                                             ("Taylor", "Reed", "Fabrikam")]:
                    db.add(ContactRow(business_id=demo.id, created_by=admin.id, first_name=first, last_name=last,
                                      company=company, status="new", tags=["demo"], custom_fields={}))
                await db.commit()


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
