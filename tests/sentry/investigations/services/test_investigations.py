from __future__ import annotations

from typing import Any
from unittest import mock
from uuid import UUID, uuid4

import pytest
from django.db import IntegrityError
from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.endpoints.serializers import InvestigationBlockSerializer
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationStatus,
    InvestigationProject,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.breached_metrics import BreachedMetricSource
from sentry.investigations.services.investigations import (
    InvestigationSourceNotFound,
    InvestigationValidationError,
    create_block,
    create_manual_investigation,
    create_template_investigation,
    delete_block,
    duplicate_investigation,
    investigation_legacy_source_key,
    investigation_lineage_key,
    lock_investigation,
    resolve_investigation_source,
    update_investigation,
)
from sentry.investigations.services.orchestration import (
    archive_investigation_with_orchestration,
    create_agentic_breached_metric_investigation,
    update_investigation_with_orchestration,
)
from sentry.investigations.services.orchestration_events import (
    InvestigationOrchestrationEventConflict,
    OrchestrationEventDelivery,
    deliver_orchestration_event,
    synchronize_orchestration_projection,
)
from sentry.testutils.cases import TestCase

TEMPLATE_KWARGS = {
    "organization": mock.sentinel.organization,
    "user_id": 1,
    "template_key": "breached_metric",
    "template_version": 1,
    "source": {},
    "supplied_parameters": {},
    "accessible_project_ids": set(),
}


def test_template_creation_retries_revision_uniqueness_collisions() -> None:
    created = (mock.sentinel.investigation, True)
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=[IntegrityError(), created],
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result == created
    assert create.call_count == 2


def test_template_creation_succeeds_without_a_collision() -> None:
    created = (mock.sentinel.investigation, True)
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        return_value=created,
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result == created
    assert create.call_count == 1


def test_template_creation_reraises_after_exhausting_retries() -> None:
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=IntegrityError(),
    ) as create:
        with pytest.raises(IntegrityError):
            create_template_investigation(**TEMPLATE_KWARGS)

    assert create.call_count == 3


