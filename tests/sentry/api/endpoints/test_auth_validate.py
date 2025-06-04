from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class AuthenticatedTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user()
        self.user.set_password("ThisIsATestPassword1234")
        self.user.save()

        self.org = self.create_organization(owner=self.user)

        self.url = reverse("sentry-api-0-auth-test")

    def test_valid_session_auth(self):
        self.client.login(username=self.user.username, password="ThisIsATestPassword1234")
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200
        self.client.logout()

    def test_valid_user_token_auth(self):
        api_token = ApiToken.objects.create(token_type=AuthTokenType.USER, user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {api_token.plaintext_token}")
        response = self.client.get(self.url)
        assert response.status_code == 200
        self.client.credentials()

    def test_valid_org_token_auth(self):
        from sentry.utils.security.orgauthtoken_token import hash_token

        token = "sntrys_abc1234_xyz"
        _ = self.create_org_auth_token(
            name="test_valid_org_token_auth",
            token_hashed=hash_token(token),
            organization_id=self.org.id,
            token_last_characters="xyz",
            scope_list=[],
            date_last_used=None,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.url)
        assert response.status_code == 200
        self.client.credentials()

    def test_no_auth(self):
        response = self.client.get(self.url)
        assert response.status_code == 403
