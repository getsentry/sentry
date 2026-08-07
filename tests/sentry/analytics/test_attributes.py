from __future__ import annotations

from sentry.analytics.attributes import (
    get_mcp_utm_source,
    mcp_utm_source_scope,
    resolve_mcp_utm_source,
)
from sentry.testutils.cases import TestCase


class ResolveMcpUtmSourceTest(TestCase):
    def test_known_value(self) -> None:
        assert resolve_mcp_utm_source("plugin") == "plugin"

    def test_unknown_value_buckets_to_other(self) -> None:
        assert resolve_mcp_utm_source("something-new") == "other"

    def test_absent_value(self) -> None:
        assert resolve_mcp_utm_source(None) is None
        assert resolve_mcp_utm_source("") is None


class McpUtmSourceScopeTest(TestCase):
    def test_sets_and_clears_context(self) -> None:
        assert get_mcp_utm_source() is None
        with mcp_utm_source_scope("plugin"):
            assert get_mcp_utm_source() == "plugin"
        assert get_mcp_utm_source() is None

    def test_nested_scopes_restore_parent(self) -> None:
        with mcp_utm_source_scope("plugin"):
            with mcp_utm_source_scope("other"):
                assert get_mcp_utm_source() == "other"
            assert get_mcp_utm_source() == "plugin"
