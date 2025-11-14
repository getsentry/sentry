from typing import int
import pytest

from tools.api_urls_to_typescript import regexp_to_routes


@pytest.mark.parametrize(
    ("input_regexp", "expected"),
    (
        # Basic named group
        (r"^(?P<issue_id>[^/]+)/plugins?/$", ["$issueId/plugins/"]),
        # Multiple named groups
        (
            r"^api/v1/(?P<org_slug>[^/]+)/(?P<project_id>[^/]+)/$",
            ["api/v1/$orgSlug/$projectId/"],
        ),
        # Alternates
        (r"/(?:issues|groups)/", ["/issues/", "/groups/"]),
        # Complex alternate with named groups
        (
            r"^api/(?P<version>[^/]+)/(?:issues|groups)/(?P<id>[^/]+)/$",
            ["api/$version/issues/$id/", "api/$version/groups/$id/"],
        ),
        # Simple pattern without named groups
        (r"^api/health/$", ["api/health/"]),
        # Pattern with optional parts
        (r"^api/v1/(?P<org_slug>[^/]+)/?$", ["api/v1/$orgSlug/"]),
        # Complex pattern with nested groups and character classes
        (
            r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>(?:\d+|[A-Fa-f0-9]{32}))/$",
            ["$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/"],
        ),
        # Multiple named groups per url segment
        (
            r"^(?P<organization_id_or_slug>[^/]+)/events/(?P<project_id_or_slug>[^/]+):(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
            ["$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/"],
        ),
    ),
)
def test_regexp_to_route(input_regexp, expected) -> None:
    result = regexp_to_routes(input_regexp)
    assert result == expected
