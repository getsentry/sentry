from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls


@apply_feature_flag_on_cls("organizations:seer-explorer")
@apply_feature_flag_on_cls("organizations:gen-ai-features")
class OrganizationSeerExplorerChatEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"
        self.login_as(user=self.user)

    def test_get_without_run_id_returns_null_session(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.get(self.url)

        assert response.status_code == 404
        assert response.data == {"session": None}

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_state")
    def test_get_with_run_id_calls_seer(self, mock_call_seer_state):
        mock_response = {
            "session": {
                "run_id": 123,
                "messages": [],
                "status": "completed",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        }
        mock_call_seer_state.return_value = mock_response

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.get(f"{self.url}123/")

        assert response.status_code == 200
        assert response.data == mock_response
        mock_call_seer_state.assert_called_once_with(self.organization, "123")

    def test_post_without_query_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, {}, format="json")

            assert response.status_code == 400
            assert response.data == {"query": ["This field is required."]}

    def test_post_with_empty_query_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, {"query": "   "}, format="json")

            assert response.status_code == 400
            assert response.data == {"query": ["This field may not be blank."]}

    def test_post_with_invalid_json_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, "invalid json", content_type="application/json")

            assert response.status_code == 400
            assert "detail" in response.data
            assert "JSON parse error" in str(response.data["detail"])

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    def test_post_with_query_calls_seer(
        self, mock_call_seer_chat, mock_get_seer_org_acknowledgement
    ):
        mock_response = {
            "run_id": 456,
            "message": {
                "id": "msg-1",
                "type": "response",
                "content": "Hello! How can I help?",
                "timestamp": "2024-01-01T00:00:00Z",
                "loading": False,
            },
        }
        mock_call_seer_chat.return_value = mock_response

        data = {"query": "What is this error about?"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == mock_response
        mock_call_seer_chat.assert_called_once_with(
            self.organization, None, "What is this error about?", None, None
        )

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    def test_post_with_all_parameters(self, mock_call_seer_chat, mock_get_seer_org_acknowledgement):
        mock_response = {"run_id": 789, "message": {}}
        mock_call_seer_chat.return_value = mock_response

        data = {
            "query": "Follow up question",
            "insert_index": 2,
            "message_timestamp": 1704067200.0,
        }
        response = self.client.post(f"{self.url}789/", data, format="json")

        assert response.status_code == 200
        assert response.data == mock_response
        mock_call_seer_chat.assert_called_once_with(
            self.organization,
            "789",
            "Follow up question",
            2,
            1704067200.0,
        )

    def test_post_with_ai_features_disabled_returns_403(self) -> None:
        # Set the organization option to hide AI features
        self.organization.update_option("sentry:hide_ai_features", True)

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 403
            assert response.data == {"detail": "AI features are disabled for this organization."}

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=False,
    )
    def test_post_without_acknowledgement_returns_403(self, mock_get_seer_org_acknowledgement):
        data = {"query": "Test query"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 403
        assert response.data == {"detail": "Seer has not been acknowledged by the organization."}
        mock_get_seer_org_acknowledgement.assert_called_once_with(self.organization.id)


class OrganizationSeerExplorerChatEndpointFeatureFlagTest(APITestCase):
    """Test feature flag requirements separately without the decorator"""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"
        self.login_as(user=self.user)

    def test_post_without_gen_ai_features_flag_returns_400(self) -> None:
        # Only enable seer-explorer but not gen-ai-features
        with self.feature({"organizations:seer-explorer": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
                return_value=True,
            ):
                data = {"query": "Test query"}
                response = self.client.post(self.url, data, format="json")

                assert response.status_code == 400
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_post_without_seer_explorer_flag_returns_400(self) -> None:
        # Only enable gen-ai-features but not seer-explorer
        with self.feature({"organizations:gen-ai-features": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
                return_value=True,
            ):
                data = {"query": "Test query"}
                response = self.client.post(self.url, data, format="json")

                assert response.status_code == 400
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_post_without_any_feature_flags_returns_400(self) -> None:
        # No feature flags enabled
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 400
            assert response.data == {"detail": "Feature flag not enabled"}

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    def test_post_with_both_feature_flags_succeeds(
        self, mock_call_seer_chat, mock_get_seer_org_acknowledgement
    ):
        # Enable both required feature flags
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            mock_response = {"run_id": 1, "message": {}}
            mock_call_seer_chat.return_value = mock_response

            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 200
            assert response.data == mock_response
            mock_call_seer_chat.assert_called_once_with(
                self.organization, None, "Test query", None, None
            )
