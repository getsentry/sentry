from sentry.conf.server import (
    GRANULAR_SCOPES,
    SENTRY_READONLY_SCOPES,
    SENTRY_SCOPE_HIERARCHY_MAPPING,
    SENTRY_SCOPES,
)
from sentry.testutils.cases import TestCase


class ScopesTest(TestCase):
    def test_scope_hierarchy_maintained(self) -> None:
        assert "org:superuser" not in SENTRY_SCOPES
        for scope in SENTRY_SCOPES:
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING

            # exclude special OAuth scopes
            if ":" not in scope:
                continue
            resource, access_level = scope.split(":")

            # check that scope is in its own mapping
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # granular scopes are explicit and imply nothing else
            # (dashboard:write still implies dashboard:read until it moves over too)
            if scope in GRANULAR_SCOPES and resource != "dashboard":
                assert SENTRY_SCOPE_HIERARCHY_MAPPING[scope] == {scope}
                continue

            # check that write grants read
            if access_level == "write":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # # check that admin grants read+write
            if access_level == "admin":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
                assert resource + ":write" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

    def test_readonly_scopes(self) -> None:
        for scope in SENTRY_SCOPES:
            if ":read" in scope:
                assert scope in SENTRY_READONLY_SCOPES
