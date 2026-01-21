from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from sentry.middleware.ai_agent import AIAgentMiddleware, _accepts_markdown
from sentry.testutils.cases import TestCase


class AcceptsMarkdownTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def test_accepts_text_markdown(self):
        request = self.factory.get("/", HTTP_ACCEPT="text/markdown")
        assert _accepts_markdown(request) is True

    def test_accepts_text_x_markdown(self):
        request = self.factory.get("/", HTTP_ACCEPT="text/x-markdown")
        assert _accepts_markdown(request) is True

    def test_rejects_other_types(self):
        request = self.factory.get("/", HTTP_ACCEPT="text/plain")
        assert _accepts_markdown(request) is False

    def test_case_insensitive(self):
        request = self.factory.get("/", HTTP_ACCEPT="TEXT/MARKDOWN")
        assert _accepts_markdown(request) is True

    def test_case_insensitive_mixed(self):
        request = self.factory.get("/", HTTP_ACCEPT="Text/Markdown")
        assert _accepts_markdown(request) is True


class AIAgentMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()
        self.middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))

    def make_anonymous_request(self, path: str, **kwargs):
        request = self.factory.get(path, **kwargs)
        request.user = AnonymousUser()
        request.auth = None
        return request

    def test_returns_guidance_for_anonymous_markdown_request(self):
        request = self.make_anonymous_request(
            "/organizations/test-org/issues/", HTTP_ACCEPT="text/markdown"
        )

        response = self.middleware(request)

        assert response.status_code == 200
        assert response["Content-Type"] == "text/markdown"
        content = response.content.decode()
        assert "# This Is the Web UI" in content
        assert "https://mcp.sentry.dev/mcp/test-org" in content

    def test_includes_project_in_mcp_url(self):
        request = self.make_anonymous_request(
            "/organizations/my-org/projects/my-project/", HTTP_ACCEPT="text/markdown"
        )

        response = self.middleware(request)

        assert response.status_code == 200
        assert "https://mcp.sentry.dev/mcp/my-org/my-project" in response.content.decode()

    def test_base_mcp_url_without_org_context(self):
        request = self.make_anonymous_request("/settings/", HTTP_ACCEPT="text/markdown")

        response = self.middleware(request)

        assert response.status_code == 200
        assert "https://mcp.sentry.dev/mcp" in response.content.decode()

    def test_authenticated_user_passes_through(self):
        request = self.factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
        request.user = self.create_user()
        request.auth = None

        assert self.middleware(request).status_code == 401

    def test_auth_token_passes_through(self):
        request = self.factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
        request.user = AnonymousUser()
        request.auth = MagicMock()

        assert self.middleware(request).status_code == 401

    def test_non_markdown_accept_passes_through(self):
        request = self.make_anonymous_request("/organizations/test-org/", HTTP_ACCEPT="text/html")

        assert self.middleware(request).status_code == 401

    def test_api_path_passes_through(self):
        request = self.make_anonymous_request("/api/0/projects/", HTTP_ACCEPT="text/markdown")

        assert self.middleware(request).status_code == 401

    @patch("sentry.middleware.ai_agent.logger.info")
    def test_logs_request(self, mock_logger: MagicMock):
        request = self.make_anonymous_request(
            "/organizations/test-org/",
            HTTP_ACCEPT="text/markdown",
            HTTP_USER_AGENT="Claude-Code/1.0",
        )

        self.middleware(request)

        mock_logger.assert_called_once_with(
            "ai_agent.guidance_served",
            extra={
                "path": "/organizations/test-org/",
                "user_agent": "Claude-Code/1.0",
            },
        )
