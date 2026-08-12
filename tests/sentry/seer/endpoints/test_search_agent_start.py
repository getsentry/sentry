from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from rest_framework import status

from sentry.seer.endpoints.search_agent_start import send_search_agent_start_request
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature


class SendSearchAgentStartRequestTest(TestCase):
    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_outbox_path_creates_run_and_flushes(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

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

        with pytest.raises(SeerApiError):
            send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                viewer_context=viewer_context,
            )

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_flag_options_default_to_false(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))

        send_search_agent_start_request(
            organization=self.organization,
            user_id=self.user.id,
            project_ids=[self.project.id],
            natural_language_query="errors today",
        )

        sent_options = mock_request.call_args[0][0]["options"]
        for flag in ["cross_event", "project_expansion", "reflection_step", "code_mode"]:
            assert sent_options[flag] is False

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_flag_options_are_sent_to_seer(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))

        send_search_agent_start_request(
            organization=self.organization,
            user_id=self.user.id,
            project_ids=[self.project.id],
            natural_language_query="errors today",
            model_name="gpt-5",
            cross_event=True,
            project_expansion=True,
            reflection_step=True,
            code_mode=True,
        )

        sent_options = mock_request.call_args[0][0]["options"]
        for flag in ["cross_event", "project_expansion", "reflection_step", "code_mode"]:
            assert sent_options[flag] is True
        assert sent_options["model_name"] == "gpt-5"


@with_feature("organizations:gen-ai-search-agent-translate")
@with_feature("organizations:gen-ai-features")
class SearchAgentStartEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = f"/api/0/organizations/{self.organization.slug}/search-agent/start/"

        self.seer_access_patcher = patch(
            "sentry.seer.endpoints.search_agent_start.has_seer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        super().tearDown()

    def _post(self, **extra_data: Any) -> Any:
        return self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "show errors",
                **extra_data,
            },
            format="json",
        )

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    @with_feature("organizations:seer-assisted-query-cross-event-explorer")
    @with_feature("organizations:seer-assisted-query-project-expansion")
    @with_feature("organizations:seer-assisted-query-reflection")
    @with_feature("organizations:seer-assisted-query-codemode")
    def test_start_forwards_feature_flags(self, mock_send_request: MagicMock) -> None:
        """Feature flags are forwarded to Seer as request options. Code mode tested separately."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"run_id": 42, "sentry_run_id": "run-uuid"}
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["cross_event"] is True
        assert kwargs["project_expansion"] is True
        assert kwargs["reflection_step"] is True

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_start_without_feature_flags(self, mock_send_request: MagicMock) -> None:
        """Options are False when the org has none of the flags."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["cross_event"] is False
        assert kwargs["project_expansion"] is False
        assert kwargs["reflection_step"] is False

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    @with_feature("organizations:seer-assisted-query-codemode")
    def test_code_mode_requires_toggle_and_flag(self, mock_send_request: MagicMock) -> None:
        """code_mode is False when the request toggle is off, even if the flag is on."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["code_mode"] is False

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    @with_feature("organizations:seer-assisted-query-codemode")
    def test_code_mode_toggle_enables_code_mode(self, mock_send_request: MagicMock) -> None:
        """The toggle rides in `options` alongside model_name/metric_context."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post(options={"code_mode": True, "model_name": "gpt-5"})

        assert response.status_code == status.HTTP_200_OK
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["code_mode"] is True
        assert kwargs["model_name"] == "gpt-5"
