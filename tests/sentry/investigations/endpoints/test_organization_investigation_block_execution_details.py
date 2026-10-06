from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
)
from sentry.investigations.services import (
    mark_block_execution_cancelled,
    mark_block_execution_resumed,
    mark_block_execution_stopping,
)
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationBlockExecutionDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Query execution",
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.block = self.create_investigation_block(
            investigation=self.investigation,
            kind="query",
            prompt="Show unresolved errors over the last day",
            display={"type": "table"},
        )

    def execution_url(self, execution: InvestigationBlockExecution) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-block-execution-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": self.block.id,
                "execution_id": execution.id,
            },
        )

    def awaiting_input_execution(self) -> InvestigationBlockExecution:
        seer_run = self.create_seer_run(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=77,
        )
        return self.create_investigation_block_execution(
            block=self.block,
            seer_run=seer_run,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.AWAITING_INPUT,
            block_version=self.block.version,
            input_snapshot={"projectIds": [self.project.id]},
        )

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_execution_details."
        "make_agent_update_request"
    )
    def test_resume_forwards_the_user_response_and_marks_it_running(
        self, mock_update: MagicMock
    ) -> None:
        mock_update.return_value.status = 200
        execution = self.awaiting_input_execution()

        response = self.client.patch(
            self.execution_url(execution),
            data={"inputId": "clarify-1", "responseData": "the checkout project"},
            format="json",
        )

        assert response.status_code == 202
        payload = mock_update.call_args.args[0]
        assert payload["payload"] == {
            "type": "user_input_response",
            "input_id": "clarify-1",
            "response_data": "the checkout project",
        }
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.RUNNING

    def test_resume_rejects_a_body_without_an_input_id(self) -> None:
        execution = self.awaiting_input_execution()

        response = self.client.patch(
            self.execution_url(execution),
            data={"responseData": "the checkout project"},
            format="json",
        )

        assert response.status_code == 400
        assert "inputId" in response.data

    @patch(
        "sentry.investigations.endpoints.organization_investigation_block_execution_details."
        "interrupt_run"
    )
    def test_stop_reaches_a_terminal_status_even_when_the_interrupt_fails(
        self, interrupt_run: MagicMock
    ) -> None:
        # A stopping execution counts as in flight, so it would block the block for good.
        interrupt_run.side_effect = RuntimeError("Unable to stop the agent run")
        execution = self.awaiting_input_execution()

        response = self.client.delete(self.execution_url(execution))

        # The caller still sees the upstream failure, but the row is not left in flight.
        assert response.status_code == 500
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert execution.completed_at is not None

    @patch("sentry.investigations.services.executions.record_execution_cancelled")
    def test_stop_closes_a_pending_execution_that_never_reached_seer(
        self, record_cancelled: MagicMock
    ) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.PENDING,
            block_version=self.block.version,
            input_snapshot={"projectIds": [self.project.id]},
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.execution_url(execution))

        assert response.status_code == 204
        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.CANCELLED
        record_cancelled.assert_called_once_with(execution, reason="user_requested")

    def test_resume_does_not_revive_a_finished_execution(self) -> None:
        execution = self.awaiting_input_execution()
        execution.update(status=InvestigationBlockExecutionStatus.COMPLETED)

        assert not mark_block_execution_resumed(execution)

        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED

    def test_stop_does_not_overwrite_a_concurrent_completion(self) -> None:
        execution = self.awaiting_input_execution()
        execution.update(status=InvestigationBlockExecutionStatus.COMPLETED)

        assert not mark_block_execution_stopping(execution)
        assert not mark_block_execution_cancelled(execution)

        execution.refresh_from_db()
        assert execution.status == InvestigationBlockExecutionStatus.COMPLETED

    def test_investigations_feature_is_required_for_run_state_and_title(self) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.PENDING,
            block_version=self.block.version,
            input_snapshot={"projectIds": [self.project.id]},
        )
        execution_url = reverse(
            "sentry-api-0-organization-investigation-block-execution-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
                "block_id": self.block.id,
                "execution_id": execution.id,
            },
        )
        title_url = reverse(
            "sentry-api-0-organization-investigation-title-generation",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        with self.feature({FEATURE: False}):
            assert self.client.get(execution_url).status_code == 404
            assert self.client.patch(execution_url, data={}, format="json").status_code == 404
            assert self.client.delete(execution_url).status_code == 404
            assert self.client.get(title_url).status_code == 404
