from __future__ import annotations

from copy import deepcopy
from typing import Any
from unittest import mock
from uuid import uuid4

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationRun,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.orchestration_events import deliver_orchestration_event
from sentry.investigations.templates.types import (
    InvestigationTemplateSpec,
    TemplateBlockSpec,
)
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationIndexTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @mock.patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_create_manual_and_list(self, metrics_count: mock.MagicMock) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout follow-up",
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == "Checkout follow-up"
        assert response.data["projectIds"] == [self.project.id]
        assert response.data["blocks"] == []
        metrics_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "manual", "template": "manual"},
        )

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["blockCount"] == 0
        assert response.data[0]["isFavorited"] is False
        assert response.data[0]["mode"] == "manual"

    def test_create_agentic_investigation_and_get_orchestration(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "mode": "agentic",
                "source": {"type": "manual", "seed": {"query": "is:unresolved"}},
                "projectIds": [self.project.id],
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["title"] == "Untitled investigation"
        assert response.data["mode"] == "agentic"
        assert response.data["source"]["type"] == "manual"
        assert response.data["blocks"] == []

        orchestration_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": response.data["id"],
            },
        )
        orchestration = self.client.get(orchestration_url)

        assert orchestration.status_code == 200, orchestration.data
        assert orchestration.data["runId"] is None
        assert orchestration.data["investigationId"] == response.data["id"]
        assert orchestration.data["workflowVersion"] == 1
        assert orchestration.data["phase"] == "intake"
        assert orchestration.data["status"] == "awaiting_input"
        assert orchestration.data["broadScan"]["status"] == "blocked"
        assert orchestration.data["pendingInput"]["missingFields"] == [
            "prompt",
            "time_range",
        ]
        assert orchestration.data["notebookRevision"] == 0
        assert orchestration.data["report"]["notebookRevision"] == 0
        assert orchestration.data["updatedAt"] is not None

    def test_agentic_creation_uses_complete_manual_context(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "mode": "agentic",
                "title": "API latency",
                "projectIds": [self.project.id],
                "source": {
                    "type": "manual",
                    "prompt": "Investigate the API latency regression",
                    "timeRange": {
                        "start": "2025-01-01T00:00:00Z",
                        "end": "2025-01-01T01:00:00Z",
                    },
                    "seed": {"futureField": {"isAllowed": True}},
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

        orchestration_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": response.data["id"],
            },
        )
        orchestration = self.client.get(orchestration_url)
        assert orchestration.data["phase"] == "broad_scan"
        assert orchestration.data["status"] == "pending"
        assert orchestration.data["broadScan"]["status"] == "queued"
        assert orchestration.data["pendingInput"] is None
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        assert run.source["projectScope"] == {"type": "investigation"}
        linked_project_ids = list(
            Investigation.objects.get(id=response.data["id"])
            .projects.order_by("id")
            .values_list("id", flat=True)
        )
        assert linked_project_ids == response.data["projectIds"]
        assert linked_project_ids == [self.project.id]
        assert "projectIds" not in response.data["source"]

    def test_agentic_creation_normalizes_untrusted_manual_source_for_seer(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "mode": "agentic",
                "source": {
                    "type": "manual",
                    "prompt": "Investigate checkout failures",
                    "seed": {"futureField": {"isAllowed": True}},
                    "projectIds": [99_999_999],
                    "projectScope": {"type": "caller_controlled"},
                    "futureTopLevelField": "do not forward",
                },
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        assert run.source == {
            "type": "manual",
            "prompt": "Investigate checkout failures",
            "seed": {"futureField": {"isAllowed": True}},
            "projectScope": {"type": "investigation"},
        }

    def test_agentic_creation_rejects_invalid_manual_time_range(self) -> None:
        invalid_ranges = [
            {"start": 1, "end": "2025-01-01T01:00:00Z"},
            {"start": "2025-01-01T00:00:00", "end": "2025-01-01T01:00:00"},
            {"start": "2025-01-01T01:00:00Z", "end": "2025-01-01T00:00:00Z"},
            {
                "start": "2025-01-01T00:00:00Z",
                "end": "2025-01-01T01:00:00Z",
                "timezone": "UTC",
            },
        ]

        for time_range in invalid_ranges:
            with self.subTest(time_range=time_range):
                response = self.client.post(
                    self.collection_url,
                    data={
                        "mode": "agentic",
                        "source": {
                            "type": "manual",
                            "seed": {},
                            "timeRange": time_range,
                        },
                    },
                    format="json",
                )

                assert response.status_code == 400, response.data

        assert not Investigation.objects.filter(source__type="manual").exists()

    def test_agentic_manual_scope_is_hidden_from_a_viewer_missing_one_project(self) -> None:
        self.create_project(organization=self.organization, teams=[self.team])
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        assert creation.status_code == 201, creation.data
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": creation.data["id"],
            },
        )
        orchestration_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": creation.data["id"],
            },
        )
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member", teams=[])
        self.login_as(viewer)

        assert self.client.get(detail_url).status_code == 403
        assert self.client.get(orchestration_url).status_code == 403
        listed = self.client.get(self.collection_url)
        assert listed.status_code == 200
        assert creation.data["id"] not in {item["id"] for item in listed.data}

    def test_agentic_creation_rejects_inaccessible_source_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)

        response = self.client.post(
            self.collection_url,
            data={
                "mode": "agentic",
                "source": {
                    "type": "breached_metric",
                    "projectIds": [other_project.id],
                    "seed": {},
                },
            },
            format="json",
        )

        assert response.status_code == 400
        assert not Investigation.objects.filter(source__type="breached_metric").exists()

    def test_agentic_creation_rejects_oversized_prompt_context(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "mode": "agentic",
                "source": {"type": "manual", "prompt": "x" * 20_001, "seed": {}},
            },
            format="json",
        )

        assert response.status_code == 400
        assert not Investigation.objects.filter(source__type="manual").exists()

    def test_orchestration_get_is_scoped_and_legacy_is_not_found(self) -> None:
        legacy = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Legacy"
        )
        legacy_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": legacy.id,
            },
        )
        assert self.client.get(legacy_url).status_code == 404

        other_organization = self.create_organization(owner=self.user)
        foreign = self.create_investigation(
            organization=other_organization, created_by=self.user, title="Foreign"
        )
        self.create_investigation_orchestration_run(
            investigation=foreign, source={"type": "manual"}
        )
        foreign_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": foreign.id,
            },
        )
        assert self.client.get(foreign_url).status_code == 404

    def test_accept_agentic_command_is_idempotent_and_versioned(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": creation.data["id"],
            },
        )
        request_id = str(uuid4())
        command: dict[str, Any] = {
            "requestId": request_id,
            "expectedWorkflowVersion": 1,
            "command": {
                "type": "add_hypothesis",
                "statement": "A recent release caused the regression",
                "rationale": "The timing overlaps",
            },
        }

        response = self.client.post(command_url, data=command, format="json")

        assert response.status_code == 200, response.data
        assert response.data["requestId"] == request_id
        assert response.data["accepted"] is True
        assert response.data["duplicate"] is False
        assert response.data["workflowVersion"] == 2
        assert response.data["projection"]["workflowVersion"] == 2
        stored = InvestigationOrchestrationCommand.objects.get(request_id=request_id)
        assert stored.actor_id == self.user.id
        assert stored.type == "add_hypothesis"
        assert stored.payload == {
            "statement": "A recent release caused the regression",
            "rationale": "The timing overlaps",
        }
        assert stored.resulting_workflow_version == 2

        duplicate = self.client.post(command_url, data=command, format="json")
        assert duplicate.status_code == 200, duplicate.data
        assert duplicate.data["duplicate"] is True
        assert duplicate.data["workflowVersion"] == 2
        assert InvestigationOrchestrationCommand.objects.filter(request_id=request_id).count() == 1

        changed = deepcopy(command)
        changed["command"]["statement"] = "A database lock caused the regression"
        conflict = self.client.post(command_url, data=changed, format="json")
        assert conflict.status_code == 409

        stale = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "cancel"},
            },
            format="json",
        )
        assert stale.status_code == 409
        assert InvestigationOrchestrationCommand.objects.count() == 1

    def test_archived_agentic_investigation_rejects_new_commands(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        investigation = Investigation.objects.get(id=creation.data["id"])
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )
        archived = self.client.delete(
            detail_url,
            data={"investigationVersion": creation.data["version"]},
            format="json",
        )
        assert archived.status_code == 204
        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        rejected = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": run.workflow_version,
                "command": {
                    "type": "add_hypothesis",
                    "statement": "Do not run this",
                },
            },
            format="json",
        )

        assert rejected.status_code == 400
        assert rejected.data == {"detail": "Archived investigations are read-only."}
        assert InvestigationOrchestrationCommand.objects.filter(orchestration_run=run).count() == 1

    def test_hypothesis_change_clears_notebook_before_dispatch_and_reload(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        investigation = Investigation.objects.get(id=creation.data["id"])
        self.create_investigation_block(
            investigation=investigation,
            position=0,
            kind="text",
            content="Stale report",
        )
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        with mock.patch(
            "sentry.investigations.services.orchestration.transaction.on_commit"
        ) as schedule:
            response = self.client.post(
                command_url,
                data={
                    "requestId": str(uuid4()),
                    "expectedWorkflowVersion": 1,
                    "command": {
                        "type": "add_hypothesis",
                        "statement": "A release caused the regression",
                    },
                },
                format="json",
            )

        assert response.status_code == 200, response.data
        schedule.assert_called_once()
        assert response.data["projection"]["notebookRevision"] == 1
        assert not InvestigationBlock.objects.filter(
            investigation=investigation,
            deleted_at__isnull=True,
        ).exists()
        detail = self.client.get(
            reverse(
                "sentry-api-0-organization-investigation-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "investigation_id": investigation.id,
                },
            )
        )
        assert detail.status_code == 200
        assert detail.data["blocks"] == []
        orchestration = self.client.get(command_url.removesuffix("commands/"))
        assert orchestration.data["notebookRevision"] == 1

        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)
        delivered = deliver_orchestration_event(
            organization_id=self.organization.id,
            event={
                "schema_version": 1,
                "event_id": uuid4(),
                "run_id": 99,
                "investigation_id": investigation.id,
                "sequence": 1,
                "generation": 1,
                "type": "report_clear",
                "payload": {"reportRevision": 1},
            },
        )
        assert delivered.notebook_revision == 1
        run.refresh_from_db()
        assert run.notebook_revision == 1

    def test_immediate_clear_cancels_execution_and_fences_old_report_events(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        investigation = Investigation.objects.get(id=creation.data["id"])
        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)

        def deliver(sequence: int, event_type: str, payload: dict[str, Any]):
            return deliver_orchestration_event(
                organization_id=self.organization.id,
                event={
                    "schema_version": 1,
                    "event_id": uuid4(),
                    "run_id": 99,
                    "investigation_id": investigation.id,
                    "sequence": sequence,
                    "generation": 1,
                    "type": event_type,
                    "payload": payload,
                },
            )

        deliver(1, "report_clear", {"reportRevision": 1})
        deliver(
            2,
            "report_block_started",
            {
                "reportRevision": 1,
                "stableAgentKey": "stale-partial",
                "position": 0,
                "kind": "text",
                "title": "Partial",
                "projectIds": [self.project.id],
            },
        )
        execution = InvestigationBlockExecution.objects.get(
            block__orchestration_run=run,
            block__stable_agent_key="stale-partial",
        )
        assert execution.status == InvestigationBlockExecutionStatus.RUNNING

        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )
        with mock.patch("sentry.investigations.services.orchestration.transaction.on_commit"):
            response = self.client.post(
                command_url,
                data={
                    "requestId": str(uuid4()),
                    "expectedWorkflowVersion": 1,
                    "command": {
                        "type": "add_hypothesis",
                        "statement": "A release caused the regression",
                    },
                },
                format="json",
            )

        assert response.status_code == 200, response.data
        execution.refresh_from_db()
        run.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert execution.completed_at is not None
        assert run.projection["_sentryControl"]["clearAwaitingSeer"] is True
        assert run.projection["_sentryControl"]["clearAwaitingSeerThroughRevision"] == 1

        stale_events = [
            deliver(
                3,
                "report_text_delta",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "stale-partial",
                    "delta": "must not survive",
                },
            ),
            deliver(
                4,
                "report_block_started",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "stale-start",
                    "position": 0,
                    "kind": "text",
                    "title": "Stale start",
                    "projectIds": [self.project.id],
                },
            ),
            deliver(
                5,
                "report_block_upserted",
                {
                    "reportRevision": 1,
                    "stableAgentKey": "stale-upsert",
                    "position": 0,
                    "kind": "text",
                    "title": "Stale upsert",
                    "content": "must not survive",
                    "projectIds": [self.project.id],
                },
            ),
        ]
        assert all(
            delivered.event.application_status == InvestigationOrchestrationEventStatus.IGNORED
            for delivered in stale_events
        )
        assert not InvestigationBlock.objects.filter(
            investigation=investigation,
            deleted_at__isnull=True,
        ).exists()
        assert not InvestigationBlockExecution.objects.filter(
            block__investigation=investigation,
            status=InvestigationBlockExecutionStatus.RUNNING,
        ).exists()

        clear = deliver(6, "report_clear", {"reportRevision": 2})
        assert clear.event.application_status == InvestigationOrchestrationEventStatus.APPLIED
        run.refresh_from_db()
        assert "clearAwaitingSeer" not in run.projection["_sentryControl"]
        assert "clearAwaitingSeerThroughRevision" not in run.projection["_sentryControl"]

        started = deliver(
            7,
            "report_block_started",
            {
                "reportRevision": 2,
                "stableAgentKey": "fresh",
                "position": 0,
                "kind": "text",
                "title": "Fresh",
                "projectIds": [self.project.id],
            },
        )
        assert started.event.application_status == InvestigationOrchestrationEventStatus.APPLIED
        assert InvestigationBlock.objects.filter(
            investigation=investigation,
            stable_agent_key="fresh",
            deleted_at__isnull=True,
        ).exists()

    def test_report_steering_preserves_blocks_and_unknown_hypothesis_is_rejected(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        investigation = Investigation.objects.get(id=creation.data["id"])
        block = self.create_investigation_block(
            investigation=investigation,
            position=0,
            kind="text",
            content="Keep this report block",
        )
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {
                    "type": "steer",
                    "target": "report",
                    "instruction": "Add release evidence",
                },
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        block.refresh_from_db()
        assert block.deleted_at is None

        unknown = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 2,
                "command": {
                    "type": "retry",
                    "target": "hypothesis",
                    "targetId": "missing",
                },
            },
            format="json",
        )
        assert unknown.status_code == 400
        block.refresh_from_db()
        assert block.deleted_at is None
        run = InvestigationOrchestrationRun.objects.get(investigation=investigation)
        assert run.workflow_version == 2

    def test_workflow_steering_and_report_retry_clear_notebook_immediately(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        investigation = Investigation.objects.get(id=creation.data["id"])
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        commands = [
            {
                "type": "steer",
                "target": "workflow",
                "instruction": "Reconsider the initial scan",
            },
            {"type": "retry", "target": "report"},
        ]
        expected_workflow_version = 1
        expected_notebook_revision = 0
        for command in commands:
            with self.subTest(command=command):
                self.create_investigation_block(
                    investigation=investigation,
                    position=0,
                    kind="text",
                    content="Partial report",
                )
                response = self.client.post(
                    command_url,
                    data={
                        "requestId": str(uuid4()),
                        "expectedWorkflowVersion": expected_workflow_version,
                        "command": command,
                    },
                    format="json",
                )

                assert response.status_code == 200, response.data
                expected_workflow_version += 1
                expected_notebook_revision += 1
                assert response.data["projection"]["notebookRevision"] == (
                    expected_notebook_revision
                )
                assert not InvestigationBlock.objects.filter(
                    investigation=investigation,
                    deleted_at__isnull=True,
                ).exists()

    def test_rejects_invalid_agentic_command_without_mutating_version(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": creation.data["id"],
            },
        )

        response = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "steer", "target": "hypothesis"},
            },
            format="json",
        )

        assert response.status_code == 400
        orchestration_url = command_url.removesuffix("commands/")
        assert self.client.get(orchestration_url).data["workflowVersion"] == 1
        assert not InvestigationOrchestrationCommand.objects.exists()

    def test_rejects_oversized_hypothesis_command(self) -> None:
        creation = self.client.post(
            self.collection_url,
            data={"mode": "agentic", "source": {"type": "manual", "seed": {}}},
            format="json",
        )
        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": creation.data["id"],
            },
        )

        response = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "add_hypothesis", "statement": "x" * 301},
            },
            format="json",
        )

        assert response.status_code == 400
        assert not InvestigationOrchestrationCommand.objects.exists()

    def test_list_includes_summary_when_projects_are_accessible(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Checkout errors",
            summary="Errors crossed alert threshold",
            summary_description="Checkout errors increased.\nReview the latest release.",
        )
        self.create_investigation_project(investigation=investigation, project=self.project)

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = next(item for item in response.data if item["id"] == str(investigation.id))
        assert listed["summary"] == "Errors crossed alert threshold"
        assert listed["summaryDescription"] == (
            "Checkout errors increased.\nReview the latest release."
        )

    def test_regular_member_can_create_an_investigation(self) -> None:
        member_user = self.create_user()
        self.create_member(organization=self.organization, user=member_user, role="member")
        self.login_as(member_user)

        response = self.client.post(
            self.collection_url,
            data={"title": "Created by member"},
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["createdBy"] == str(member_user.id)

    def test_manual_creation_rejects_inaccessible_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        response = self.client.post(
            self.collection_url,
            data={"title": "No access", "projectIds": [other_project.id]},
            format="json",
        )
        assert response.status_code == 400
        assert not Investigation.objects.filter(title="No access").exists()

    def test_template_validation_is_strict_and_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {"unexpected": True},
            },
            format="json",
        )
        assert response.status_code == 400
        assert "parameters" in response.data
        assert Investigation.objects.count() == before

    def test_unknown_template_version_is_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 999,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_cyclic_template_rolls_back_before_source_resolution(self) -> None:
        template = InvestigationTemplateSpec(
            key="cyclic",
            version=1,
            source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
            parameters=(),
            blocks=(
                TemplateBlockSpec(key="one", kind="text", title="One", dependencies=("two",)),
                TemplateBlockSpec(key="two", kind="text", title="Two", dependencies=("one",)),
            ),
        )
        before = Investigation.objects.count()
        with mock.patch(
            "sentry.investigations.services.investigations.get_investigation_template",
            return_value=template,
        ):
            response = self.client.post(
                self.collection_url,
                data={
                    "templateKey": "cyclic",
                    "templateVersion": 1,
                    "source": {"type": "metric_open_period", "ref": {"groupId": "1"}},
                    "parameters": {},
                },
                format="json",
            )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_template_rejects_wrong_issue_category(self) -> None:
        group = self.create_group(project=self.project)
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": str(group.id), "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 404

    def test_source_lineage_lists_latest_and_keeps_historical_detail(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source": {"type": "issue", "ref": {"groupId": "123"}},
            "source_type": "issue",
            "source_ref": {"groupId": "123"},
            "source_key": "issue:123",
            "lineage_key": "issue:123",
        }
        first = self.create_investigation(
            title="First revision",
            source_revision=1,
            status=InvestigationStatus.ARCHIVED,
            **lineage,
        )
        second = self.create_investigation(
            title="Second revision", source_revision=2, status=InvestigationStatus.ACTIVE, **lineage
        )

        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(second.id)]

        first_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first.id,
            },
        )
        assert self.client.get(first_url).status_code == 200

        second_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": second.id,
            },
        )
        assert (
            self.client.delete(
                second_url,
                data={"investigationVersion": second.version},
                format="json",
            ).status_code
            == 204
        )
        assert not Investigation.objects.filter(
            lineage_key="issue:123", status=InvestigationStatus.ACTIVE
        ).exists()

        third = self.create_investigation(
            title="Third revision", source_revision=3, status=InvestigationStatus.ACTIVE, **lineage
        )
        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(third.id)]

    def test_legacy_only_lineage_lists_only_the_latest_revision(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source_type": InvestigationSourceType.BREACHED_METRIC,
            "source_ref": {"groupId": "123", "openPeriodId": "456"},
            "source_key": "legacy-lineage",
            "status": InvestigationStatus.ARCHIVED,
        }
        self.create_investigation(title="First revision", source_revision=1, **lineage)
        second = self.create_investigation(title="Second revision", source_revision=2, **lineage)

        response = self.client.get(self.collection_url, {"status": "archived"})

        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(second.id)]

    def test_org_auth_token_can_list_investigations(self) -> None:
        self.create_investigation(
            organization=self.organization, created_by=self.user, title="Listed"
        )
        token = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token",
                token_hashed=hash_token(token),
                token_last_characters=token[-4:],
                scope_list=["org:read"],
                date_last_used=None,
            )
            self.client.logout()

        response = self.client.get(self.collection_url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200, response.data
        assert [item["title"] for item in response.data] == ["Listed"]
        assert response.data[0]["isFavorited"] is False
