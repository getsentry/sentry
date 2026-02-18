from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from sentry.middleware.ai_agent import AIAgentMiddleware, _accepts_markdown


def test_accepts_text_markdown():
    factory = RequestFactory()
    request = factory.get("/", HTTP_ACCEPT="text/markdown")
    assert _accepts_markdown(request) is True


def test_accepts_text_x_markdown():
    factory = RequestFactory()
    request = factory.get("/", HTTP_ACCEPT="text/x-markdown")
    assert _accepts_markdown(request) is True


def test_rejects_other_types():
    factory = RequestFactory()
    request = factory.get("/", HTTP_ACCEPT="text/plain")
    assert _accepts_markdown(request) is False


def test_case_insensitive():
    factory = RequestFactory()
    request = factory.get("/", HTTP_ACCEPT="TEXT/MARKDOWN")
    assert _accepts_markdown(request) is True


def test_case_insensitive_mixed():
    factory = RequestFactory()
    request = factory.get("/", HTTP_ACCEPT="Text/Markdown")
    assert _accepts_markdown(request) is True


def _make_anonymous_request(factory: RequestFactory, path: str, **kwargs):
    request = factory.get(path, **kwargs)
    request.user = AnonymousUser()
    request.auth = None
    return request


def test_returns_guidance_for_anonymous_markdown_request():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(
        factory, "/organizations/test-org/issues/", HTTP_ACCEPT="text/markdown"
    )

    response = middleware(request)

    assert response.status_code == 200
    assert response["Content-Type"] == "text/markdown"
    content = response.content.decode()
    assert "# This Is the Web UI" in content
    assert "https://mcp.sentry.dev/mcp/test-org" in content


def test_includes_project_in_mcp_url():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(
        factory, "/organizations/my-org/projects/my-project/", HTTP_ACCEPT="text/markdown"
    )

    response = middleware(request)

    assert response.status_code == 200
    assert "https://mcp.sentry.dev/mcp/my-org/my-project" in response.content.decode()


def test_base_mcp_url_without_org_context():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(factory, "/settings/", HTTP_ACCEPT="text/markdown")

    response = middleware(request)

    assert response.status_code == 200
    assert "https://mcp.sentry.dev/mcp" in response.content.decode()


def test_authenticated_user_passes_through():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
    request.user = MagicMock(is_authenticated=True)
    request.auth = None

    assert middleware(request).status_code == 401


def test_auth_token_passes_through():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = factory.get("/organizations/test-org/", HTTP_ACCEPT="text/markdown")
    request.user = AnonymousUser()
    request.auth = MagicMock()

    assert middleware(request).status_code == 401


def test_non_markdown_accept_passes_through():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(factory, "/organizations/test-org/", HTTP_ACCEPT="text/html")

    assert middleware(request).status_code == 401


def test_api_path_passes_through():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(factory, "/api/0/projects/", HTTP_ACCEPT="text/markdown")

    assert middleware(request).status_code == 401


def test_oauth_path_passes_through():
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(factory, "/oauth/token/", HTTP_ACCEPT="text/markdown")

    assert middleware(request).status_code == 401


@patch("sentry.middleware.ai_agent.logger.info")
def test_logs_request(mock_logger: MagicMock):
    factory = RequestFactory()
    middleware = AIAgentMiddleware(get_response=lambda r: MagicMock(status_code=401))
    request = _make_anonymous_request(
        factory,
        "/organizations/test-org/",
        HTTP_ACCEPT="text/markdown",
        HTTP_USER_AGENT="Claude-Code/1.0",
    )

    middleware(request)

    mock_logger.assert_called_once_with(
        "ai_agent.guidance_served",
        extra={
            "path": "/organizations/test-org/",
            "user_agent": "Claude-Code/1.0",
        },
    )
