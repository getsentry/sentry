from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from rest_framework import serializers

from sentry.investigations.models import (
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationRun,
)
from sentry.investigations.services.orchestration import create_agentic_manual_investigation
from sentry.investigations.services.orchestration_events import (
    MAX_ORCHESTRATION_EVENT_BYTES,
    deliver_orchestration_event,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.testutils.cases import TestCase


class InvestigationOrchestrationEventTransportTest(TestCase):
    def test_replays_the_stored_application_status(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )
        event_id = uuid4()
        event = {
            "schema_version": 1,
            "event_id": event_id,
            "run_id": 8128,
            "investigation_id": investigation.id,
            "sequence": 1,
            "generation": 1,
            "type": "workflow_updated",
            "payload": {"projection": {}},
        }
        run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=8128,
            ),
            last_event_sequence=1,
            notebook_revision=2,
        )
        self.create_investigation_orchestration_event(
            orchestration_run=run,
            event_id=event_id,
            sequence=1,
            type="workflow_updated",
            payload={
                "schemaVersion": 1,
                "runId": 8128,
                "investigationId": investigation.id,
                "generation": 1,
                "payload": {"projection": {}},
            },
            application_status=InvestigationOrchestrationEventStatus.APPLIED,
        )

        receipt = deliver_orchestration_event(
            organization_id=self.organization.id,
            event=event,
        )

        assert receipt.duplicate is True
        assert receipt.application_status == InvestigationOrchestrationEventStatus.APPLIED
        assert receipt.last_applied_sequence == 1
        assert receipt.next_expected_sequence == 2
        assert receipt.notebook_revision == 2

    def test_rejects_an_oversized_event_before_persisting(self) -> None:
        investigation, _ = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )

        with pytest.raises(serializers.ValidationError):
            deliver_orchestration_event(
                organization_id=self.organization.id,
                event={
                    "schema_version": 1,
                    "event_id": uuid4(),
                    "run_id": 8128,
                    "investigation_id": investigation.id,
                    "sequence": 1,
                    "generation": 1,
                    "type": "workflow_updated",
                    "payload": {"value": "x" * MAX_ORCHESTRATION_EVENT_BYTES},
                },
            )

        assert not investigation.orchestration_run.events.exists()


class InvestigationOrchestrationSeerRunAdoptionTest(TestCase):
    def orchestration_run(self) -> InvestigationOrchestrationRun:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )
        return run

    def event(self, run: InvestigationOrchestrationRun, **overrides: Any) -> dict[str, Any]:
        event: dict[str, Any] = {
            "schema_version": 1,
            "event_id": str(uuid4()),
            "run_id": 8128,
            "investigation_id": run.investigation_id,
            "sequence": 1,
            "generation": 1,
            "type": "workflow_updated",
            "payload": {"projection": {}},
        }
        event.update(overrides)
        return event

    def test_adopts_the_run_id_from_the_first_event(self) -> None:
        run = self.orchestration_run()
        assert run.seer_run is None

        deliver_orchestration_event(organization_id=self.organization.id, event=self.event(run))

        adopted = InvestigationOrchestrationRun.objects.get(id=run.id)
        assert adopted.seer_run is not None
        assert adopted.seer_run.seer_run_state_id == 8128
        assert adopted.seer_run.type == SeerRunType.INVESTIGATION.value
        # Adoption implies Seer already confirmed the run, and nothing else can
        # advance this mirror, so it must not be left pending.
        assert adopted.seer_run.mirror_status == SeerRunMirrorStatus.LIVE
        assert adopted.seer_run.organization_id == self.organization.id

    def test_reuses_an_existing_mirror_for_the_same_seer_run(self) -> None:
        run = self.orchestration_run()
        existing = self.create_seer_run(
            organization=self.organization,
            type=SeerRunType.INVESTIGATION,
            seer_run_state_id=8128,
        )

        deliver_orchestration_event(organization_id=self.organization.id, event=self.event(run))

        run.refresh_from_db()
        assert run.seer_run_id == existing.id
        assert SeerRun.objects.filter(seer_run_state_id=8128).count() == 1

    def test_rejects_an_event_whose_run_id_contradicts_the_link(self) -> None:
        run = self.orchestration_run()
        run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=8128,
            )
        )

        with pytest.raises(serializers.ValidationError):
            deliver_orchestration_event(
                organization_id=self.organization.id, event=self.event(run, run_id=9999)
            )
