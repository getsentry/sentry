from __future__ import annotations

import threading
from unittest import mock
from uuid import UUID, uuid4

import orjson
import pytest
from django.db import IntegrityError, close_old_connections
from django.test import override_settings
from django.utils import timezone
from rest_framework import serializers

from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.models import (
    Investigation,
    InvestigationBlockDependency,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationRun,
    InvestigationProject,
    InvestigationSourceType,
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
    create_agentic_manual_investigation,
    get_orchestration_projection,
)
from sentry.investigations.services.orchestration_events import (
    MAX_ORCHESTRATION_EVENT_BYTES,
    deliver_orchestration_event,
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
