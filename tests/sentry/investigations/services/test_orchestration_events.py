from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest
from django.utils import timezone
from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.endpoints.serializers import InvestigationBlockSerializer
from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
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

    def test_text_and_title_stream_resets_replace_stale_content(self) -> None:
        manual = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            content="old manual block",
        )
        manual_execution = self.create_investigation_block_execution(
            block=manual,
            block_version=manual.version,
            status=InvestigationBlockExecutionStatus.RUNNING,
        )
        manual.current_execution = manual_execution
        manual.save(update_fields=["current_execution", "date_updated"])
        events = [
            self.event(1, "report_clear", {"reportRevision": 1}),
            self.event(
                2,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "summary",
                    "position": 0,
                    "kind": "text",
                    "title": "Summary",
                    "collapsed": False,
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                3,
                "report_text_delta",
                {"reportRevision": 1, "stableAgentKey": "summary", "delta": "stale"},
            ),
            self.event(
                4,
                "report_text_delta",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "summary",
                    "delta": "fresh",
                    "reset": True,
                },
            ),
            self.event(5, "title_delta", {"reportRevision": 1, "delta": "Stale"}),
            self.event(
                6,
                "title_delta",
                {"reportRevision": 1, "delta": "Fresh", "reset": True},
            ),
            self.event(
                7,
                "metadata_completed",
                {
                    "reportRevision": 1,
                    "title": "Final title",
                    "summary": "Root cause found",
                    "summaryDescription": "A release changed routing.\nRollback restores service.",
                },
            ),
        ]
        for event in events[:-1]:
            self.deliver(event)
        self.investigation.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert self.investigation.title == "Fresh"
        assert self.orchestration_run.projection["report"]["metadata"]["title"] == "Fresh"
        assert self.orchestration_run.projection["report"]["metadata"]["status"] == "generating"
        self.deliver(events[-1])

        manual.refresh_from_db()
        manual_execution.refresh_from_db()
        assert manual.deleted_at is None
        assert manual_execution.status == InvestigationBlockExecutionStatus.RUNNING
        block = InvestigationBlock.objects.get(
            investigation=self.investigation,
            stable_agent_key="summary",
        )
        assert block.content == "fresh"
        assert block.generated_content == "fresh"
        assert block.report_revision == 1
        assert block.content_execution is not None
        assert list(
            block.content_execution.data_project_links.values_list("project_id", flat=True)
        ) == [self.project.id]
        restricted_user = self.create_user()
        self.create_member(organization=self.organization, user=restricted_user)
        restricted = serialize(
            block,
            restricted_user,
            InvestigationBlockSerializer(accessible_project_ids=set()),
        )
        assert restricted["content"] == ""
        assert restricted["generatedContent"] == ""
        assert restricted["outputStatus"] == "restricted"
        self.investigation.refresh_from_db()
        assert self.investigation.title == "Final title"
        assert self.investigation.summary == "Root cause found"
        assert self.investigation.summary_description == (
            "A release changed routing.\nRollback restores service."
        )
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.notebook_revision == 7

    def test_query_upsert_persists_an_immutable_completed_snapshot(self) -> None:
        self.deliver(self.event(1, "report_clear", {"reportRevision": 1}))
        self.deliver(
            self.event(
                2,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "event-count",
                    "position": 0,
                    "kind": "query",
                    "title": "Event count",
                    "collapsed": True,
                    "projectIds": [self.project.id],
                },
            )
        )
        in_flight = InvestigationBlock.objects.get(stable_agent_key="event-count")
        assert in_flight.current_execution is not None
        assert in_flight.result_execution_id == in_flight.current_execution_id
        assert in_flight.current_execution.status == InvestigationBlockExecutionStatus.RUNNING
        assert (
            serialize(
                in_flight,
                self.user,
                InvestigationBlockSerializer(accessible_project_ids={self.project.id}),
            )["outputStatus"]
            == InvestigationBlockExecutionStatus.RUNNING
        )
        result = {
            "schemaVersion": 1,
            "tableMarkdown": "| Count |\n| ---: |\n| 42 |",
            "chart": None,
            "preferredView": "table",
            "isEmpty": False,
            "chartUnavailableReason": "A chart is not useful for one value.",
        }
        self.deliver(
            self.event(
                3,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "event-count",
                    "position": 0,
                    "kind": "query",
                    "title": "Event count",
                    "collapsed": True,
                    "projectIds": [self.project.id],
                    "result": result,
                    "generationPrompt": "Count matching events once.",
                    "producingRunId": 90210,
                },
            )
        )

        block = InvestigationBlock.objects.get(stable_agent_key="event-count")
        assert block.display["queryCollapsed"] is True
        assert block.prompt == "Count matching events once."
        assert block.producing_seer_run_id == 90210
        assert block.current_execution_id == block.result_execution_id
        execution = InvestigationBlockExecution.objects.get(id=block.result_execution_id)
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert execution.executor == InvestigationBlockExecutor.CODE_MODE
        assert execution.result is not None
        assert execution.result["tableMarkdown"] == result["tableMarkdown"]
        assert list(execution.data_project_links.values_list("project_id", flat=True)) == [
            self.project.id
        ]

        self.deliver(
            self.event(
                4,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        phase="reporting",
                        report_revision=2,
                    )
                },
            )
        )
        self.deliver(
            self.event(
                5,
                "report_block_started",
                {
                    "reportRevision": 2,
                    "stableAgentKey": "event-count",
                    "position": 0,
                    "kind": "query",
                    "title": "Event count",
                    "projectIds": [self.project.id],
                },
            )
        )
        block.refresh_from_db()
        assert block.current_execution_id != block.result_execution_id
        assert block.current_execution is not None
        assert block.current_execution.status == InvestigationBlockExecutionStatus.RUNNING
        assert block.result_execution_id == execution.id
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED

    def test_replacement_text_is_published_with_its_execution_provenance(self) -> None:
        replacement_project = self.create_project(organization=self.organization)
        self.create_investigation_project(
            investigation=self.investigation,
            project=self.project,
        )
        self.create_investigation_project(
            investigation=self.investigation,
            project=replacement_project,
        )
        self.deliver(self.event(1, "report_clear", {"reportRevision": 1}))
        self.deliver(
            self.event(
                2,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "summary",
                    "position": 0,
                    "kind": "text",
                    "title": "Summary",
                    "projectIds": [self.project.id],
                },
            )
        )
        self.deliver(
            self.event(
                3,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "summary",
                    "position": 0,
                    "kind": "text",
                    "title": "Summary",
                    "content": "Original conclusion",
                    "generatedContent": "Original conclusion",
                    "projectIds": [self.project.id],
                },
            )
        )
        block = InvestigationBlock.objects.get(stable_agent_key="summary")
        completed_execution_id = block.content_execution_id

        self.deliver(
            self.event(
                4,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        phase="reporting",
                        report_revision=2,
                    )
                },
            )
        )
        self.deliver(
            self.event(
                5,
                "report_block_started",
                {
                    "reportRevision": 2,
                    "stableAgentKey": "summary",
                    "position": 0,
                    "kind": "text",
                    "title": "Summary",
                    "projectIds": [replacement_project.id],
                },
            )
        )
        self.deliver(
            self.event(
                6,
                "report_text_delta",
                {
                    "reportRevision": 2,
                    "stableAgentKey": "summary",
                    "delta": "Partial replacement",
                    "reset": True,
                },
            )
        )

        block.refresh_from_db()
        assert block.content == "Original conclusion"
        assert block.generated_content == "Original conclusion"
        assert block.content_execution_id == completed_execution_id
        current_execution = block.current_execution
        assert current_execution is not None
        assert current_execution.id != completed_execution_id
        assert list(current_execution.data_project_links.values_list("project_id", flat=True)) == [
            replacement_project.id
        ]

        self.deliver(
            self.event(
                7,
                "report_block_upserted",
                {
                    "reportRevision": 2,
                    "stableAgentKey": "summary",
                    "position": 0,
                    "kind": "text",
                    "title": "Summary",
                    "content": "Replacement conclusion",
                    "generatedContent": "Replacement conclusion",
                    "projectIds": [replacement_project.id],
                },
            )
        )
        block.refresh_from_db()
        assert block.content == "Replacement conclusion"
        assert block.generated_content == "Replacement conclusion"
        assert block.content_execution_id == block.current_execution_id
        assert block.content_execution_id != completed_execution_id

    def test_workflow_failure_fails_the_run_without_a_projection(self) -> None:
        error = {"code": "seer_unavailable", "message": "Seer stopped responding."}

        receipt = self.deliver(self.event(1, "workflow_failed", {"error": error}))

        assert receipt.application_status == InvestigationOrchestrationEventStatus.APPLIED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == InvestigationOrchestrationStatus.FAILED
        assert self.orchestration_run.phase == InvestigationOrchestrationPhase.FAILED
        assert self.orchestration_run.error == error

    def test_applying_an_event_records_a_heartbeat(self) -> None:
        before = timezone.now()

        self.deliver(self.event(1, "workflow_updated", {"projection": self.projection()}))

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.heartbeat_at >= before

    def test_workflow_failure_carrying_a_projection_may_advance_the_generation(self) -> None:
        receipt = self.deliver(
            self.event(
                1,
                "workflow_failed",
                {
                    "error": {"code": "seer_failed", "message": "Seer gave up."},
                    "projection": self.projection(workflow_version=2, generation=2),
                },
                generation=2,
            )
        )

        assert receipt.application_status == InvestigationOrchestrationEventStatus.APPLIED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == InvestigationOrchestrationStatus.FAILED
        assert self.orchestration_run.generation == 2

    def test_workflow_failure_does_not_apply_a_stale_projection(self) -> None:
        self.deliver(
            self.event(1, "workflow_updated", {"projection": self.projection(workflow_version=5)})
        )

        self.deliver(
            self.event(
                2,
                "workflow_failed",
                {
                    "error": {"code": "seer_failed", "message": "Seer gave up."},
                    "projection": self.projection(workflow_version=2, phase="planning"),
                },
            )
        )

        self.orchestration_run.refresh_from_db()
        # The run fails either way; what the stale projection must not do is
        # replace the stored blob with its older contents.
        assert self.orchestration_run.projection["workflowVersion"] == 5
        assert self.orchestration_run.status == InvestigationOrchestrationStatus.FAILED

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

    def test_stale_report_revision_is_consumed_without_mutation(self) -> None:
        self.deliver(self.event(1, "report_clear", {"reportRevision": 1}))

        stale = self.deliver(self.event(2, "report_completed", {"reportRevision": 0}))

        assert stale.application_status == InvestigationOrchestrationEventStatus.IGNORED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.last_event_sequence == 2
        assert self.orchestration_run.projection["report"]["status"] == "composing"

    def test_terminal_full_snapshot_recovers_a_sequence_gap(self) -> None:
        old_block = self.create_investigation_block(
            investigation=self.investigation,
            report_revision=0,
            stable_agent_key="old-summary",
            content="stale report",
        )
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
                        report_revision=2,
                    ),
                    "reportRevision": 2,
                    "blocks": [
                        {
                            "stableAgentKey": "recovered-summary",
                            "position": 0,
                            "kind": "text",
                            "title": "Recovered summary",
                            "content": "Recovered report",
                            "projectIds": [self.project.id],
                        }
                    ],
                    "metadata": {
                        "title": "Checkout Release Regression",
                        "summary": "Release caused checkout failures",
                        "summaryDescription": (
                            "Checkout failures began with the latest release.\n"
                            "Roll it back while validating the changed request path."
                        ),
                    },
                },
            )
        )

        assert reconciled.last_applied_sequence == 5
        assert reconciled.application_status == InvestigationOrchestrationEventStatus.APPLIED
        waiting_event = InvestigationOrchestrationEvent.objects.get(sequence=3)
        assert waiting_event.application_status == InvestigationOrchestrationEventStatus.IGNORED
        self.orchestration_run.refresh_from_db()
        self.investigation.refresh_from_db()
        assert self.orchestration_run.status == "completed"
        assert self.orchestration_run.notebook_revision == 1
        assert self.investigation.title == "Checkout Release Regression"
        assert self.investigation.summary == "Release caused checkout failures"
        assert self.investigation.summary_description == (
            "Checkout failures began with the latest release.\n"
            "Roll it back while validating the changed request path."
        )
        old_block.refresh_from_db()
        assert old_block.deleted_at is not None
        recovered = InvestigationBlock.objects.get(stable_agent_key="recovered-summary")
        assert recovered.content == "Recovered report"
        assert recovered.content_execution is not None
        assert recovered.content_execution.status == InvestigationBlockExecutionStatus.COMPLETED
        assert list(
            recovered.content_execution.data_project_links.values_list("project_id", flat=True)
        ) == [self.project.id]

    def test_terminal_snapshots_preserve_authoritative_report_status(self) -> None:
        terminal_states = [
            ("completed", "completed", "completed"),
            ("failed", "failed", "failed"),
            ("cancelled", "cancelled", "cancelled"),
        ]

        for sequence, (phase, status, report_status) in enumerate(terminal_states, start=1):
            with self.subTest(status=status):
                delivered = self.deliver(
                    self.event(
                        sequence,
                        "state_snapshot",
                        {
                            "terminal": True,
                            "full": True,
                            "projection": self.projection(
                                workflow_version=sequence + 1,
                                phase=phase,
                                status=status,
                                report_revision=sequence,
                                report_status=report_status,
                            ),
                            "reportRevision": sequence,
                            "blocks": [],
                        },
                    )
                )

                assert delivered.application_status == (
                    InvestigationOrchestrationEventStatus.APPLIED
                )
                self.orchestration_run.refresh_from_db()
                assert self.orchestration_run.status == status
                assert self.orchestration_run.projection["report"]["status"] == report_status

    def test_failed_terminal_snapshot_is_consumed_after_the_gap_closes(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())
        failed = self.deliver(
            self.event(
                3,
                "state_snapshot",
                {
                    "terminal": True,
                    "full": True,
                    "projection": self.projection(
                        workflow_version=3,
                        phase="completed",
                        status="completed",
                        report_revision=1,
                    ),
                    "reportRevision": 1,
                    "blocks": [
                        {
                            "stableAgentKey": "invalid",
                            "position": 0,
                            "kind": "text",
                            "title": "Invalid",
                            "content": "Must roll back",
                            "projectIds": [foreign_project.id],
                        }
                    ],
                },
            )
        )
        assert failed.application_status == InvestigationOrchestrationEventStatus.FAILED
        assert failed.last_applied_sequence == 0
        assert not InvestigationBlock.objects.filter(stable_agent_key="invalid").exists()

        self.deliver(
            self.event(
                1,
                "workflow_updated",
                {"projection": self.projection()},
            )
        )
        closed = self.deliver(
            self.event(
                2,
                "workflow_updated",
                {"projection": self.projection(workflow_version=2, phase="planning")},
            )
        )

        assert closed.last_applied_sequence == 3
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.phase == "planning"

    def test_targeted_report_revision_preserves_blocks_until_explicit_clear(self) -> None:
        events = [
            self.event(1, "report_clear", {"reportRevision": 1}),
            self.event(
                2,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "first",
                    "position": 0,
                    "kind": "text",
                    "title": "First",
                    "content": "first body",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                3,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "second",
                    "position": 1,
                    "kind": "text",
                    "title": "Second",
                    "content": "second body",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                4,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        phase="reporting",
                        report_revision=2,
                    )
                },
            ),
            self.event(
                5,
                "report_block_moved",
                {"reportRevision": 2, "stableAgentKey": "first", "position": 1},
            ),
            self.event(
                6,
                "report_block_removed",
                {"reportRevision": 2, "stableAgentKey": "second"},
            ),
            self.event(
                7,
                "report_block_upserted",
                {
                    "reportRevision": 2,
                    "stableAgentKey": "first",
                    "position": 0,
                    "kind": "text",
                    "title": "First",
                    "content": "revised body",
                    "projectIds": [self.project.id],
                },
            ),
        ]
        for event in events[:5]:
            self.deliver(event)

        first = InvestigationBlock.objects.get(stable_agent_key="first")
        second = InvestigationBlock.objects.get(stable_agent_key="second")
        assert first.position == 1
        assert second.position == 0

        for event in events[5:]:
            self.deliver(event)

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.report_revision == 2
        assert first.content == "revised body"
        assert first.deleted_at is None
        assert second.report_revision == 2
        assert second.deleted_at is not None

        self.deliver(
            self.event(
                8,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=3,
                        phase="reporting",
                        report_revision=3,
                        clear_intent={
                            "id": "clear-3",
                            "revision": 3,
                            "reason": "hypothesis_set_changed",
                            "completed": False,
                        },
                    )
                },
            )
        )
        first.refresh_from_db()
        assert first.report_revision == 2
        assert first.deleted_at is None
        self.deliver(self.event(9, "report_clear", {"reportRevision": 3}))
        first.refresh_from_db()
        assert first.deleted_at is not None

    def test_targeted_report_revision_discards_in_flight_block(self) -> None:
        events = [
            self.event(1, "report_clear", {"reportRevision": 1}),
            self.event(
                2,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "completed",
                    "position": 0,
                    "kind": "text",
                    "title": "Completed",
                    "content": "Keep this evidence",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                3,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "partial",
                    "position": 1,
                    "kind": "text",
                    "title": "Partial",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                4,
                "report_text_delta",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "partial",
                    "delta": "unfinished",
                },
            ),
            self.event(
                5,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        phase="reporting",
                        report_revision=2,
                    )
                },
            ),
        ]
        for event in events:
            self.deliver(event)

        completed = InvestigationBlock.objects.get(stable_agent_key="completed")
        partial = InvestigationBlock.objects.get(stable_agent_key="partial")
        assert completed.report_revision == 2
        assert completed.deleted_at is None
        assert partial.report_revision == 1
        assert partial.deleted_at is not None
        assert partial.current_execution is not None
        assert partial.current_execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert partial.current_execution.error == {
            "code": "investigation_report_restarted",
            "message": "The investigation report was restarted.",
        }

    def test_report_failure_finishes_partial_text_and_query_executions(self) -> None:
        events = [
            self.event(1, "report_clear", {"reportRevision": 1}),
            self.event(
                2,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "partial-text",
                    "position": 0,
                    "kind": "text",
                    "title": "Partial text",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                3,
                "report_text_delta",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "partial-text",
                    "delta": "Evidence gathered so far",
                },
            ),
            self.event(
                4,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "partial-query",
                    "position": 1,
                    "kind": "query",
                    "title": "Partial query",
                    "projectIds": [self.project.id],
                },
            ),
            self.event(
                5,
                "report_failed",
                {
                    "reportRevision": 1,
                    "error": {
                        "code": "report_generation_failed",
                        "message": "The report could not be generated.",
                        "retryable": True,
                    },
                },
            ),
        ]
        for event in events:
            self.deliver(event)

        blocks = InvestigationBlock.objects.filter(
            stable_agent_key__in=["partial-text", "partial-query"]
        ).order_by("stable_agent_key")
        assert blocks.count() == 2
        for block in blocks:
            assert block.deleted_at is None
            assert block.current_execution is not None
            assert block.current_execution.status == InvestigationBlockExecutionStatus.FAILED
            assert block.current_execution.error == {
                "code": "investigation_report_failed",
                "message": "The investigation report could not be completed.",
            }

    def test_workflow_failure_finishes_partial_execution(self) -> None:
        self.deliver(
            self.event(
                1,
                "report_block_started",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "partial",
                    "position": 0,
                    "kind": "text",
                    "title": "Partial",
                    "projectIds": [self.project.id],
                },
            )
        )
        self.deliver(
            self.event(
                2,
                "workflow_failed",
                {
                    "error": {
                        "code": "parent_failed",
                        "message": "The parent workflow failed.",
                        "retryable": True,
                    }
                },
            )
        )

        execution = InvestigationBlock.objects.get(stable_agent_key="partial").current_execution
        assert execution is not None
        assert execution.status == InvestigationBlockExecutionStatus.FAILED
        assert execution.error == {
            "code": "investigation_report_failed",
            "message": "The investigation report could not be completed.",
        }

    def test_workflow_cancellation_cancels_partial_execution(self) -> None:
        self.deliver(
            self.event(
                1,
                "report_block_started",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "partial",
                    "position": 0,
                    "kind": "query",
                    "title": "Partial",
                    "projectIds": [self.project.id],
                },
            )
        )
        self.deliver(
            self.event(
                2,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        phase="cancelled",
                        status="cancelled",
                    )
                },
            )
        )

        execution = InvestigationBlock.objects.get(stable_agent_key="partial").current_execution
        assert execution is not None
        assert execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert execution.error == {
            "code": "investigation_cancelled",
            "message": "The investigation was cancelled.",
        }

    def test_invalid_contiguous_event_does_not_block_later_events(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())
        failed = self.deliver(
            self.event(
                1,
                "report_block_started",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "invalid",
                    "position": 0,
                    "kind": "text",
                    "title": "Invalid",
                    "projectIds": [foreign_project.id],
                },
            )
        )
        assert failed.application_status == InvestigationOrchestrationEventStatus.FAILED
        assert not InvestigationBlock.objects.filter(stable_agent_key="invalid").exists()
        assert not InvestigationBlockExecution.objects.filter(
            block__stable_agent_key="invalid"
        ).exists()

        applied = self.deliver(
            self.event(
                2,
                "workflow_updated",
                {"projection": self.projection(workflow_version=2, phase="planning")},
            )
        )
        assert applied.last_applied_sequence == 2
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.phase == "planning"

    def test_manual_report_block_can_use_persisted_investigation_project_scope(self) -> None:
        self.create_investigation_project(
            investigation=self.investigation,
            project=self.project,
        )
        self.orchestration_run.source = {
            "type": "manual",
            "projectScope": {"type": "investigation"},
        }
        self.orchestration_run.save(update_fields=["source", "date_updated"])

        self.deliver(
            self.event(
                1,
                "report_block_started",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "scoped",
                    "position": 0,
                    "kind": "text",
                    "title": "Scoped",
                    "useInvestigationProjectScope": True,
                },
            )
        )

        execution = InvestigationBlock.objects.get(stable_agent_key="scoped").content_execution
        assert execution is not None
        assert list(execution.data_project_links.values_list("project_id", flat=True)) == [
            self.project.id
        ]

    def test_a_new_block_requires_a_position(self) -> None:
        # position is optional on the schema so an update can keep the stored one,
        # which leaves the requirement for a new block to the apply path.
        receipt = self.deliver(
            self.event(
                1,
                "report_block_upserted",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "block",
                    "kind": "text",
                    "title": "Block",
                    "content": "body",
                    "projectIds": [self.project.id],
                },
            )
        )

        assert receipt.application_status == InvestigationOrchestrationEventStatus.FAILED
        assert not InvestigationBlock.objects.filter(stable_agent_key="block").exists()

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
