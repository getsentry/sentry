from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.hybridcloud.models import ApiKeyReplica
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class ApiKeyTest(TestCase):
    def test_enforces_scope_hierarchy(self):
        org = self.create_organization()
        # Ensure hierarchy is enforced for all tokens
        for scope in SENTRY_SCOPES:
            token = self.create_api_key(org, scope_list=[scope])
            assert token.get_scopes() == sorted(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
            with assume_test_silo_mode(SiloMode.REGION):
                replica = ApiKeyReplica.objects.get(apikey_id=token.id)
                assert replica.get_scopes() == token.get_scopes()

    def test_default_string_serialization(self):
        org = self.create_organization()
        key = self.create_api_key(organization=org)

        assert f"{key} is cool" == f"api_key_id={key.id}, status={key.status} is cool"

    def test_apikeyreplica_string_serialization(self):
        org = self.create_organization()
        key = self.create_api_key(organization=org)
        with assume_test_silo_mode(SiloMode.REGION):
            replica = ApiKeyReplica.objects.get(apikey_id=key.id)

        assert f"{replica} is cool" == f"replica_id={replica.id}, status={replica.status} is cool"
