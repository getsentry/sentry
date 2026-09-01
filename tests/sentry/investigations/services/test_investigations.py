from __future__ import annotations

import threading
from typing import Any
from unittest import mock
from uuid import UUID, uuid4

import orjson
import pytest
from django.db import IntegrityError, close_old_connections
from django.test import override_settings
from django.utils import timezone
from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.endpoints.serializers import InvestigationBlockSerializer
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationRun,
    InvestigationProject,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.seer_client import (
    create_investigation_orchestration_run,
    dispatch_investigation_orchestration_command,
    get_investigation_orchestration_run,
)
from sentry.investigations.services.breached_metrics import BreachedMetricSource
from sentry.investigations.services.investigations import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    create_block,
    create_manual_investigation,
    create_template_investigation,
    delete_block,
    duplicate_investigation,
    investigation_legacy_source_key,
    lock_investigation,
    resolve_investigation_source,
    update_investigation,
)
from sentry.investigations.services.orchestration import (
    accept_orchestration_command,
    archive_investigation_with_orchestration,
    create_agentic_manual_investigation,
    get_orchestration_projection,
    update_investigation_with_orchestration,
)
from sentry.investigations.services.orchestration_events import (
    MAX_ORCHESTRATION_EVENT_BYTES,
    InvestigationOrchestrationEventConflict,
    OrchestrationEventReceipt,
    deliver_orchestration_event,
    reconcile_orchestration_projection,
    synchronize_orchestration_projection,
)
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

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


class OrchestrationControlServiceTest(TestCase):
    def test_agentic_creation_rolls_back_the_entire_aggregate(self) -> None:
        investigation_count = Investigation.objects.count()
        project_link_count = InvestigationProject.objects.count()

        with (
            mock.patch.object(
                InvestigationOrchestrationRun.objects, "create", side_effect=RuntimeError
            ),
            pytest.raises(RuntimeError),
        ):
            create_agentic_manual_investigation(
                organization=self.organization,
                user_id=self.user.id,
                title=None,
                source={"type": "manual", "prompt": "Investigate latency"},
                project_ids=[self.project.id],
                filters={},
            )

        assert Investigation.objects.count() == investigation_count
        assert InvestigationProject.objects.count() == project_link_count
        assert not InvestigationOrchestrationRun.objects.exists()

    def test_command_acceptance_rolls_back_command_and_version_together(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )

        with (
            mock.patch.object(InvestigationOrchestrationRun, "save", side_effect=RuntimeError),
            pytest.raises(RuntimeError),
        ):
            accept_orchestration_command(
                investigation=investigation,
                request_id=uuid4(),
                expected_workflow_version=1,
                command_type="cancel",
                payload={},
                actor_id=self.user.id,
            )

        run.refresh_from_db()
        assert run.workflow_version == 1
        assert not InvestigationOrchestrationCommand.objects.filter(orchestration_run=run).exists()

    def test_projection_serialization_overlays_authoritative_run_fields(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )
        heartbeat = timezone.now()
        run.update(
            seer_run_id=42,
            workflow_version=3,
            generation=2,
            phase="investigating",
            status="processing",
            notebook_revision=4,
            heartbeat_at=heartbeat,
            projection={
                "investigationId": "stale",
                "workflowVersion": 1,
                "phase": "intake",
                "status": "pending",
                "heartbeatAt": "stale",
                "updatedAt": "stale",
                "report": {"notebookRevision": 0},
            },
        )
        run.refresh_from_db()

        result = get_orchestration_projection(investigation)

        assert result["runId"] == "42"
        assert result["investigationId"] == str(investigation.id)
        assert result["workflowVersion"] == 3
        assert result["generation"] == 2
        assert result["phase"] == "investigating"
        assert result["status"] == "processing"
        assert result["notebookRevision"] == 4
        assert result["heartbeatAt"] == heartbeat
        assert result["updatedAt"] == run.date_updated
        assert result["report"]["notebookRevision"] == 4


