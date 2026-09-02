from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationRun,
    InvestigationStatus,
)
from sentry.investigations.services.orchestration import create_agentic_manual_investigation
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationOrchestrationTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def create_agentic(self) -> tuple[Investigation, InvestigationOrchestrationRun]:
        return create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Agentic",
            source={"type": "manual", "prompt": "Investigate checkout latency"},
            project_ids=[self.project.id],
            filters={},
        )

    def orchestration_url(self, investigation_id: int | str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation_id,
            },
        )

    def test_returns_the_projection_written_at_creation(self) -> None:
        investigation, run = self.create_agentic()

        response = self.client.get(self.orchestration_url(investigation.id))

        assert response.status_code == 200, response.data
        assert response.data["investigationId"] == str(investigation.id)
        assert response.data["runId"] is None
        assert response.data["sourceType"] == "manual"
        assert response.data["phase"] == "broad_scan"
        assert response.data["status"] == "pending"
        assert response.data["workflowVersion"] == 1
        assert response.data["generation"] == 1
        assert response.data["notebookRevision"] == 0
        assert response.data["heartbeatAt"] is None
        assert response.data["updatedAt"] == run.date_updated
        assert response.data["hypotheses"] == []
        assert response.data["broadScan"]["status"] == "queued"
        assert response.data["pendingInput"] is None
        assert response.data["report"]["revision"] == 0
        assert response.data["report"]["notebookRevision"] == 0

    def test_prefers_the_run_columns_over_the_stored_projection(self) -> None:
        investigation, run = self.create_agentic()
        heartbeat = timezone.now()
        # The stored projection keeps its creation-time scalars; the columns move on.
        run.update(
            phase="investigating",
            status="processing",
            workflow_version=3,
            generation=2,
            notebook_revision=7,
            heartbeat_at=heartbeat,
        )
        assert run.projection["phase"] == "broad_scan"
        assert run.projection["workflowVersion"] == 1

        response = self.client.get(self.orchestration_url(investigation.id))

        assert response.status_code == 200, response.data
        assert response.data["phase"] == "investigating"
        assert response.data["status"] == "processing"
        assert response.data["workflowVersion"] == 3
        assert response.data["generation"] == 2
        assert response.data["notebookRevision"] == 7
        assert response.data["heartbeatAt"] == heartbeat
        # The report's notebook revision is overlaid too, not just the top-level one.
        assert response.data["report"]["notebookRevision"] == 7

    def test_awaiting_input_run_reports_its_missing_fields(self) -> None:
        investigation, _ = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Agentic",
            source={"type": "manual"},
            project_ids=[self.project.id],
            filters={},
        )

        response = self.client.get(self.orchestration_url(investigation.id))

        assert response.status_code == 200, response.data
        assert response.data["phase"] == "intake"
        assert response.data["status"] == "awaiting_input"
        assert response.data["pendingInput"]["missingFields"] == ["prompt"]
        assert response.data["broadScan"]["status"] == "blocked"

    def test_reports_seers_run_id_once_seer_accepts_the_run(self) -> None:
        investigation, run = self.create_agentic()
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=4242)
        run.update(seer_run=seer_run)

        response = self.client.get(self.orchestration_url(investigation.id))

        assert response.status_code == 200, response.data
        assert response.data["runId"] == "4242"
        assert response.data["runId"] != str(seer_run.id)

    def test_reports_no_run_id_while_the_seer_run_is_still_mirroring(self) -> None:
        investigation, run = self.create_agentic()
        run.update(seer_run=self.create_seer_run(organization=self.organization))

        response = self.client.get(self.orchestration_url(investigation.id))

        assert response.status_code == 200, response.data
        assert response.data["runId"] is None

    def test_returns_not_found_for_an_investigation_without_a_run(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Manual"
        )

        assert self.client.get(self.orchestration_url(investigation.id)).status_code == 404

    def test_returns_not_found_for_an_unknown_investigation(self) -> None:
        assert self.client.get(self.orchestration_url(2**32)).status_code == 404


