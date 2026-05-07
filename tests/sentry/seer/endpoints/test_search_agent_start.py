from unittest.mock import Mock, patch

from sentry.seer.endpoints.search_agent_start import start_search_agent_via_outbox
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SearchAgentStartRequest, SeerViewerContext
from sentry.testutils.cases import TestCase


class StartSearchAgentViaOutboxTest(TestCase):
    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_creates_run_and_returns_run_id_after_outbox_drain(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 7}))
        body = SearchAgentStartRequest(
            org_id=self.organization.id,
            org_slug=self.organization.slug,
            project_ids=[self.project.id],
            natural_language_query="errors today",
            strategy="Issues",
        )
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        run_id = start_search_agent_via_outbox(
            organization=self.organization,
            user_id=self.user.id,
            body=body,
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
