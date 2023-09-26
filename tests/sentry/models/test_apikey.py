from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class ApiTokenTest(TestCase):
    def test_enforces_scope_hierarchy(self):
        org = self.create_organization()
        # Ensure hierarchy is enforced for all tokens
        for scope in SENTRY_SCOPES:
            token = self.create_api_key(org, scope_list=[scope])
            assert token.get_scopes() == sorted(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
