from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.hybridcloud.models import ApiKeyReplica
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class ApiTokenTest(TestCase):
    def test_enforces_scope_hierarchy(self):
        org = self.create_organization()
        # Ensure hierarchy is enforced for all tokens
        for scope in SENTRY_SCOPES:
            token = self.create_api_key(org, scope_list=[scope])
            assert token.get_scopes() == sorted(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
            with assume_test_silo_mode(SiloMode.REGION):
                replica = ApiKeyReplica.objects.get(apikey_id=token.id)
                assert replica.get_scopes() == token.get_scopes()
