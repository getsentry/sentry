from types import SimpleNamespace
from unittest.mock import patch

from django.urls import reverse
from google.api_core.exceptions import GoogleAPIError

from sentry.api.endpoints.relocations import ERR_FEATURE_DISABLED
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test


@region_silo_test
@patch(
    "sentry.backup.helpers.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
class GetRelocationPublicKeyTest(APITestCase):
    endpoint = "sentry-api-0-relocations-public-key"

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

    def test_success_superuser_auth(self, fake_kms_client: FakeKeyManagementServiceClient):
        superuser = self.create_user("superuser", is_superuser=True, is_staff=True, is_active=True)
        self.login_as(user=superuser, superuser=True)
        self.mock_kms_client(fake_kms_client)

        with self.options({"relocation.enabled": True}):
            response = self.client.get(reverse(self.endpoint), {})

        assert response.status_code == 200
        assert fake_kms_client.get_public_key.call_count == 1

    def test_success_regular_user_auth(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)

        with self.options({"relocation.enabled": True}):
            response = self.client.get(reverse(self.endpoint), {})

        assert response.status_code == 200
        assert fake_kms_client.get_public_key.call_count == 1

    def test_fail_feature_disabled(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)

        response = self.client.get(reverse(self.endpoint), {})

        assert response.status_code == 400
        assert fake_kms_client.get_public_key.call_count == 0
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED

    def test_fail_network_error(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.login_as(user=self.user, superuser=False)
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.get_public_key.return_value = None
        fake_kms_client.get_public_key.side_effect = GoogleAPIError("Test")

        with self.options({"relocation.enabled": True}):
            response = self.client.get(reverse(self.endpoint), {})

        assert response.status_code == 500
        assert fake_kms_client.get_public_key.call_count == 1

    def test_fail_no_auth(self, fake_kms_client: FakeKeyManagementServiceClient):
        self.mock_kms_client(fake_kms_client)

        with self.feature("relocation:enabled"):
            response = self.client.get(reverse(self.endpoint), {})

        assert response.status_code == 401
        assert fake_kms_client.get_public_key.call_count == 0
