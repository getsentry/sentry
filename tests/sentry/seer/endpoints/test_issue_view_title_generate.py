from unittest.mock import MagicMock, patch

import orjson
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import Actor, ActorType, ViewerContext, decode_viewer_context


class IssueViewTitleGenerateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-issue-view-title-generate"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/issue-view-title/generate/"

    def _create_token(self, scope: str) -> ApiToken:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return ApiToken.objects.create(user=self.user, scope_list=[scope])

    def _post_with_token(self, token: ApiToken, query: str = "is:unresolved"):
        return self.client.post(
            self.url,
            data={"query": query},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @patch("sentry.seer.signed_seer_api.seer_autofix_default_connection_pool.urlopen")
    def test_successful_title_generation(self, mock_urlopen: MagicMock) -> None:
        query = "is:unresolved assigned:me level:error"
        mock_urlopen.return_value = HTTPResponse(
            orjson.dumps({"result": {"title": "My Assigned Errors"}}),
            status=200,
        )

        response = self.client.post(
            self.url,
            data={"query": query},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == {"title": "My Assigned Errors"}
        request = mock_urlopen.call_args
        assert request.args[:2] == ("POST", "/v1/automation/oneshot/run")
        assert request.kwargs["timeout"] == 10
        assert orjson.loads(request.kwargs["body"]) == {
            "oneshot_id": "issue_view_title",
            "payload": {"query": query},
        }
        viewer_context = decode_viewer_context(
            request.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=self.user.id),
            organization_id=self.organization.id,
        )

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_title_is_stripped(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": "  Title With Whitespace  "}

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == {"title": "Title With Whitespace"}

    def test_missing_query_parameter(self) -> None:
        response = self.client.post(self.url, data={}, format="json")

        assert response.status_code == 400
        assert str(response.data["query"][0]) == "This field is required."

    def test_empty_query_parameter(self) -> None:
        response = self.client.post(self.url, data={"query": ""}, format="json")

        assert response.status_code == 400
        assert str(response.data["query"][0]) == "This field may not be blank."

    def test_ai_features_disabled_for_org(self) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 403
        assert response.data == {"detail": "AI features are disabled for this organization."}

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_seer_api_error(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("Connection error")

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Failed to generate title"}

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_empty_response_from_seer(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": None}

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 500
        assert response.data == {"detail": "No title returned from Seer"}

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_blank_response_from_seer(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": "   "}

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 500
        assert response.data == {"detail": "No title returned from Seer"}

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_long_query_is_forwarded_to_seer(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": "Generated Title"}

        long_query = "x" * 600

        response = self.client.post(
            self.url,
            data={"query": long_query},
            format="json",
        )

        assert response.status_code == 200
        mock_request.assert_called_once_with(
            "issue_view_title",
            {"query": long_query},
            self.organization,
            user_id=self.user.id,
            timeout=10,
        )

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_org_read_permission(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": "My Assigned Errors"}

        for scope in ["org:read", "org:write", "org:admin"]:
            token = self._create_token(scope)
            response = self._post_with_token(
                token,
                query="is:unresolved assigned:me level:error",
            )

            assert response.status_code == 200
            assert response.data == {"title": "My Assigned Errors"}

    @patch("sentry.seer.endpoints.issue_view_title_generate.run_oneshot")
    def test_requires_org_scope(self, mock_request: MagicMock) -> None:
        token = self._create_token("project:read")
        response = self._post_with_token(
            token,
            query="is:unresolved assigned:me level:error",
        )

        assert response.status_code == 403
        assert response.data == {"detail": "You do not have permission to perform this action."}
        mock_request.assert_not_called()
