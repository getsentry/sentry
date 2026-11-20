from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.security.orgauthtoken_token import hash_token


@control_silo_test
class ApiIndexDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse("sentry-api-index")

    def test_get_with_user_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.data["auth"] == {"scopes": ["org:read"]}
        assert response.data["user"]["id"] == str(self.user.id)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_get_with_org_auth_token(self) -> None:
        token = "sntrys_abc123_xyz"
        self.create_org_auth_token(
            name="CI",
            token_hashed=hash_token(token),
            token_last_characters="xyz",
            organization_id=self.organization.id,
            scope_list=["org:ci"],
        )
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token}")
        assert response.data["auth"] == {"scopes": ["org:ci"]}
        assert response.data["user"] is None
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_get_anonymous(self) -> None:
        response = self.client.get(self.url)
        assert response.data == {"version": "0", "auth": None, "user": None}
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
