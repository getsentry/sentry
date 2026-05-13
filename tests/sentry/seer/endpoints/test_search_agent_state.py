from unittest.mock import Mock, patch

from django.test import override_settings

from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.testutils.cases import APITestCase


@override_settings(SEER_AUTOFIX_URL="https://seer.example.com")
class SearchAgentStateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-search-agent-state"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.features = {
            "organizations:gen-ai-search-agent-translate": True,
            "organizations:gen-ai-features": True,
        }

    @patch("sentry.seer.endpoints.search_agent_state.make_search_agent_state_request")
    def test_numeric_run_id_forwards_to_seer(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(
            status=200, json=Mock(return_value={"session": {"status": "completed"}})
        )
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, "42")
        assert response.data["session"]["status"] == "completed"

    def test_uuid_returns_processing_when_outbox_not_drained(self) -> None:
        run = self.create_seer_run(type=SeerRunType.ASSISTED_QUERY)
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, str(run.uuid))
        assert response.data == {"session": {"status": "processing"}}

    @patch("sentry.seer.endpoints.search_agent_state.make_search_agent_state_request")
    def test_uuid_forwards_to_seer_when_drained(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(
            status=200, json=Mock(return_value={"session": {"status": "completed"}})
        )
        run = self.create_seer_run(type=SeerRunType.ASSISTED_QUERY, seer_run_state_id=99)
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, str(run.uuid))
        assert response.data["session"]["status"] == "completed"
        sent_body = mock_request.call_args[0][0]
        assert sent_body["run_id"] == 99

    def test_unknown_uuid_returns_404(self) -> None:
        with self.feature(self.features):
            response = self.get_response(
                self.organization.slug, "00000000-0000-0000-0000-000000000000"
            )
        assert response.status_code == 404

    def test_wrong_org_returns_404(self) -> None:
        other_org = self.create_organization()
        run = self.create_seer_run(type=SeerRunType.ASSISTED_QUERY, seer_run_state_id=99)
        with self.feature(self.features):
            response = self.get_response(other_org.slug, str(run.uuid))
        assert response.status_code in (403, 404)

    def test_uuid_returns_error_when_flush_failed(self) -> None:
        run = self.create_seer_run(
            type=SeerRunType.ASSISTED_QUERY, mirror_status=SeerRunMirrorStatus.FAILED
        )
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, str(run.uuid))
        assert response.data == {"session": {"status": "error"}}

    def test_garbage_string_returns_400(self) -> None:
        with self.feature(self.features):
            response = self.get_response(self.organization.slug, "not-valid")
        assert response.status_code == 400
