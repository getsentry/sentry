"""Check Seer's action request payloads, copied from Seer's contract fixtures, against Sentry."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from sentry.investigations.contracts import (
    ActionRequestedPayloadSerializer,
    ActionWithdrawnPayloadSerializer,
    RerunUpdatedPayloadSerializer,
    valid_action_requests,
)
from sentry.investigations.models import InvestigationActionRequest
from sentry.investigations.services.action_requests import (
    sync_snapshot_action_requests,
    upsert_action_request,
    withdraw_action_request,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json

FIXTURES = Path(__file__).parent / "fixtures" / "seer_contract"


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / f"{name}.json").read_text())


ACTION_REQUESTED = sorted(path.stem for path in FIXTURES.glob("action_requested_*.json"))
RERUN_REJECTION_CODES = (
    "run_cancelled",
    "run_failed",
    "provider_not_connected",
    "provider_already_used",
)
RERUN_FIXTURES = [
    "command_rerun_after_connection",
    "rerun_after_connection_started",
    "rerun_after_connection_held",
    *(f"rejected_rerun_after_connection_{code}" for code in RERUN_REJECTION_CODES),
    "duplicate_rerun_after_connection_started",
    "duplicate_rerun_after_connection_skipped",
]
RERUN_UPDATED = sorted(path.stem for path in FIXTURES.glob("rerun_updated_*.json"))


def test_every_fixture_is_covered() -> None:
    assert {path.stem for path in FIXTURES.glob("*.json")} == {
        *ACTION_REQUESTED,
        "action_withdrawn",
        "state_snapshot_action_requests",
        "command_record_action_outcome",
        "rejected_record_action_outcome",
        "command_recheck_action_requests",
        "rejected_recheck_action_requests",
        *RERUN_FIXTURES,
        *RERUN_UPDATED,
    }


@pytest.mark.parametrize("name", ACTION_REQUESTED)
def test_action_requested_payloads_are_kept_whole(name: str) -> None:
    payload = fixture(name)
    validator = ActionRequestedPayloadSerializer(data=payload)

    assert validator.is_valid(), validator.errors
    assert validator.validated_data["request"] == payload["request"]


def test_action_withdrawn_payload_is_valid() -> None:
    payload = fixture("action_withdrawn")
    validator = ActionWithdrawnPayloadSerializer(data=payload)

    assert validator.is_valid(), validator.errors
    assert dict(validator.validated_data) == payload


@pytest.mark.parametrize("name", RERUN_UPDATED)
def test_rerun_updated_payloads_are_valid(name: str) -> None:
    payload = fixture(name)
    validator = RerunUpdatedPayloadSerializer(data=payload)

    assert validator.is_valid(), validator.errors
    validated = validator.validated_data
    assert {**validated, "requestId": str(validated["requestId"])} == payload


def test_snapshot_action_requests_are_kept_whole() -> None:
    items = fixture("state_snapshot_action_requests")

    assert valid_action_requests(items) == items


class SeerContractRowsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation
        )

    def row(self, key: str) -> InvestigationActionRequest:
        return InvestigationActionRequest.objects.get(investigation=self.investigation, key=key)

    def test_action_requested_payloads_become_rows(self) -> None:
        for name in ACTION_REQUESTED:
            request = fixture(name)["request"]
            row = upsert_action_request(self.orchestration_run, request)

            anchor = request["anchor"]
            assert (row.key, row.report_revision, row.primary) == (
                request["key"],
                request["reportRevision"],
                request["primary"],
            ), name
            assert (row.anchor_type, row.anchor_id) == (
                (anchor["type"], anchor["id"]) if anchor else (None, None)
            ), name
            assert row.action_payload == request["action"], name
            assert row.action_kind == (request["action"] or {}).get("kind"), name
            assert row.state == "suggested", name

    def test_a_withdrawal_withdraws_the_row(self) -> None:
        upsert_action_request(
            self.orchestration_run, fixture("action_requested_advice_only")["request"]
        )
        withdrawn = fixture("action_withdrawn")

        assert withdraw_action_request(
            self.orchestration_run, withdrawn["key"], withdrawn["reason"]
        )

        row = self.row(withdrawn["key"])
        assert (row.state, row.reason) == ("withdrawn", withdrawn["reason"])

    def test_a_snapshot_keeps_its_requests_and_drops_the_rest(self) -> None:
        upsert_action_request(
            self.orchestration_run, fixture("action_requested_advice_only")["request"]
        )
        items = fixture("state_snapshot_action_requests")

        sync_snapshot_action_requests(self.orchestration_run, valid_action_requests(items))

        states = {
            row.key: (row.state, row.primary)
            for row in InvestigationActionRequest.objects.filter(investigation=self.investigation)
        }
        assert states == {
            **{item["key"]: ("suggested", item["primary"]) for item in items},
            "add-retry-spans": ("superseded", True),
        }
