from typing import Any
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import resolve
from django.views import View

from sentry.middleware.ai_agent import AIAgentMiddleware, _accepts_markdown
from sentry.testutils.cases import TestCase
from sentry.web.decorators import ai_machine_readable


class AcceptsMarkdownTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = RequestFactory()

    def test_accepts_text_markdown(self) -> None:
        request = self.factory.get("/", HTTP_ACCEPT="text/markdown")
        assert _accepts_markdown(request) is True

    def test_accepts_text_x_markdown(self) -> None:
        request = self.factory.get("/", HTTP_ACCEPT="text/x-markdown")
        assert _accepts_markdown(request) is True

    def test_rejects_other_types(self) -> None:
        request = self.factory.get("/", HTTP_ACCEPT="text/plain")
        assert _accepts_markdown(request) is False

    def test_case_insensitive(self) -> None:
        request = self.factory.get("/", HTTP_ACCEPT="TEXT/MARKDOWN")
        assert _accepts_markdown(request) is True

    def test_case_insensitive_mixed(self) -> None:
        request = self.factory.get("/", HTTP_ACCEPT="Text/Markdown")
        assert _accepts_markdown(request) is True


class AIAgentMiddlewareTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = RequestFactory()
        self.middleware = AIAgentMiddleware(get_response=self.view)

    def view(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=401)

    def make_anonymous_request(self, path: str, **kwargs: Any) -> Any:
        request = self.factory.get(path, **kwargs)
        request.user = AnonymousUser()
        request.auth = None
        return request

    def test_returns_guidance_for_anonymous_markdown_request(self) -> None:
        request = self.make_anonymous_request(
            "/organizations/test-org/issues/", HTTP_ACCEPT="text/markdown"
        )

        response = self.middleware.process_view(request, self.view, (), {})

        assert response is not None
        assert response.status_code == 200
        assert response["Content-Type"] == "text/markdown"
        content = response.content.decode()
        assert "# Sentry" in content
        assert "https://mcp.sentry.dev/mcp/test-org" in content

    def test_includes_project_in_mcp_url(self) -> None:
        request = self.make_anonymous_request(
            "/organizations/my-org/projects/my-project/", HTTP_ACCEPT="text/markdown"
        )

        response = self.middleware.process_view(request, self.view, (), {})

        assert response is not None
        assert response.status_code == 200
        assert "https://mcp.sentry.dev/mcp/my-org/my-project" in response.content.decode()

    def test_base_mcp_url_without_org_context(self) -> None:
        request = self.make_anonymous_request("/settings/", HTTP_ACCEPT="text/markdown")

        response = self.middleware.process_view(request, self.view, (), {})

        assert response is not None
        assert response.status_code == 200
        assert "https://mcp.sentry.dev/mcp" in response.content.decode()

    def test_authenticated_user_passes_through(self) -> None:
        request = self.factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
        request.user = self.create_user()
        request.auth = None

        assert self.middleware.process_view(request, self.view, (), {}) is None

    def test_auth_token_passes_through(self) -> None:
        request = self.factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
        request.user = AnonymousUser()
        request.auth = MagicMock()

        assert self.middleware.process_view(request, self.view, (), {}) is None

    def test_non_markdown_accept_passes_through(self) -> None:
        request = self.make_anonymous_request("/organizations/test-org/", HTTP_ACCEPT="text/html")

        assert self.middleware.process_view(request, self.view, (), {}) is None

    def test_api_path_passes_through(self) -> None:
        request = self.make_anonymous_request("/api/0/projects/", HTTP_ACCEPT="text/markdown")

        assert self.middleware.process_view(request, self.view, (), {}) is None

    def test_oauth_token_view_passes_through(self) -> None:
        request = self.make_anonymous_request("/oauth/token/", HTTP_ACCEPT="text/markdown")
        view = resolve(request.path).func

        assert self.middleware.process_view(request, view, (), {}) is None

    def test_oauth_device_code_view_passes_through(self) -> None:
        request = self.make_anonymous_request("/oauth/device/code/", HTTP_ACCEPT="text/markdown")
        view = resolve(request.path).func

        assert self.middleware.process_view(request, view, (), {}) is None

    def test_oauth_userinfo_view_passes_through(self) -> None:
        request = self.make_anonymous_request("/oauth/userinfo/", HTTP_ACCEPT="text/markdown")
        view = resolve(request.path).func

        assert self.middleware.process_view(request, view, (), {}) is None

    def test_machine_readable_view_passes_through(self) -> None:
        @ai_machine_readable
        def view(request: HttpRequest) -> HttpResponse:
            return HttpResponse("Machine instructions")

        request = self.make_anonymous_request("/instructions/", HTTP_ACCEPT="text/markdown")

        assert self.middleware.process_view(request, view, (), {}) is None

    def test_machine_readable_class_based_view_passes_through(self) -> None:
        @ai_machine_readable
        class InstructionsView(View):
            def get(self, request: HttpRequest) -> HttpResponse:
                return HttpResponse("Machine instructions")

        request = self.make_anonymous_request("/instructions/", HTTP_ACCEPT="text/x-markdown")

        assert self.middleware.process_view(request, InstructionsView.as_view(), (), {}) is None

    @patch("sentry.middleware.ai_agent.logger.info")
    def test_logs_request(self, mock_logger: MagicMock) -> None:
        request = self.make_anonymous_request(
            "/organizations/test-org/",
            HTTP_ACCEPT="text/markdown",
            HTTP_USER_AGENT="Claude-Code/1.0",
        )

        self.middleware.process_view(request, self.view, (), {})

        mock_logger.assert_called_once_with(
            "ai_agent.guidance_served",
            extra={
                "path": "/organizations/test-org/",
                "user_agent": "Claude-Code/1.0",
            },
        )