class InvestigationOrchestrationSeerClientTest(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="investigation-protocol-test-secret")
    @mock.patch("sentry.investigations.seer_client.get_monitoring_provider_connections")
    def test_create_and_command_use_the_protocol_contract(
        self,
        get_connections: mock.Mock,
    ) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[self.project.id],
            filters={},
        )
        provider = mock.Mock()
        provider.dict.return_value = {
            "type": "header_auth",
            "provider_key": "example",
            "url": "https://example.invalid",
        }
        get_connections.return_value = [provider]
        run.update(seer_run_id=8128)
        run.refresh_from_db()
        command = self.create_investigation_orchestration_command(
            orchestration_run=run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            type="retry",
            payload={"target": "run"},
        )
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
        )
        pool = mock.Mock()
        pool.host = "seer"
        pool.port = 9091
        pool.scheme = "http"
        pool.urlopen.side_effect = [
            mock.Mock(
                status=200,
                data=b'{"runId":8128,"created":true,"projection":{}}',
            ),
            mock.Mock(
                status=200,
                data=b'{"runId":8128,"created":false,"projection":{}}',
            ),
            mock.Mock(
                status=200,
                data=orjson.dumps(
                    {
                        "runId": 8128,
                        "requestId": str(command.request_id),
                        "accepted": True,
                        "duplicate": False,
                        "workflowVersion": 2,
                        "projection": {},
                    }
                ),
            ),
        ]

        created = create_investigation_orchestration_run(
            run,
            viewer_context=viewer_context,
            connection_pool=pool,
        )
        replayed = create_investigation_orchestration_run(
            run,
            viewer_context=viewer_context,
            connection_pool=pool,
        )
        accepted = dispatch_investigation_orchestration_command(
            command,
            viewer_context=viewer_context,
            connection_pool=pool,
        )

        assert created == {"runId": 8128, "created": True, "projection": {}}
        assert replayed == {"runId": 8128, "created": False, "projection": {}}
        create_request = pool.urlopen.call_args_list[0]
        replay_request = pool.urlopen.call_args_list[1]
        assert create_request.args[:2] == ("POST", "/v1/automation/investigations")
        assert replay_request.args[:2] == ("POST", "/v1/automation/investigations")
        create_body = orjson.loads(create_request.kwargs["body"])
        replay_body = orjson.loads(replay_request.kwargs["body"])
        assert create_body["requestId"] == replay_body["requestId"]
        assert str(UUID(create_body["requestId"])) == create_body["requestId"]
        assert create_body["investigationId"] == investigation.id
        assert create_body["source"] == run.source
        assert create_body["activeTimeBudgetSeconds"] == 1800
        assert create_body["monitoringProviders"] == [provider.dict.return_value]
        assert "Authorization" in create_request.kwargs["headers"]
        assert "X-Viewer-Context" in create_request.kwargs["headers"]

        assert accepted["runId"] == 8128
        command_request = pool.urlopen.call_args_list[2]
        assert command_request.args[:2] == (
            "POST",
            "/v1/automation/investigations/8128/commands",
        )
        command_body = orjson.loads(command_request.kwargs["body"])
        assert command_body == {
            "requestId": str(command.request_id),
            "expectedWorkflowVersion": 1,
            "command": {"type": "retry", "target": "run"},
            "monitoringProviders": [provider.dict.return_value],
        }
        assert "Authorization" in command_request.kwargs["headers"]
        assert "X-Viewer-Context" in command_request.kwargs["headers"]

        pool.urlopen.side_effect = None
        pool.urlopen.return_value = mock.Mock(
            status=200,
            data=orjson.dumps(
                {
                    "runId": 8128,
                    "requestId": str(command.request_id),
                    "duplicate": False,
                    "workflowVersion": 2,
                    "projection": {},
                }
            ),
        )
        with pytest.raises(SeerApiError):
            dispatch_investigation_orchestration_command(
                command,
                viewer_context=viewer_context,
                connection_pool=pool,
            )

    def test_create_rejects_a_mismatched_viewer_organization(self) -> None:
        _, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )

        with pytest.raises(SeerApiError):
            create_investigation_orchestration_run(
                run,
                viewer_context=SeerViewerContext(
                    organization_id=self.create_organization().id,
                    user_id=self.user.id,
                ),
            )

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_get_uses_signed_viewer_context_and_validates_the_response(
        self,
        make_request: mock.Mock,
    ) -> None:
        make_request.return_value = mock.Mock(
            status=200,
            data=b'{"runId":8128,"created":false,"projection":{}}',
        )
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
        )

        result = get_investigation_orchestration_run(8128, viewer_context=viewer_context)

        assert result == {"runId": 8128, "created": False, "projection": {}}
        assert make_request.call_args.args[1] == "/v1/automation/investigations/8128"
        assert make_request.call_args.kwargs == {
            "body": b"",
            "method": "GET",
            "viewer_context": viewer_context,
        }

        make_request.return_value = mock.Mock(status=200, data=b"[]")
        with pytest.raises(SeerApiError):
            get_investigation_orchestration_run(8128, viewer_context=viewer_context)

        make_request.return_value = mock.Mock(status=503, data=b"{}")
        with pytest.raises(SeerApiError):
            get_investigation_orchestration_run(8128, viewer_context=viewer_context)


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
            seer_run_id=8128,
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