class ProjectLinkScopingTest(TestCase):
    def test_create_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)

        with pytest.raises(InvestigationValidationError) as excinfo:
            create_manual_investigation(
                organization=self.organization,
                user_id=self.user.id,
                title="Investigation",
                project_ids=[foreign_project.id],
                filters={},
            )

        assert "projectIds" in excinfo.value.errors
        assert not InvestigationProject.objects.filter(project_id=foreign_project.id).exists()

    def test_create_accepts_projects_in_the_organization(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        assert list(
            InvestigationProject.objects.filter(investigation=investigation).values_list(
                "project_id", flat=True
            )
        ) == [self.project.id]

    def test_update_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        with pytest.raises(InvestigationValidationError):
            update_investigation(
                investigation=investigation,
                expected_version=investigation.version,
                fields={},
                project_ids=[foreign_project.id],
            )

        assert not InvestigationProject.objects.filter(project_id=foreign_project.id).exists()


class DeleteBlockStalenessTest(TestCase):
    def test_deleting_an_upstream_block_marks_its_dependents_stale(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )
        upstream = create_block(
            investigation=investigation,
            expected_investigation_version=investigation.version,
            user_id=self.user.id,
            values={"kind": "query"},
        )
        investigation.refresh_from_db()
        dependent = create_block(
            investigation=investigation,
            expected_investigation_version=investigation.version,
            user_id=self.user.id,
            values={"kind": "text"},
        )
        investigation.refresh_from_db()
        InvestigationBlockDependency.objects.create(block=dependent, depends_on=upstream)
        assert dependent.stale_at is None

        delete_block(
            block=upstream,
            expected_investigation_version=investigation.version,
            expected_block_version=upstream.version,
        )

        dependent.refresh_from_db()
        assert dependent.stale_at is not None


class BreachedMetricSourceRefTest(TestCase):
    def test_accepts_serialized_source_fields_and_uses_the_resolved_source(self) -> None:
        source_ref = {"groupId": "1", "openPeriodId": "2"}
        resolved = BreachedMetricSource(
            project_id=self.project.id,
            dataset="errors",
            source={
                "type": "metric_open_period",
                "ref": source_ref,
                "snapshot": {"monitor": {"name": "Resolved monitor"}},
            },
        )

        with mock.patch(
            "sentry.investigations.services.investigations.resolve_breached_metric_sources",
            return_value={(1, 2): resolved},
        ):
            result = resolve_investigation_source(
                organization=self.organization,
                source={
                    "type": "metric_open_period",
                    "ref": source_ref,
                    "revision": 3,
                    "snapshot": {"monitor": {"name": "Caller-supplied monitor"}},
                },
                accessible_project_ids={self.project.id},
            )

        assert result == resolved

    def test_out_of_range_ids_are_treated_as_a_missing_source(self) -> None:
        with pytest.raises(InvestigationSourceNotFound):
            resolve_investigation_source(
                organization=self.organization,
                source={
                    "type": "metric_open_period",
                    "ref": {"groupId": str(I64_MAX + 1), "openPeriodId": "1"},
                },
                accessible_project_ids={self.project.id},
            )

    def test_agentic_launch_recovers_a_concurrent_active_lineage(self) -> None:
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": "10", "openPeriodId": "20"},
            "snapshot": {
                "groupId": "10",
                "groupTitle": "Errors breached threshold",
                "openPeriodId": "20",
                "monitor": {
                    "id": "30",
                    "name": "Error count",
                    "query": "is:unresolved",
                    "direction": "above",
                    "conditions": [{"type": "gt", "comparison": 100, "result": True}],
                },
                "project": {"id": str(self.project.id), "slug": self.project.slug},
                "analysisWindow": {
                    "baselineStart": "2025-01-01T00:00:00+00:00",
                    "breachStart": "2025-01-01T01:00:00+00:00",
                    "end": "2025-01-01T02:00:00+00:00",
                },
            },
        }
        resolved = BreachedMetricSource(
            project_id=self.project.id,
            dataset="errors",
            source=source,
        )
        lineage_key = investigation_lineage_key("breached_metric", source)
        competing: Investigation | None = None

        def concurrent_create(**kwargs: Any) -> None:
            nonlocal competing
            competing = self.create_investigation(
                organization=self.organization,
                created_by=self.user,
                source=source,
                lineage_key=lineage_key,
                source_revision=1,
            )
            raise IntegrityError

        with mock.patch(
            "sentry.investigations.services.orchestration.create_agentic_investigation",
            side_effect=concurrent_create,
        ) as create:
            investigation, created = create_agentic_breached_metric_investigation(
                organization=self.organization,
                user_id=self.user.id,
                title=None,
                resolved_source=resolved,
                project_ids=[self.project.id],
                filters={},
            )

        assert competing is not None
        assert investigation.id == competing.id
        assert created is False
        assert create.call_count == 1

    def test_non_positive_ids_are_treated_as_a_missing_source(self) -> None:
        with pytest.raises(InvestigationSourceNotFound):
            resolve_investigation_source(
                organization=self.organization,
                source={
                    "type": "metric_open_period",
                    "ref": {"groupId": "0", "openPeriodId": "1"},
                },
                accessible_project_ids={self.project.id},
            )


class SourceTransitionCompatibilityTest(TestCase):
    def test_template_creation_reuses_and_backfills_a_legacy_active_investigation(self) -> None:
        source_ref = {"groupId": "1", "openPeriodId": "2"}
        snapshot = {"monitor": {"name": "Checkout errors"}}
        resolved_source = {
            "type": InvestigationSourceType.METRIC_OPEN_PERIOD,
            "ref": source_ref,
            "snapshot": snapshot,
        }
        legacy = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Legacy",
            template_key="breached_metric",
            template_version=1,
            source_type=InvestigationSourceType.BREACHED_METRIC,
            source_ref=source_ref,
            source_key=investigation_legacy_source_key(resolved_source),
            source_revision=1,
            filters={"breachedMetric": snapshot},
        )
        resolved = BreachedMetricSource(
            project_id=self.project.id,
            dataset="errors",
            source=resolved_source,
        )

        with mock.patch(
            "sentry.investigations.services.investigations.resolve_investigation_source",
            return_value=resolved,
        ):
            investigation, created = create_template_investigation(
                organization=self.organization,
                user_id=self.user.id,
                template_key="breached_metric",
                template_version=1,
                source={"type": "metric_open_period", "ref": source_ref},
                supplied_parameters={},
                accessible_project_ids={self.project.id},
            )

        assert not created
        assert investigation.id == legacy.id
        investigation.refresh_from_db()
        assert investigation.source == resolved.source
        assert investigation.lineage_key is not None
        assert Investigation.objects.count() == 1

    def test_filter_updates_and_manual_duplicates_do_not_expose_the_legacy_snapshot(self) -> None:
        snapshot = {"monitor": {"name": "Checkout errors"}}
        source = {
            "type": InvestigationSourceType.METRIC_OPEN_PERIOD,
            "ref": {"groupId": "1", "openPeriodId": "2"},
            "snapshot": snapshot,
        }
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            source=source,
            lineage_key="lineage-key",
            source_type=InvestigationSourceType.BREACHED_METRIC,
            source_ref=source["ref"],
            source_key=investigation_legacy_source_key(source),
            source_revision=1,
            filters={"breachedMetric": snapshot},
        )

        updated = update_investigation(
            investigation=investigation,
            expected_version=investigation.version,
            fields={"filters": {"environment": ["production"]}},
            project_ids=None,
        )
        duplicate = duplicate_investigation(investigation=updated, user_id=self.user.id)

        assert updated.filters == {
            "environment": ["production"],
            "breachedMetric": snapshot,
        }
        assert duplicate.source == {}
        assert duplicate.filters == {"environment": ["production"]}


