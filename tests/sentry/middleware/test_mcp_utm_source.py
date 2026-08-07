from __future__ import annotations

from unittest.mock import MagicMock

from django.test import RequestFactory

from sentry.analytics.attributes import get_mcp_utm_source
from sentry.middleware.mcp_utm_source import McpUtmSourceMiddleware
from sentry.testutils.cases import TestCase


class McpUtmSourceMiddlewareTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = RequestFactory()

    def test_sets_known_header_during_request(self) -> None:
        captured: list[str | None] = []

        def get_response(request):
            captured.append(get_mcp_utm_source())
            return MagicMock(status_code=200)

        middleware = McpUtmSourceMiddleware(get_response)
        request = self.factory.get("/", HTTP_X_SENTRY_MCP_UTM_SOURCE="plugin")
        middleware(request)

        assert captured == ["plugin"]
        assert get_mcp_utm_source() is None

    def test_buckets_unknown_header(self) -> None:
        captured: list[str | None] = []

        def get_response(request):
            captured.append(get_mcp_utm_source())
            return MagicMock(status_code=200)

        middleware = McpUtmSourceMiddleware(get_response)
        request = self.factory.get("/", HTTP_X_SENTRY_MCP_UTM_SOURCE="custom-source")
        middleware(request)

        assert captured == ["other"]

    def test_absent_header_leaves_context_empty(self) -> None:
        captured: list[str | None] = []

        def get_response(request):
            captured.append(get_mcp_utm_source())
            return MagicMock(status_code=200)

        middleware = McpUtmSourceMiddleware(get_response)
        request = self.factory.get("/")
        middleware(request)

        assert captured == [None]
