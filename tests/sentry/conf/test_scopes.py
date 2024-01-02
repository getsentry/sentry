from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.testutils.cases import TestCase


class ScopesTest(TestCase):
    def test_scope_hierarchy_maintained(self):
        assert "org:superuser" not in SENTRY_SCOPES
        for scope in SENTRY_SCOPES:
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING

            # exclude special OAuth scopes
            if ":" not in scope:
                continue
            resource, access_level = scope.split(":")

            # check that scope is in its own mapping
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # check that write grants read
            if access_level == "write":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # # check that admin grants read+write
            if access_level == "admin":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
                assert resource + ":write" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
