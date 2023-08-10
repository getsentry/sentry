from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.testutils.cases import TestCase


class ScopesTest(TestCase):
    def test_scope_hierarchy_maintained(self):
        for scope in SENTRY_SCOPES:
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING

            # exclude special OAuth scopes
            if ":" not in scope:
                continue

            resource, access_level = scope.split(":")

            if access_level == "write":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            if access_level == "admin":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
                assert resource + ":write" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