class OrchestrationCommandConcurrencyTest(TransactionTestCase):
    def test_only_one_command_is_accepted_for_a_workflow_version(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )
        barrier = threading.Barrier(2, timeout=10)

        def submit(request_id: UUID, reason: str) -> str:
            close_old_connections()
            barrier.wait()
            try:
                accept_orchestration_command(
                    investigation=investigation,
                    request_id=request_id,
                    expected_workflow_version=1,
                    command_type="cancel",
                    payload={"reason": reason},
                    actor_id=self.user.id,
                )
                return "accepted"
            except InvestigationConflictError:
                return "conflict"
            finally:
                close_old_connections()

        with ContextPropagatingThreadPoolExecutor(max_workers=2) as executor:
            outcomes = [
                future.result(timeout=15)
                for future in (
                    executor.submit(submit, uuid4(), "first"),
                    executor.submit(submit, uuid4(), "second"),
                )
            ]

        run.refresh_from_db()
        assert sorted(outcomes) == ["accepted", "conflict"]
        assert run.workflow_version == 2
        assert InvestigationOrchestrationCommand.objects.filter(orchestration_run=run).count() == 1


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
        assert self.orchestration_run.seer_run_id == self.seer_run_id

    def test_reconcile_projection_can_authoritatively_replace_state(self) -> None:
        self.orchestration_run.update(
            workflow_version=3,
            generation=3,
            phase="investigating",
        )
        block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            report_revision=1,
            stable_agent_key="stale-summary",
        )

        reconcile_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=self.projection(
                workflow_version=2,
                generation=2,
                phase="planning",
                report_revision=2,
                clear_intent={
                    "id": "clear-report-2",
                    "revision": 2,
                    "reason": "workflow_changed",
                    "requestedAt": "2025-01-01T00:00:00+00:00",
                    "completed": True,
                },
            ),
        )

        self.orchestration_run.refresh_from_db()
        block.refresh_from_db()
        assert self.orchestration_run.workflow_version == 2
        assert self.orchestration_run.generation == 2
        assert self.orchestration_run.phase == "planning"
        assert self.orchestration_run.last_event_sequence == 0
        assert self.orchestration_run.notebook_revision == 1
        assert block.deleted_at is not None

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

    def test_manual_title_override_survives_generated_title_events(self) -> None:
        self.investigation.title = "My incident title"
        self.investigation.save(update_fields=["title", "date_updated"])
        projection = self.orchestration_run.projection
        projection["_sentryControl"] = {
            "manualTitleOverride": True,
            "titleBuffer": "My incident title",
            "titleStarted": True,
        }
        self.orchestration_run.projection = projection
        self.orchestration_run.save(update_fields=["projection", "date_updated"])

        self.deliver(self.event(1, "report_clear", {"reportRevision": 1}))
        self.deliver(
            self.event(
                2,
                "title_delta",
                {"reportRevision": 1, "delta": "Generated title", "reset": True},
            )
        )
        self.deliver(
            self.event(
                3,
                "metadata_completed",
                {
                    "reportRevision": 1,
                    "title": "Final generated title",
                    "summary": "Root cause found",
                    "summaryDescription": "A release changed routing.",
                },
            )
        )

        self.investigation.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert self.investigation.title == "My incident title"
        assert self.investigation.summary == "Root cause found"
        assert self.orchestration_run.projection["report"]["metadata"]["title"] == (
            "My incident title"
        )

    def test_archive_generation_fence_survives_restore_until_a_new_generation(self) -> None:
        block = self.create_investigation_block(
            investigation=self.investigation,
            kind="text",
            report_revision=1,
            stable_agent_key="preserved-summary",
        )
        archived = archive_investigation_with_orchestration(
            investigation=self.investigation,
            expected_version=self.investigation.version,
            actor_id=self.user.id,
        )
        assert archived.status == InvestigationStatus.ARCHIVED
        delayed_projection = self.projection(
            workflow_version=2,
            generation=1,
            report_revision=2,
        )
        synchronize_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=delayed_projection,
        )
        block.refresh_from_db()
        assert block.deleted_at is None
        assert block.report_revision == 1
        restored = update_investigation_with_orchestration(
            investigation=archived,
            expected_version=archived.version,
            fields={"status": InvestigationStatus.ACTIVE},
            project_ids=None,
        )
        assert restored.status == InvestigationStatus.ACTIVE
        synchronize_orchestration_projection(
            orchestration_run_id=self.orchestration_run.id,
            seer_run_id=self.seer_run_id,
            projection=delayed_projection,
        )
        block.refresh_from_db()
        assert block.deleted_at is None
        assert block.report_revision == 1

        fenced = self.deliver(self.event(1, "report_clear", {"reportRevision": 1}, generation=1))
        assert fenced.application_status == InvestigationOrchestrationEventStatus.IGNORED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.notebook_revision == 0

        self.deliver(
            self.event(
                2,
                "workflow_updated",
                {
                    "projection": self.projection(
                        workflow_version=2,
                        generation=2,
                    )
                },
                generation=2,
            )
        )
        accepted = self.deliver(self.event(3, "report_clear", {"reportRevision": 1}, generation=2))

        assert accepted.application_status == InvestigationOrchestrationEventStatus.APPLIED
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.notebook_revision == 1

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

    def test_event_payload_database_integers_are_bounded(self) -> None:
        for key in ("workflowVersion", "generation"):
            projection = self.projection()
            projection[key] = I32_MAX + 1
            with pytest.raises(serializers.ValidationError):
                self.deliver(self.event(1, "workflow_updated", {"projection": projection}))
        with pytest.raises(serializers.ValidationError):
            self.deliver(self.event(1, "report_clear", {"reportRevision": I32_MAX + 1}))
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
                        "projectIds": [I64_MAX + 1],
                    },
                )
            )
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
                        "projectIds": [self.project.id],
                        "producingRunId": I64_MAX + 1,
                    },
                )
            )

        assert not InvestigationOrchestrationEvent.objects.exists()

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
            lambda projection: projection["report"].pop("metadata"),
            lambda projection: projection["report"].pop("notebookRevision"),
            lambda projection: projection.pop("heartbeatAt"),
            lambda projection: projection.update({"heartbeatAt": "not-a-timestamp"}),
            lambda projection: projection.update({"heartbeatAt": "2025-01-01T00:00:00"}),
        ]
        for mutate in mutations:
            projection = self.projection()
            mutate(projection)

            with pytest.raises(serializers.ValidationError):
                self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert not InvestigationOrchestrationEvent.objects.exists()

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

    def test_project_backed_evidence_requires_project_provenance(self) -> None:
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
                        "title": "Event without provenance",
                        "kind": "event",
                    }
                ],
                "toolActivity": [],
            }
        ]

        with pytest.raises(serializers.ValidationError):
            self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        assert not InvestigationOrchestrationEvent.objects.exists()

    def test_projection_accepts_visible_broad_scan_steps(self) -> None:
        projection = self.projection()
        projection["broadScan"]["toolActivity"] = [
            {
                "id": "step-1",
                "title": "Inspect the error spike",
                "kind": "step",
                "status": "queued",
            }
        ]

        self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["broadScan"]["toolActivity"] == [
            {
                "id": "step-1",
                "title": "Inspect the error spike",
                "kind": "step",
                "status": "queued",
            }
        ]

    def test_projection_accepts_report_query_tool_activity(self) -> None:
        projection = self.projection(report_status="composing")
        projection["report"]["currentBlockKey"] = "error-volume-chart"
        projection["report"]["currentBlockStatus"] = "running"
        projection["report"]["currentBlockToolActivity"] = [
            {
                "id": "query-call-1",
                "title": "Querying error volume by minute",
                "kind": "api",
                "status": "running",
            }
        ]

        self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["report"]["currentBlockToolActivity"] == [
            {
                "id": "query-call-1",
                "title": "Querying error volume by minute",
                "kind": "api",
                "status": "running",
            }
        ]

    def test_projection_accepts_initial_report_cancellation_fence(self) -> None:
        projection = self.projection(
            workflow_version=2,
            report_revision=1,
            report_status="waiting",
            clear_intent={
                "id": "clear-report-1",
                "revision": 1,
                "reason": "Report composition stalled",
                "requestedAt": "2025-01-01T00:00:00+00:00",
                "completed": False,
            },
        )
        projection["cancellationIntents"] = [
            {
                "id": "cancel-initial-report",
                "scope": "report",
                "targetId": "0",
                "childRunId": None,
                "generation": 0,
                "reason": "Report composition stalled",
                "requestedAt": "2025-01-01T00:00:00+00:00",
                "completed": False,
            }
        ]

        self.deliver(self.event(1, "workflow_updated", {"projection": projection}))

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.projection["cancellationIntents"][0]["generation"] == 0
