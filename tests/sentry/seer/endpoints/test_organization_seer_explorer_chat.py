from typing import Any
from unittest.mock import ANY, MagicMock, patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
@with_feature("organizations:gen-ai-consent-flow-removal")
class OrganizationSeerExplorerChatEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"

    def test_get_without_run_id_returns_null_session(self) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 404
        assert response.data == {"session": None}

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_get_with_run_id_calls_client(self, mock_client_class: MagicMock) -> None:
        from sentry.seer.explorer.client_models import SeerRunState

        # Mock client response
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_client = MagicMock()
        mock_client.get_run.return_value = mock_state
        mock_client_class.return_value = mock_client

        response = self.client.get(f"{self.url}123/")

        assert response.status_code == 200
        assert response.data["session"]["run_id"] == 123
        assert response.data["session"]["status"] == "completed"
        mock_client.get_run.assert_called_once_with(run_id=123)

    def test_post_without_query_returns_400(self) -> None:
        data: dict[str, Any] = {}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    def test_post_with_empty_query_returns_400(self) -> None:
        data = {"query": ""}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_new_conversation_calls_client(self, mock_client_class: MagicMock):
        mock_client = MagicMock()
        mock_client.start_run.return_value = 456
        mock_client_class.return_value = mock_client

        data = {"query": "What is this error about?"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 456}
        mock_client_class.assert_called_once_with(
            self.organization, ANY, is_interactive=True, enable_coding=False
        )
        mock_client.start_run.assert_called_once_with(
            prompt="What is this error about?",
            on_page_context=None,
            override_ce_enable=True,
        )

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_new_conversation_enable_coding(self, mock_client_class: MagicMock):
        for i, (feature_enabled, option_enabled) in enumerate(
            [(True, True), (True, False), (False, True)]
        ):
            self.organization.update_option("sentry:enable_seer_coding", option_enabled)
            mock_client = MagicMock()
            mock_client.start_run.return_value = 456
            mock_client_class.return_value = mock_client

            data = {"query": "What is this error about?"}
            features_ctx = (
                self.feature("organizations:seer-explorer-chat-coding")
                if feature_enabled
                else self.feature({"organizations:seer-explorer-chat-coding": False})
            )
            with features_ctx:
                response = self.client.post(self.url, data, format="json")

            assert response.status_code == 200
            assert mock_client_class.call_count == i + 1
            mock_client_class.assert_called_with(
                self.organization,
                ANY,
                is_interactive=True,
                enable_coding=feature_enabled and option_enabled,
            )

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_continue_conversation_calls_client(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.continue_run.return_value = 789
        mock_client_class.return_value = mock_client

        data = {
            "query": "Follow up question",
            "insert_index": 2,
        }
        response = self.client.post(f"{self.url}789/", data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 789}
        mock_client_class.assert_called_once_with(
            self.organization, ANY, is_interactive=True, enable_coding=False
        )
        mock_client.continue_run.assert_called_once_with(
            run_id=789,
            prompt="Follow up question",
            insert_index=2,
            on_page_context=None,
        )

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_continue_conversation_enable_coding(self, mock_client_class: MagicMock) -> None:
        for i, (feature_enabled, option_enabled) in enumerate(
            [(True, True), (True, False), (False, True), (False, False)]
        ):
            mock_client = MagicMock()
            mock_client.continue_run.return_value = 789
            mock_client_class.return_value = mock_client

            data = {"query": "Follow up question", "insert_index": 2}
            self.organization.update_option("sentry:enable_seer_coding", option_enabled)
            with self.feature({"organizations:seer-explorer-chat-coding": feature_enabled}):
                response = self.client.post(f"{self.url}789/", data, format="json")

            assert response.status_code == 200
            assert mock_client_class.call_count == i + 1
            mock_client_class.assert_called_with(
                self.organization,
                ANY,
                is_interactive=True,
                enable_coding=feature_enabled and option_enabled,
            )


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
@with_feature("organizations:gen-ai-consent-flow-removal")
class OrganizationSeerExplorerChatContextEngineTest(APITestCase):
    """End-to-end tests verifying is_context_engine_enabled reaches make_explorer_chat_request."""

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"

    @patch("sentry.seer.explorer.client.make_explorer_chat_request")
    @patch("sentry.seer.explorer.client.has_seer_access_with_detail")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_override_ce_enable_false_sets_context_engine_disabled(
        self, mock_collect_context, mock_access, mock_chat_request
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {}
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {"run_id": 123}
        mock_chat_request.return_value = mock_response

        data = {"query": "What is this error about?", "override_ce_enable": False}
        with self.feature("organizations:seer-explorer-context-engine-allow-fe-override"):
            response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        body = mock_chat_request.call_args[0][0]
        assert body["is_context_engine_enabled"] is False

    @patch("sentry.seer.explorer.client.make_explorer_chat_request")
    @patch("sentry.seer.explorer.client.has_seer_access_with_detail")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_override_ce_enable_true_sets_context_engine_enabled(
        self, mock_collect_context, mock_access, mock_chat_request
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {}
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {"run_id": 123}
        mock_chat_request.return_value = mock_response

        data = {"query": "What is this error about?", "override_ce_enable": True}
        with self.feature("organizations:seer-explorer-context-engine-allow-fe-override"):
            response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        body = mock_chat_request.call_args[0][0]
        assert body["is_context_engine_enabled"] is True

    @patch("sentry.seer.explorer.client.make_explorer_chat_request")
    @patch("sentry.seer.explorer.client.has_seer_access_with_detail")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_override_ce_enable_ignored_without_feature_flag(
        self, mock_collect_context, mock_access, mock_chat_request
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {}
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {"run_id": 123}
        mock_chat_request.return_value = mock_response

        data = {"query": "What is this error about?", "override_ce_enable": False}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        body = mock_chat_request.call_args[0][0]
        assert body.get("is_context_engine_enabled") is not False
