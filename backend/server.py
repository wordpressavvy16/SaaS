from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import logging
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="Enterprise SaaS Platform", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    BUSINESS_ADMIN = "business_admin"
    HR_MANAGER = "hr_manager"
    SALES_MANAGER = "sales_manager"
    SALES_EXECUTIVE = "sales_executive"

class BusinessStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"

class AIProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    full_name: str
    role: UserRole
    business_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role: UserRole
    business_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Business(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str = "#3B82F6"
    secondary_color: str = "#1E40AF"
    status: BusinessStatus = BusinessStatus.PENDING
    owner_id: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None

class BusinessCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    owner_email: EmailStr
    owner_name: str
    owner_username: str
    owner_password: str

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    source: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    lead_score: int = 0
    status: str = "new"
    assigned_to: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    source: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)

class AIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    name: str
    description: Optional[str] = None
    trigger_type: str  # "manual", "schedule", "webhook", "event"
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_run_at: Optional[datetime] = None

class AIWorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    actions: List[Dict[str, Any]] = Field(default_factory=list)

class AIChat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    session_id: str
    user_id: str
    provider: AIProvider
    model: str
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AIChatMessage(BaseModel):
    session_id: str
    message: str
    provider: Optional[AIProvider] = AIProvider.OPENAI
    model: Optional[str] = "gpt-4o"

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User
    business: Optional[Business] = None

# Utility Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_current_business(current_user: User = Depends(get_current_user)):
    if not current_user.business_id:
        return None
    business = await db.businesses.find_one({"id": current_user.business_id})
    return Business(**business) if business else None

def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

# Authentication Routes
@api_router.post("/auth/register-business", response_model=dict)
async def register_business(business_data: BusinessCreate):
    """Register a new business - requires Super Admin approval"""
    # Check if email already exists
    existing_user = await db.users.find_one({"email": business_data.owner_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create business
    business = Business(
        name=business_data.name,
        description=business_data.description,
        domain=business_data.domain,
        status=BusinessStatus.PENDING
    )
    await db.businesses.insert_one(business.dict())
    
    # Create business admin user
    hashed_password = get_password_hash(business_data.owner_password)
    user = User(
        email=business_data.owner_email,
        username=business_data.owner_username,
        full_name=business_data.owner_name,
        role=UserRole.BUSINESS_ADMIN,
        business_id=business.id,
        is_active=False  # Inactive until business is approved
    )
    user_dict = user.dict()
    user_dict["hashed_password"] = hashed_password
    await db.users.insert_one(user_dict)
    
    # Update business with owner ID
    await db.businesses.update_one(
        {"id": business.id},
        {"$set": {"owner_id": user.id}}
    )
    
    return {"message": "Business registration submitted for approval", "business_id": business.id}

@api_router.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive - awaiting business approval"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    business = None
    if user_obj.business_id:
        business_doc = await db.businesses.find_one({"id": user_obj.business_id})
        if business_doc:
            business = Business(**business_doc)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj,
        "business": business
    }

# Super Admin Routes
@api_router.get("/admin/businesses", response_model=List[Business])
async def get_all_businesses(
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    businesses = await db.businesses.find().to_list(1000)
    return [Business(**business) for business in businesses]

@api_router.post("/admin/businesses/{business_id}/approve")
async def approve_business(
    business_id: str,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Update business status
    await db.businesses.update_one(
        {"id": business_id},
        {
            "$set": {
                "status": BusinessStatus.APPROVED.value,
                "approved_at": datetime.utcnow(),
                "approved_by": current_user.id
            }
        }
    )
    
    # Activate business admin user
    await db.users.update_one(
        {"business_id": business_id, "role": UserRole.BUSINESS_ADMIN.value},
        {"$set": {"is_active": True}}
    )
    
    return {"message": "Business approved successfully"}

@api_router.post("/admin/businesses/{business_id}/reject")
async def reject_business(
    business_id: str,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"status": BusinessStatus.REJECTED.value}}
    )
    return {"message": "Business rejected"}

# Business Management Routes
@api_router.get("/business/profile", response_model=Business)
async def get_business_profile(
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    return current_business

@api_router.put("/business/profile", response_model=Business)
async def update_business_profile(
    updates: BusinessUpdate,
    current_user: User = Depends(require_role([UserRole.BUSINESS_ADMIN])),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    if update_data:
        await db.businesses.update_one(
            {"id": current_business.id},
            {"$set": update_data}
        )
    
    updated_business = await db.businesses.find_one({"id": current_business.id})
    return Business(**updated_business)

# CRM Routes
@api_router.post("/crm/contacts", response_model=Contact)
async def create_contact(
    contact_data: ContactCreate,
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    contact = Contact(
        **contact_data.dict(),
        business_id=current_business.id,
        created_by=current_user.id
    )
    await db.contacts.insert_one(contact.dict())
    return contact

@api_router.get("/crm/contacts", response_model=List[Contact])
async def get_contacts(
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    contacts = await db.contacts.find({"business_id": current_business.id}).to_list(1000)
    return [Contact(**contact) for contact in contacts]

# AI Integration Routes
@api_router.post("/ai/chat", response_model=dict)
async def ai_chat(
    chat_data: AIChatMessage,
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    """AI Chat endpoint - requires API keys to be configured"""
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if API keys are configured
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    
    if not openai_key and not anthropic_key:
        return {
            "error": "AI services not configured",
            "message": "Please add OPENAI_API_KEY or ANTHROPIC_API_KEY to environment variables"
        }
    
    # For now, return a placeholder response
    # When API keys are available, this will integrate with the AI service
    return {
        "response": "AI integration ready - please configure API keys in environment variables",
        "session_id": chat_data.session_id,
        "provider": chat_data.provider,
        "model": chat_data.model
    }

@api_router.post("/ai/workflows", response_model=AIWorkflow)
async def create_workflow(
    workflow_data: AIWorkflowCreate,
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    workflow = AIWorkflow(
        **workflow_data.dict(),
        business_id=current_business.id,
        created_by=current_user.id
    )
    await db.workflows.insert_one(workflow.dict())
    return workflow

@api_router.get("/ai/workflows", response_model=List[AIWorkflow])
async def get_workflows(
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    workflows = await db.workflows.find({"business_id": current_business.id}).to_list(1000)
    return [AIWorkflow(**workflow) for workflow in workflows]

# Analytics Routes
@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    current_business: Business = Depends(get_current_business)
):
    if not current_business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get business metrics
    total_contacts = await db.contacts.count_documents({"business_id": current_business.id})
    total_workflows = await db.workflows.count_documents({"business_id": current_business.id})
    active_workflows = await db.workflows.count_documents({
        "business_id": current_business.id,
        "is_active": True
    })
    
    return {
        "total_contacts": total_contacts,
        "total_workflows": total_workflows,
        "active_workflows": active_workflows,
        "business_status": current_business.status,
        "business_name": current_business.name
    }

# Health Check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Initialize Super Admin
async def create_super_admin():
    """Create initial super admin user"""
    super_admin_email = "superadmin@platform.com"
    existing_admin = await db.users.find_one({"email": super_admin_email})
    
    if not existing_admin:
        hashed_password = get_password_hash("SuperAdmin@123")
        super_admin = User(
            email=super_admin_email,
            username="superadmin",
            full_name="Super Administrator",
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        super_admin_dict = super_admin.dict()
        super_admin_dict["hashed_password"] = hashed_password
        await db.users.insert_one(super_admin_dict)
        print("Super Admin created: superadmin@platform.com / SuperAdmin@123")

@app.on_event("startup")
async def startup_event():
    await create_super_admin()

# Include the router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()