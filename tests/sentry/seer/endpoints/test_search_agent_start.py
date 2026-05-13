from unittest.mock import Mock, patch

import pytest

from sentry.seer.endpoints.search_agent_start import send_search_agent_start_request
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase


class SendSearchAgentStartRequestTest(TestCase):
    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_outbox_path_creates_run_and_flushes(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with self.feature("organizations:seer-run-mirror"):
            result = send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                strategy="Issues",
                viewer_context=viewer_context,
            )

        assert isinstance(result, SeerRun)
        assert result.type == SeerRunType.ASSISTED_QUERY
        assert result.mirror_status == SeerRunMirrorStatus.LIVE
        assert result.seer_run_state_id == 42
        assert result.user_id == self.user.id
        mock_request.assert_called_once()
        sent_body = mock_request.call_args[0][0]
        assert sent_body["natural_language_query"] == "errors today"

    def test_outbox_flush_error_raises(self) -> None:
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with self.feature("organizations:seer-run-mirror"):
            with pytest.raises(SeerApiError):
                send_search_agent_start_request(
                    organization=self.organization,
                    user_id=self.user.id,
                    project_ids=[self.project.id],
                    natural_language_query="errors today",
                    viewer_context=viewer_context,
                )

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_terminal_seer_failure_raises(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=400, json=Mock(return_value={}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with self.feature("organizations:seer-run-mirror"):
            with pytest.raises(SeerApiError):
                send_search_agent_start_request(
                    organization=self.organization,
                    user_id=self.user.id,
                    project_ids=[self.project.id],
                    natural_language_query="errors today",
                    viewer_context=viewer_context,
                )
