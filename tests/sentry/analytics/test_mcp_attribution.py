from django.test import RequestFactory

from sentry.analytics.mcp_attribution import (
    McpAttribution,
    get_mcp_attribution,
    mcp_attribution_scope,
    resolve_mcp_attribution,
)
from sentry.testutils.cases import TestCase


class McpAttributionTest(TestCase):
    def test_resolves_known_attributes(self) -> None:
        request = RequestFactory().get(
            "/",
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="Cursor",
            HTTP_X_SENTRY_MCP_UTM_SOURCE="plugin",
        )

        assert resolve_mcp_attribution(request) == McpAttribution(
            mcp=True, client="cursor", utm_source="plugin"
        )

    def test_buckets_unknown_attributes(self) -> None:
        request = RequestFactory().get(
            "/",
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="new-client",
            HTTP_X_SENTRY_MCP_UTM_SOURCE="new-source",
        )

        assert resolve_mcp_attribution(request) == McpAttribution(
            mcp=True, client="other", utm_source="other"
        )

    def test_ignores_headers_without_mcp_user_agent(self) -> None:
        request = RequestFactory().get(
            "/",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="cursor",
            HTTP_X_SENTRY_MCP_UTM_SOURCE="plugin",
        )

        assert resolve_mcp_attribution(request) == McpAttribution()

    def test_scope_restores_previous_attribution(self) -> None:
        attribution = McpAttribution(mcp=True, client="cursor", utm_source="plugin")

        with mcp_attribution_scope(attribution):
            assert get_mcp_attribution() == attribution

        assert get_mcp_attribution() == McpAttribution()
