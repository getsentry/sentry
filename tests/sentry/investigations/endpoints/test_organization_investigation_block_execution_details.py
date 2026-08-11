from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
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
