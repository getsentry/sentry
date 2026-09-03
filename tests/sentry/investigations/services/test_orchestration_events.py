from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest
from rest_framework import serializers

from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.models import (
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationRun,
)
from sentry.investigations.services.orchestration import (
    create_agentic_manual_investigation,
)
from sentry.investigations.services.orchestration_events import (
    MAX_ORCHESTRATION_EVENT_BYTES,
    InvestigationOrchestrationEventConflict,
    OrchestrationEventReceipt,
    deliver_orchestration_event,
    reconcile_orchestration_projection,
    synchronize_orchestration_projection,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.testutils.cases import TestCase


class SeerRunMirrorMixin:
    def seer_run_mirror(self, seer_run_state_id: int) -> SeerRun:
        """A SeerRun mirror standing in for a run Seer already accepted."""

        return self.create_seer_run(  # type: ignore[attr-defined]
            organization=self.organization,  # type: ignore[attr-defined]
            type=SeerRunType.INVESTIGATION,
            seer_run_state_id=seer_run_state_id,
            mirror_status=SeerRunMirrorStatus.LIVE,
        )


class InvestigationOrchestrationEventTransportTest(SeerRunMirrorMixin, TestCase):
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
        projection = {
            **run.projection,
            "runId": 8128,
            "heartbeatAt": "2025-01-01T00:00:00+00:00",
        }
        event = {
            "schema_version": 1,
            "event_id": event_id,
            "run_id": 8128,
            "investigation_id": investigation.id,
            "sequence": 1,
            "generation": 1,
            "type": "workflow_updated",
            "payload": {"projection": projection},
        }
        run.update(
            seer_run=self.seer_run_mirror(8128),
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
                "payload": {"projection": projection},
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


class InvestigationOrchestrationEventTest(SeerRunMirrorMixin, TestCase):
    seer_run_id = 4815

    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.seer_run_mirror(self.seer_run_id)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Agentic investigation",
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            seer_run=self.seer_run,
            source={"type": "manual"},
            projection=self.projection(),
        )

    def projection(
        self,
        *,
        workflow_version: int = 1,
        generation: int = 1,
        phase: str = "broad_scan",
        status: str = "processing",
        report_revision: int = 0,
        report_status: str | None = None,
        clear_intent: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "runId": self.seer_run_id,
            "investigationId": str(self.investigation.id),
            "sourceType": "manual",
            "workflowVersion": workflow_version,
            "generation": generation,
            "phase": phase,
            "status": status,
            "broadScan": {"status": "running"},
            "hypotheses": [],
            "report": {
                "revision": report_revision,
                "status": report_status or ("composing" if report_revision else "not_started"),
                "clearIntent": clear_intent,
                "notebookRevision": 0,
                "metadata": {"status": "not_started"},
            },
            "pendingInput": None,
            "errors": [],
            "heartbeatAt": "2025-01-01T00:00:00+00:00",
        }

    def event(
        self,
        sequence: int,
        event_type: str,
        payload: dict[str, Any],
        *,
        event_id: UUID | None = None,
        generation: int = 1,
    ) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "event_id": event_id or uuid4(),
            "run_id": self.seer_run_id,
            "investigation_id": self.investigation.id,
            "sequence": sequence,
            "generation": generation,
            "type": event_type,
            "payload": payload,
        }

    def deliver(self, event: dict[str, Any]) -> OrchestrationEventReceipt:
        return deliver_orchestration_event(
            organization_id=self.organization.id,
            event=event,
        )

    def test_out_of_order_events_deduplicate_and_ignore_delayed_responses(self) -> None:
        second_id = uuid4()
        second = self.event(
            2,
            "workflow_updated",
            {"projection": self.projection(workflow_version=3, phase="investigating")},
            event_id=second_id,
        )
        first = self.event(
            1,
            "workflow_updated",
            {"projection": self.projection(workflow_version=2, phase="planning")},
        )

        waiting = self.deliver(second)
        assert waiting.last_applied_sequence == 0
        assert waiting.application_status == InvestigationOrchestrationEventStatus.PENDING

        applied = self.deliver(first)
        assert applied.last_applied_sequence == 2
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 3
        assert self.orchestration_run.phase == "investigating"

        duplicate = self.deliver(second)
        assert duplicate.duplicate is True
        assert duplicate.last_applied_sequence == 2
        assert (
            InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=self.orchestration_run
            ).count()
            == 2
        )

        changed = self.event(
            2,
            "workflow_updated",
            {"projection": self.projection(workflow_version=4)},
            event_id=second_id,
        )
        with pytest.raises(InvestigationOrchestrationEventConflict):
            self.deliver(changed)

        synchronize_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=self.projection(workflow_version=2, phase="planning"),
        )
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 3
        assert self.orchestration_run.phase == "investigating"

    def test_synchronize_projection_applies_newer_state_without_consuming_events(self) -> None:
        synchronize_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=self.projection(
                workflow_version=2,
                generation=2,
                phase="planning",
            ),
        )

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 2
        assert self.orchestration_run.generation == 2
        assert self.orchestration_run.phase == "planning"
        assert self.orchestration_run.last_event_sequence == 0

    def test_synchronize_projection_rejects_invalid_seer_run_ids(self) -> None:
        for seer_run_id in (True, 0, I64_MAX + 1):
            with pytest.raises(serializers.ValidationError):
                synchronize_orchestration_projection(
                    orchestration_run_id=self.orchestration_run.id,
                    seer_run_id=seer_run_id,
                    projection=self.projection(),
                )

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.seer_run.seer_run_state_id == self.seer_run_id

    def test_reconcile_projection_can_authoritatively_replace_state(self) -> None:
        self.orchestration_run.update(
            workflow_version=3,
            generation=3,
            phase="investigating",
        )

        reconcile_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=self.projection(
                workflow_version=2,
                generation=2,
                phase="planning",
            ),
        )

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 2
        assert self.orchestration_run.generation == 2
        assert self.orchestration_run.phase == "planning"
        assert self.orchestration_run.last_event_sequence == 0

    def test_stale_and_future_generations_are_consumed_without_mutation(self) -> None:
        self.deliver(
            self.event(
                1,
                "workflow_updated",
                {"projection": self.projection(workflow_version=2, generation=2)},
                generation=2,
            )
        )
        stale = self.deliver(self.event(2, "report_clear", {"reportRevision": 4}, generation=1))
        future_without_projection = self.deliver(
            self.event(3, "report_clear", {"reportRevision": 5}, generation=3)
        )

        assert stale.application_status == InvestigationOrchestrationEventStatus.IGNORED
        assert future_without_projection.application_status == (
            InvestigationOrchestrationEventStatus.IGNORED
        )
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.generation == 2
        assert self.orchestration_run.notebook_revision == 0
        assert self.orchestration_run.last_event_sequence == 3

    def test_terminal_full_snapshot_recovers_a_sequence_gap(self) -> None:
        waiting = self.deliver(
            self.event(
                3,
                "state_snapshot",
                {
                    "terminal": False,
                    "full": True,
                    "projection": self.projection(workflow_version=3),
                    "blocks": [],
                },
            )
        )
        assert waiting.last_applied_sequence == 0

        reconciled = self.deliver(
            self.event(
                5,
                "state_snapshot",
                {
                    "terminal": True,
                    "full": True,
                    "projection": self.projection(
                        workflow_version=5,
                        phase="completed",
                        status="completed",
                    ),
                    "blocks": [],
                },
            )
        )

        assert reconciled.last_applied_sequence == 5
        assert reconciled.application_status == InvestigationOrchestrationEventStatus.APPLIED
        waiting_event = InvestigationOrchestrationEvent.objects.get(sequence=3)
        assert waiting_event.application_status == InvestigationOrchestrationEventStatus.IGNORED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == "completed"
        assert self.orchestration_run.workflow_version == 5

    def test_projection_evidence_must_use_investigation_projects(self) -> None:
        self.create_investigation_project(
            investigation=self.investigation,
            project=self.project,
        )
        unlinked_project = self.create_project(organization=self.organization)
        projection = self.projection()
        projection["hypotheses"] = [
            {
                "id": "hypothesis-1",
                "order": 0,
                "statement": "A release caused the regression",
                "rationale": "The timing lines up.",
                "status": "completed",
                "effectiveStatus": "supported",
                "decisionSource": "agent",
                "verificationSteps": [],
                "evidence": [
                    {
                        "id": "evidence-1",
                        "title": "Unlinked project event",
                        "kind": "event",
                        "projectIds": [unlinked_project.id],
                    }
                ],
                "toolActivity": [],
            }
        ]

        delivered = self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert delivered.application_status == InvestigationOrchestrationEventStatus.FAILED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["hypotheses"] == []

    def test_projection_accepts_evidence_from_an_investigation_project(self) -> None:
        self.create_investigation_project(
            investigation=self.investigation,
            project=self.project,
        )
        projection = self.projection()
        projection["hypotheses"] = [
            {
                "id": "hypothesis-1",
                "order": 0,
                "statement": "A release caused the regression",
                "rationale": "The timing lines up.",
                "status": "completed",
                "effectiveStatus": "supported",
                "decisionSource": "agent",
                "verificationSteps": [],
                "evidence": [
                    {
                        "id": "evidence-1",
                        "title": "Linked project event",
                        "kind": "event",
                        "projectIds": [self.project.id],
                    }
                ],
                "toolActivity": [],
            }
        ]

        delivered = self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert delivered.application_status == InvestigationOrchestrationEventStatus.APPLIED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["hypotheses"][0]["evidence"] == [
            {
                "id": "evidence-1",
                "title": "Linked project event",
                "kind": "event",
                "projectIds": [self.project.id],
            }
        ]

    def test_verification_evidence_must_use_investigation_projects(self) -> None:
        self.create_investigation_project(
            investigation=self.investigation,
            project=self.project,
        )
        unlinked_project = self.create_project(organization=self.organization)
        projection = self.projection()
        projection["hypotheses"] = [
            {
                "id": "hypothesis-1",
                "order": 0,
                "statement": "A release caused the regression",
                "rationale": "The timing lines up.",
                "status": "completed",
                "effectiveStatus": "supported",
                "decisionSource": "agent",
                "verificationSteps": [
                    {
                        "id": "step-1",
                        "order": 0,
                        "title": "Inspect the event",
                        "objective": "Verify the affected project.",
                        "method": "Read the event details.",
                        "status": "completed",
                        "evidence": [
                            {
                                "id": "evidence-1",
                                "title": "Unlinked project event",
                                "kind": "event",
                                "projectIds": [unlinked_project.id],
                            }
                        ],
                    }
                ],
                "evidence": [],
                "toolActivity": [],
            }
        ]

        delivered = self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert delivered.application_status == InvestigationOrchestrationEventStatus.FAILED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["hypotheses"] == []


class InvestigationOrchestrationSeerRunAdoptionTest(SeerRunMirrorMixin, TestCase):
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
        run_id = overrides.pop("run_id", 8128)
        event: dict[str, Any] = {
            "schema_version": 1,
            "event_id": str(uuid4()),
            "run_id": run_id,
            "investigation_id": run.investigation_id,
            "sequence": 1,
            "generation": 1,
            "type": "workflow_updated",
            "payload": {
                "projection": {
                    "runId": run_id,
                    "investigationId": str(run.investigation_id),
                    "sourceType": "manual",
                    "workflowVersion": 1,
                    "generation": 1,
                    "phase": "broad_scan",
                    "status": "processing",
                    "broadScan": {"status": "running"},
                    "hypotheses": [],
                    "report": {
                        "revision": 0,
                        "status": "not_started",
                        "notebookRevision": 0,
                        "metadata": {"status": "not_started"},
                    },
                    "pendingInput": None,
                    "errors": [],
                    "heartbeatAt": "2025-01-01T00:00:00+00:00",
                }
            },
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