@with_feature(FEATURE)
class OrganizationInvestigationOrchestrationCommandsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation, self.orchestration_run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Agentic",
            source={"type": "manual", "prompt": "Investigate checkout latency"},
            project_ids=[self.project.id],
            filters={},
        )
        self.command_url = self.commands_url(self.investigation.id)

    def commands_url(self, investigation_id: int | str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation_id,
            },
        )

    def command(self, **overrides: Any) -> dict[str, Any]:
        body: dict[str, Any] = {
            "requestId": str(uuid4()),
            "expectedWorkflowVersion": 1,
            "command": {
                "type": "add_hypothesis",
                "statement": "A recent release caused the regression",
                "rationale": "The timing overlaps",
            },
        }
        body.update(overrides)
        return body

    def test_accepts_a_command_and_advances_the_workflow_version(self) -> None:
        body = self.command()

        response = self.client.post(self.command_url, data=body, format="json")

        assert response.status_code == 200, response.data
        assert response.data["requestId"] == body["requestId"]
        assert response.data["accepted"] is True
        assert response.data["duplicate"] is False
        assert response.data["workflowVersion"] == 2
        assert response.data["projection"]["workflowVersion"] == 2
        stored = InvestigationOrchestrationCommand.objects.get(request_id=body["requestId"])
        assert stored.type == "add_hypothesis"
        assert stored.actor_id == self.user.id
        assert stored.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        assert stored.expected_workflow_version == 1
        assert stored.resulting_workflow_version == 2
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 2
        # Persisting a command must not touch the notebook.
        assert not self.investigation.blocks.exists()

    def test_stores_the_payload_with_its_wire_casing(self) -> None:
        body = self.command(
            command={"type": "steer", "target": "block", "targetId": "b-1", "instruction": "Focus"}
        )

        response = self.client.post(self.command_url, data=body, format="json")

        assert response.status_code == 200, response.data
        stored = InvestigationOrchestrationCommand.objects.get(request_id=body["requestId"])
        # The payload is forwarded to Seer verbatim, so its keys must not be rewritten.
        assert stored.payload == {"target": "block", "targetId": "b-1", "instruction": "Focus"}

    def test_replaying_a_request_id_returns_the_original_acceptance(self) -> None:
        body = self.command()
        first = self.client.post(self.command_url, data=body, format="json")
        assert first.status_code == 200, first.data

        replay = self.client.post(self.command_url, data=body, format="json")

        assert replay.status_code == 200, replay.data
        assert replay.data["duplicate"] is True
        assert replay.data["workflowVersion"] == 2
        assert InvestigationOrchestrationCommand.objects.count() == 1

    def test_reusing_a_request_id_for_a_different_command_conflicts(self) -> None:
        body = self.command()
        assert self.client.post(self.command_url, data=body, format="json").status_code == 200
        changed = self.command(requestId=body["requestId"])
        changed["command"]["statement"] = "A database lock caused the regression"

        response = self.client.post(self.command_url, data=changed, format="json")

        assert response.status_code == 409
        assert InvestigationOrchestrationCommand.objects.count() == 1

    def test_rejects_a_stale_workflow_version(self) -> None:
        assert (
            self.client.post(self.command_url, data=self.command(), format="json").status_code
            == 200
        )

        response = self.client.post(
            self.command_url, data=self.command(expectedWorkflowVersion=1), format="json"
        )

        assert response.status_code == 409
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 2
        assert InvestigationOrchestrationCommand.objects.count() == 1

    def test_rejects_an_unsupported_command_type(self) -> None:
        response = self.client.post(
            self.command_url, data=self.command(command={"type": "explode"}), format="json"
        )

        assert response.status_code == 400
        assert not InvestigationOrchestrationCommand.objects.exists()

    def test_archived_investigation_rejects_commands_without_advancing_the_run(self) -> None:
        self.investigation.update(status=InvestigationStatus.ARCHIVED)

        response = self.client.post(self.command_url, data=self.command(), format="json")

        assert response.status_code == 400
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 1
        assert not self.orchestration_run.commands.exists()

    def test_returns_not_found_for_an_investigation_without_a_run(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Manual"
        )

        response = self.client.post(
            self.commands_url(investigation.id), data=self.command(), format="json"
        )

        assert response.status_code == 404

    def test_requires_an_authenticated_user(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        response = self.client.post(self.command_url, data=self.command(), format="json")

        assert response.status_code in {401, 403}
        assert not InvestigationOrchestrationCommand.objects.exists()
