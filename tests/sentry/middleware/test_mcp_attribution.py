from unittest.mock import MagicMock

from django.test import RequestFactory

from sentry.analytics.mcp_attribution import McpAttribution, get_mcp_attribution
from sentry.middleware.mcp_attribution import McpAttributionMiddleware
from sentry.testutils.cases import TestCase


class McpAttributionMiddlewareTest(TestCase):
    def test_binds_attribution_during_request(self) -> None:
        captured: list[McpAttribution] = []

        def get_response(request):
            captured.append(get_mcp_attribution())
            return MagicMock(status_code=200)

        middleware = McpAttributionMiddleware(get_response)
        request = RequestFactory().get(
            "/",
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="cursor",
            HTTP_X_SENTRY_MCP_UTM_SOURCE="plugin",
        )
        middleware(request)

        assert captured == [McpAttribution(mcp=True, client="cursor", utm_source="plugin")]
        assert get_mcp_attribution() == McpAttribution()
