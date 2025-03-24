from types import SimpleNamespace
from unittest.mock import patch

from google.api_core.exceptions import GoogleAPIError

from sentry.relocation.api.endpoints import ERR_FEATURE_DISABLED
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.helpers.options import override_options


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
class GetRelocationPublicKeyTest(APITestCase):
    endpoint = "sentry-api-0-relocations-public-key"
    method = "get"

    def setUp(self):
        super().setUp()
        self.user = self.create_user("user", is_superuser=False, is_staff=False, is_active=True)

        (_, pub_key_pem) = generate_rsa_key_pair()
        self.pub_key_pem = pub_key_pem

    def mock_kms_client(self, fake_kms_client: FakeKeyManagementServiceClient):
        fake_kms_client.get_public_key.call_count = 0
        fake_kms_client.get_public_key.return_value = SimpleNamespace(
            pem=self.pub_key_pem.decode("utf-8")
        )
        fake_kms_client.get_public_key.side_effect = None

    @override_options({"relocation.enabled": True})
    def test_good_superuser_when_feature_enabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        superuser = self.create_user("superuser", is_superuser=True, is_active=True)
        self.login_as(user=superuser, superuser=True)
        self.mock_kms_client(fake_kms_client)
        response = self.get_success_response(status_code=200)

        assert response.status_code == 200
        assert response.data["public_key"].encode() == self.pub_key_pem
        assert fake_kms_client.get_public_key.call_count == 1

    def test_good_superuser_when_feature_disabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        superuser = self.create_user("superuser", is_superuser=True, is_active=True)
        self.login_as(user=superuser, superuser=True)
        self.mock_kms_client(fake_kms_client)
        response = self.get_success_response(status_code=200)

        assert response.status_code == 200
        assert response.data["public_key"].encode() == self.pub_key_pem
        assert fake_kms_client.get_public_key.call_count == 1

    @override_options({"relocation.enabled": True, "staff.ga-rollout": True})
    def test_good_staff_when_feature_enabled(self, fake_kms_client: FakeKeyManagementServiceClient):
        staff = self.create_user("staff", is_staff=True, is_active=True)
        self.login_as(user=staff, staff=True)
        self.mock_kms_client(fake_kms_client)
        response = self.get_success_response(status_code=200)

        assert response.status_code == 200
        assert response.data["public_key"].encode() == self.pub_key_pem
        assert fake_kms_client.get_public_key.call_count == 1

    @override_options({"staff.ga-rollout": True})
    def test_good_staff_when_feature_disabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        staff = self.create_user("staff", is_staff=True, is_active=True)
        self.login_as(user=staff, staff=True)
        self.mock_kms_client(fake_kms_client)
        response = self.get_success_response(status_code=200)

        assert response.status_code == 200
        assert response.data["public_key"].encode() == self.pub_key_pem
        assert fake_kms_client.get_public_key.call_count == 1

    @override_options({"relocation.enabled": True})
    def test_good_regular_user_when_feature_enabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)
        response = self.get_success_response(status_code=200)

        assert response.status_code == 200
        assert response.data["public_key"].encode() == self.pub_key_pem
        assert fake_kms_client.get_public_key.call_count == 1

    def test_bad_regular_user_when_feature_disabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)
        response = self.get_error_response(status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED
        assert fake_kms_client.get_public_key.call_count == 0

    @override_options({"relocation.enabled": True})
    def test_bad_kms_network_error(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.get_public_key.return_value = None
        fake_kms_client.get_public_key.side_effect = GoogleAPIError("Test")
        self.get_error_response(status_code=500)

        assert fake_kms_client.get_public_key.call_count == 1

    @override_options({"relocation.enabled": True})
    def test_bad_no_auth(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.mock_kms_client(fake_kms_client)
        self.get_error_response(status_code=401)

        assert fake_kms_client.get_public_key.call_count == 0

    def test_bad_superuser_missing_cookie_when_feature_disabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        superuser = self.create_user("superuser", is_superuser=True, is_active=True)
        self.login_as(user=superuser, staff=False)
        self.mock_kms_client(fake_kms_client)
        self.get_error_response(status_code=400)

        assert fake_kms_client.get_public_key.call_count == 0

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_missing_cookie_when_feature_disabled(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        staff = self.create_user("staff", is_staff=True, is_active=True)
        self.login_as(user=staff, staff=False)
        self.mock_kms_client(fake_kms_client)
        self.get_error_response(status_code=400)

        assert fake_kms_client.get_public_key.call_count == 0
