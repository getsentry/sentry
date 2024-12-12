from sentry.auth.services.auth.serial import serialize_api_key, serialize_api_token
from sentry.models.apikey import ApiKey
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestRpcApiToken(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

    def test_serializes_correct_fields(self):
        internal_app = self.create_internal_integration(organization=self.org)
        api_token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_app
        )
        serialized_token = serialize_api_token(api_token)
        assert f"{serialized_token} is so skibidi".lower().find("token") == -1
        assert f"{serialized_token} is so skibidi".lower().find("hashed_token") == -1


@control_silo_test
class TestRpcApiKey(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

    def test_serializes_correct_fields(self):
        key = ApiKey.objects.create(
            organization_id=self.create_organization().id, scope_list=["org:read"]
        )
        serialized_key = serialize_api_key(key)
        assert f"{serialized_key} is so skibidi".lower().find("key") == -1
