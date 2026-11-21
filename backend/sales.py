from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import ContactRow, DealRow, PipelineStageRow, UserRow

DEFAULT_STAGES = [
    ("Qualification", 0, 10, False, False),
    ("Discovery", 1, 25, False, False),
    ("Proposal", 2, 50, False, False),
    ("Negotiation", 3, 75, False, False),
    ("Won", 4, 100, True, False),
    ("Lost", 5, 0, False, True),
]


class StageInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    position: int = Field(default=0, ge=0)
    probability: int = Field(default=0, ge=0, le=100)
    is_won: bool = False
    is_lost: bool = False


class StageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    position: int | None = Field(default=None, ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    is_won: bool | None = None
    is_lost: bool | None = None


class DealInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    stage_id: str
    contact_id: str | None = None
    owner_id: str | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None


class DealUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    stage_id: str | None = None
    contact_id: str | None = None
    owner_id: str | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None


def stage_json(stage: PipelineStageRow) -> dict[str, Any]:
    return {"id": stage.id, "name": stage.name, "position": stage.position,
            "probability": stage.probability, "is_won": stage.is_won,
            "is_lost": stage.is_lost, "created_at": stage.created_at}


def deal_json(deal: DealRow, stage: PipelineStageRow | None = None,
              contact: ContactRow | None = None, owner: UserRow | None = None) -> dict[str, Any]:
    return {
        "id": deal.id, "title": deal.title, "description": deal.description,
        "amount": float(deal.amount), "probability": deal.probability,
        "stage_id": deal.stage_id, "stage_name": stage.name if stage else None,
        "stage_is_won": stage.is_won if stage else False,
        "stage_is_lost": stage.is_lost if stage else False,
        "contact_id": deal.contact_id,
        "contact_name": f"{contact.first_name} {contact.last_name}" if contact else None,
        "owner_id": deal.owner_id, "owner_name": owner.full_name if owner else None,
        "expected_close_date": deal.expected_close_date,
        "created_at": deal.created_at, "updated_at": deal.updated_at,
    }


def build_sales_router(get_db: Callable, current_user: Callable,
                       current_business: Callable) -> APIRouter:
    router = APIRouter(prefix="/sales", tags=["Sales"])

    async def ensure_default_stages(db: AsyncSession, business_id: str) -> list[PipelineStageRow]:
        stages = (await db.scalars(select(PipelineStageRow).where(
            PipelineStageRow.business_id == business_id).order_by(PipelineStageRow.position))).all()
        if stages:
            return list(stages)
        for name, position, probability, won, lost in DEFAULT_STAGES:
            db.add(PipelineStageRow(business_id=business_id, name=name, position=position,
                                    probability=probability, is_won=won, is_lost=lost))
        await db.flush()
        return list((await db.scalars(select(PipelineStageRow).where(
            PipelineStageRow.business_id == business_id).order_by(PipelineStageRow.position))).all())

    async def owned_stage(db: AsyncSession, stage_id: str, business_id: str) -> PipelineStageRow:
        stage = await db.scalar(select(PipelineStageRow).where(
            PipelineStageRow.id == stage_id, PipelineStageRow.business_id == business_id))
        if not stage:
            raise HTTPException(status_code=404, detail="Pipeline stage not found")
        return stage

    async def validate_related(db: AsyncSession, business_id: str,
                               contact_id: str | None, owner_id: str | None) -> None:
        if contact_id is not None:
            contact = await db.scalar(select(ContactRow).where(
                ContactRow.id == contact_id, ContactRow.business_id == business_id))
            if not contact:
                raise HTTPException(status_code=400, detail="Contact must belong to this business")
        if owner_id is not None:
            owner = await db.scalar(select(UserRow).where(
                UserRow.id == owner_id, UserRow.business_id == business_id, UserRow.is_active.is_(True)))
            if not owner:
                raise HTTPException(status_code=400, detail="Deal owner must be an active user in this business")

    @router.get("/team")
    async def sales_team(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        members = (await db.scalars(select(UserRow).where(
            UserRow.business_id == business.id, UserRow.is_active.is_(True)).order_by(UserRow.full_name))).all()
        return [{"id": member.id, "full_name": member.full_name, "email": member.email,
                 "role": member.role} for member in members]

    @router.get("/stages")
    async def list_stages(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        stages = await ensure_default_stages(db, business.id)
        await db.commit()
        return [stage_json(stage) for stage in stages]

    @router.post("/stages", status_code=201)
    async def create_stage(data: StageInput, user: UserRow = Depends(current_user),
                           db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        duplicate = await db.scalar(select(PipelineStageRow).where(
            PipelineStageRow.business_id == business.id,
            func.lower(PipelineStageRow.name) == data.name.strip().lower()))
        if duplicate:
            raise HTTPException(status_code=409, detail="A stage with this name already exists")
        stage = PipelineStageRow(business_id=business.id, name=data.name.strip(), **data.model_dump(exclude={"name"}))
        db.add(stage)
        await db.commit()
        await db.refresh(stage)
        return stage_json(stage)

    @router.patch("/stages/{stage_id}")
    async def update_stage(stage_id: str, data: StageUpdate,
                           user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        stage = await owned_stage(db, stage_id, business.id)
        updates = data.model_dump(exclude_unset=True)
        if "name" in updates:
            updates["name"] = updates["name"].strip()
            duplicate = await db.scalar(select(PipelineStageRow).where(
                PipelineStageRow.business_id == business.id,
                func.lower(PipelineStageRow.name) == updates["name"].lower(),
                PipelineStageRow.id != stage.id))
            if duplicate:
                raise HTTPException(status_code=409, detail="A stage with this name already exists")
        for key, value in updates.items():
            setattr(stage, key, value)
        if "probability" in updates:
            await db.execute(
                DealRow.__table__.update().where(DealRow.stage_id == stage.id,
                                                DealRow.business_id == business.id)
                .values(probability=updates["probability"]))
        await db.commit()
        await db.refresh(stage)
        return stage_json(stage)

    @router.delete("/stages/{stage_id}", status_code=204)
    async def delete_stage(stage_id: str, user: UserRow = Depends(current_user),
                           db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        stage = await owned_stage(db, stage_id, business.id)
        deal_count = await db.scalar(select(func.count()).select_from(DealRow).where(
            DealRow.business_id == business.id, DealRow.stage_id == stage.id))
        if deal_count:
            raise HTTPException(status_code=409, detail="Move or delete deals in this stage before removing it")
        await db.delete(stage)
        await db.commit()
        return Response(status_code=204)

    @router.get("/deals")
    async def list_deals(
        q: str | None = Query(default=None, max_length=200),
        stage_id: str | None = None,
        owner_id: str | None = None,
        limit: int = Query(default=100, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db),
    ):
        business = await current_business(user, db)
        stmt = select(DealRow, PipelineStageRow, ContactRow, UserRow).join(
            PipelineStageRow, DealRow.stage_id == PipelineStageRow.id).outerjoin(
            ContactRow, DealRow.contact_id == ContactRow.id).outerjoin(
            UserRow, DealRow.owner_id == UserRow.id).where(DealRow.business_id == business.id)
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(or_(DealRow.title.ilike(term), DealRow.description.ilike(term),
                                  ContactRow.first_name.ilike(term), ContactRow.last_name.ilike(term),
                                  ContactRow.company.ilike(term)))
        if stage_id:
            stmt = stmt.where(DealRow.stage_id == stage_id)
        if owner_id:
            stmt = stmt.where(DealRow.owner_id == owner_id)
        stmt = stmt.order_by(DealRow.updated_at.desc(), DealRow.created_at.desc()).offset(offset).limit(limit)
        results = (await db.execute(stmt)).all()
        return [deal_json(deal, stage, contact, owner) for deal, stage, contact, owner in results]

    @router.post("/deals", status_code=201)
    async def create_deal(data: DealInput, user: UserRow = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        stage = await owned_stage(db, data.stage_id, business.id)
        owner_id = data.owner_id or user.id
        await validate_related(db, business.id, data.contact_id, owner_id)
        deal = DealRow(business_id=business.id, created_by=user.id, title=data.title.strip(),
                       description=data.description, amount=data.amount, stage_id=stage.id,
                       contact_id=data.contact_id, owner_id=owner_id,
                       probability=data.probability if data.probability is not None else stage.probability,
                       expected_close_date=datetime.combine(data.expected_close_date, time.min, tzinfo=timezone.utc)
                       if data.expected_close_date else None)
        db.add(deal)
        await db.commit()
        await db.refresh(deal)
        contact = await db.get(ContactRow, deal.contact_id) if deal.contact_id else None
        owner = await db.get(UserRow, deal.owner_id) if deal.owner_id else None
        return deal_json(deal, stage, contact, owner)

    @router.patch("/deals/{deal_id}")
    @router.put("/deals/{deal_id}")
    async def update_deal(deal_id: str, data: DealUpdate,
                          user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        deal = await db.scalar(select(DealRow).where(
            DealRow.id == deal_id, DealRow.business_id == business.id))
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        updates = data.model_dump(exclude_unset=True)
        if "stage_id" in updates:
            stage = await owned_stage(db, updates["stage_id"], business.id)
            if "probability" not in updates:
                updates["probability"] = stage.probability
        else:
            stage = await owned_stage(db, deal.stage_id, business.id)
        contact_id = updates.get("contact_id", deal.contact_id)
        owner_id = updates.get("owner_id", deal.owner_id)
        await validate_related(db, business.id, contact_id, owner_id)
        if "expected_close_date" in updates:
            close_date = updates["expected_close_date"]
            updates["expected_close_date"] = datetime.combine(close_date, time.min, tzinfo=timezone.utc) if close_date else None
        if "title" in updates:
            updates["title"] = updates["title"].strip()
        for key, value in updates.items():
            setattr(deal, key, value)
        await db.commit()
        await db.refresh(deal)
        contact = await db.get(ContactRow, deal.contact_id) if deal.contact_id else None
        owner = await db.get(UserRow, deal.owner_id) if deal.owner_id else None
        return deal_json(deal, stage, contact, owner)

    @router.delete("/deals/{deal_id}", status_code=204)
    async def delete_deal(deal_id: str, user: UserRow = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        deal = await db.scalar(select(DealRow).where(
            DealRow.id == deal_id, DealRow.business_id == business.id))
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        await db.delete(deal)
        await db.commit()
        return Response(status_code=204)

    @router.get("/forecast")
    async def sales_forecast(user: UserRow = Depends(current_user), db: AsyncSession = Depends(get_db)):
        business = await current_business(user, db)
        stages = await ensure_default_stages(db, business.id)
        await db.commit()
        results = (await db.execute(select(DealRow, PipelineStageRow).join(
            PipelineStageRow, DealRow.stage_id == PipelineStageRow.id).where(
            DealRow.business_id == business.id))).all()
        by_stage = []
        pipeline_total = Decimal("0")
        weighted_total = Decimal("0")
        won_total = Decimal("0")
        open_count = 0
        for stage in stages:
            stage_deals = [(deal, row_stage) for deal, row_stage in results if row_stage.id == stage.id]
            amount = sum((Decimal(str(deal.amount)) for deal, _ in stage_deals), Decimal("0"))
            weighted = sum((Decimal(str(deal.amount)) * Decimal(deal.probability) / 100
                            for deal, _ in stage_deals), Decimal("0"))
            by_stage.append({"stage_id": stage.id, "stage_name": stage.name, "probability": stage.probability,
                            "count": len(stage_deals), "amount": float(amount),
                            "weighted_amount": float(weighted)})
            for deal, _ in stage_deals:
                if stage.is_won:
                    won_total += Decimal(str(deal.amount))
                elif not stage.is_lost:
                    pipeline_total += Decimal(str(deal.amount))
                    weighted_total += Decimal(str(deal.amount)) * Decimal(deal.probability) / 100
                    open_count += 1
        return {"open_deals": open_count, "pipeline_total": float(pipeline_total),
                "weighted_forecast": float(weighted_total), "won_total": float(won_total),
                "by_stage": by_stage}

    return router
