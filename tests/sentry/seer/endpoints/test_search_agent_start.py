from unittest.mock import Mock, patch

from sentry.seer.endpoints.search_agent_start import send_search_agent_start_request
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase


class SendSearchAgentStartRequestTest(TestCase):
    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_outbox_path_creates_run_and_returns_run_id(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 7}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with self.feature("organizations:seer-run-mirror"):
            run_id = send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                strategy="Issues",
                viewer_context=viewer_context,
            )

        assert run_id == 7

        run = SeerRun.objects.get(organization_id=self.organization.id)
        assert run.type == SeerRunType.ASSISTED_QUERY
        assert run.mirror_status == SeerRunMirrorStatus.LIVE
        assert run.seer_run_state_id == 7
        assert run.user_id == self.user.id

        sent_body = mock_request.call_args[0][0]
        assert sent_body["natural_language_query"] == "errors today"
        assert sent_body["external_idempotency_key"] == str(run.uuid)
