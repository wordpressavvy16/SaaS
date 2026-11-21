#!/usr/bin/env python3
"""CRM API contract tests using FastAPI dependency overrides and SQLite is not required.

This module validates request/response models and route registration without external credentials.
"""

from backend.server import app, ContactInput, ContactUpdate


def test_contact_routes_registered():
    paths = {route.path for route in app.routes}
    assert "/api/crm/contacts" in paths
    assert "/api/crm/contacts/{contact_id}" in paths


def test_contact_input_validation():
    contact = ContactInput(first_name="Ada", last_name="Lovelace", lead_score=80, status="qualified")
    assert contact.first_name == "Ada"
    assert contact.lead_score == 80


def test_contact_update_lead_score_validation():
    update = ContactUpdate(lead_score=75, status="proposal")
    assert update.lead_score == 75
    assert update.status == "proposal"