class ConcurrentModificationTest(TestCase):
    def test_locking_a_deleted_investigation_is_a_missing_source(self) -> None:
        """A concurrent delete should not surface as an unhandled 500."""
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Gone",
            project_ids=[],
            filters={},
        )
        Investigation.objects.filter(id=investigation.id).delete()

        with pytest.raises(InvestigationSourceNotFound):
            lock_investigation(investigation, investigation.version)


class UpdateFieldAllowlistTest(TestCase):
    def test_rejects_fields_outside_the_allowlist(self) -> None:
        """The service does not trust its caller to have filtered `fields`."""
        other_organization = self.create_organization(name="other")
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )

        with pytest.raises(InvestigationValidationError):
            update_investigation(
                investigation=investigation,
                expected_version=investigation.version,
                fields={"organization_id": other_organization.id},
                project_ids=None,
            )

        investigation.refresh_from_db()
        assert investigation.organization_id == self.organization.id

    def test_accepts_the_allowlisted_fields(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )

        updated = update_investigation(
            investigation=investigation,
            expected_version=investigation.version,
            fields={"title": "Renamed", "filters": {"environment": ["prod"]}},
            project_ids=None,
        )

        assert updated.title == "Renamed"
        assert updated.filters == {"environment": ["prod"]}


class InvestigationOrchestrationEventTest(TestCase):
    seer_run_id = 4815

    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Agentic investigation",
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            seer_run_id=self.seer_run_id,
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

    def deliver(self, event: dict[str, Any]) -> OrchestrationEventDelivery:
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
        assert waiting.event.application_status == InvestigationOrchestrationEventStatus.PENDING

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

    def test_text_and_title_stream_resets_replace_stale_content(self) -> None:
        manual = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            content="old manual block",
        )
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
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["report"]["metadata"]["status"] == "generating"
        self.deliver(events[-1])

        manual.refresh_from_db()
        assert manual.deleted_at is not None
        block = InvestigationBlock.objects.get(
            orchestration_run=self.orchestration_run,
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

    def test_manual_title_edit_fences_later_agent_metadata_title(self) -> None:
        stale_version = self.investigation.version
        self.deliver(self.event(1, "title_delta", {"reportRevision": 0, "delta": "Agent title"}))

        update_investigation_with_orchestration(
            investigation=self.investigation,
            expected_version=stale_version,
            fields={"title": "Keep my title"},
            project_ids=None,
        )

        self.deliver(
            self.event(2, "title_delta", {"reportRevision": 0, "delta": "New agent title"})
        )
        self.deliver(
            self.event(
                3,
                "metadata_completed",
                {
                    "reportRevision": 0,
                    "title": "Agent final title",
                    "summary": "Root cause found",
                    "summaryDescription": "A release caused the regression.",
                },
            )
        )

        self.investigation.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert self.investigation.title == "Keep my title"
        assert self.investigation.summary == "Root cause found"
        assert self.investigation.summary_description == "A release caused the regression."
        assert self.orchestration_run.projection["report"]["metadata"]["title"] == ("Keep my title")

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
                    "projectIds": [self.project.id],
                    "block": {
                        "kind": "query",
                        "title": "Event count",
                        "collapsed": True,
                        "querySnapshot": {
                            "result": result,
                            "projectIds": [self.project.id],
                            "generationPrompt": "Count matching events once.",
                        },
                        "provenance": {"producingSeerRunId": 90210},
                    },
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

    def test_stale_generation_and_report_revision_are_consumed_without_mutation(self) -> None:
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

        assert stale.event.application_status == InvestigationOrchestrationEventStatus.IGNORED
        assert future_without_projection.event.application_status == (
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
                        report_revision=2,
                    ),
                    "reportRevision": 2,
                    "blocks": [],
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
        assert reconciled.event.application_status == InvestigationOrchestrationEventStatus.APPLIED
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

                assert delivered.event.application_status == (
                    InvestigationOrchestrationEventStatus.APPLIED
                )
                self.orchestration_run.refresh_from_db()
                assert self.orchestration_run.status == status
                assert self.orchestration_run.projection["report"]["status"] == report_status

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
        for event in events:
            self.deliver(event)

        first = InvestigationBlock.objects.get(stable_agent_key="first")
        second = InvestigationBlock.objects.get(stable_agent_key="second")
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
        failed = self.deliver(
            self.event(
                1,
                "report_block_started",
                {
                    "reportRevision": 0,
                    "stableAgentKey": "invalid",
                    "position": 0,
                    "kind": "text",
                    "title": 123,
                    "projectIds": [self.project.id],
                },
            )
        )
        assert failed.event.application_status == InvestigationOrchestrationEventStatus.FAILED

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

    def test_report_blocks_require_nonempty_project_provenance(self) -> None:
        with pytest.raises(serializers.ValidationError):
            self.deliver(
                self.event(
                    1,
                    "report_block_started",
                    {
                        "reportRevision": 0,
                        "stableAgentKey": "unsafe",
                        "position": 0,
                        "kind": "text",
                        "title": "Unsafe",
                        "projectIds": [],
                    },
                )
            )

        assert not InvestigationBlock.objects.filter(stable_agent_key="unsafe").exists()
        assert not InvestigationOrchestrationEvent.objects.exists()

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

    def test_event_payload_size_is_bounded(self) -> None:
        with pytest.raises(serializers.ValidationError):
            self.deliver(
                self.event(
                    1,
                    "workflow_failed",
                    {"error": {"message": "x" * (1024 * 1024)}},
                )
            )

    def test_malformed_nested_projection_is_rejected(self) -> None:
        mutations = [
            lambda projection: projection.update(
                {
                    "hypotheses": [
                        {
                            "id": "bad",
                            "order": 0,
                            "statement": "Bad projection",
                            "rationale": "Invalid status",
                            "status": "surprise",
                            "effectiveStatus": "pending",
                            "decisionSource": "none",
                        }
                    ]
                }
            ),
            lambda projection: projection["broadScan"].update(
                {
                    "error": {
                        "code": "bad_error",
                        "message": "Malformed retryability",
                        "retryable": "yes",
                    }
                }
            ),
            lambda projection: projection["broadScan"].update({"summary": "x" * (512 * 1024)}),
        ]
        for mutate in mutations:
            projection = self.projection()
            mutate(projection)

            with pytest.raises(serializers.ValidationError):
                self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert not InvestigationOrchestrationEvent.objects.exists()

    def test_archiving_fences_late_notebook_events_and_terminal_snapshot_blocks(self) -> None:
        existing = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            title="Existing",
            content="Preserve me",
        )
        original_title = self.investigation.title
        original_summary = self.investigation.summary

        archive_investigation_with_orchestration(
            investigation=self.investigation,
            expected_version=self.investigation.version,
            actor_id=self.user.id,
        )
        self.investigation.refresh_from_db()
        assert self.investigation.status == InvestigationStatus.ARCHIVED

        late_events = [
            self.event(1, "report_clear", {"reportRevision": 1}),
            self.event(2, "title_delta", {"reportRevision": 0, "delta": "Late title"}),
            self.event(
                3,
                "metadata_completed",
                {
                    "reportRevision": 0,
                    "title": "Late final title",
                    "summary": "Late summary",
                    "summaryDescription": "Late description",
                },
            ),
            self.event(
                4,
                "state_snapshot",
                {
                    "terminal": True,
                    "full": True,
                    "projection": self.projection(
                        workflow_version=3,
                        phase="completed",
                        status="cancelled",
                        report_revision=1,
                    ),
                    "reportRevision": 1,
                    "blocks": [],
                    "metadata": {
                        "title": "Snapshot title",
                        "summary": "Snapshot summary",
                        "summaryDescription": "Snapshot description",
                    },
                },
            ),
        ]
        for event in late_events:
            self.deliver(event)

        existing.refresh_from_db()
        self.investigation.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert existing.deleted_at is None
        assert existing.content == "Preserve me"
        assert self.investigation.title == original_title
        assert self.investigation.summary == original_summary
        assert self.orchestration_run.status == InvestigationOrchestrationStatus.CANCELLED
        assert self.orchestration_run.last_event_sequence == 4
        assert list(
            InvestigationOrchestrationEvent.objects.order_by("sequence").values_list(
                "application_status", flat=True
            )
        ) == [
            InvestigationOrchestrationEventStatus.IGNORED,
            InvestigationOrchestrationEventStatus.IGNORED,
            InvestigationOrchestrationEventStatus.IGNORED,
            InvestigationOrchestrationEventStatus.APPLIED,
        ]
