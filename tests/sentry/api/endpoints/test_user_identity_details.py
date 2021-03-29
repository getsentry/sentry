from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import APITestCase


class DeleteUserIdentityTest(APITestCase):
    endpoint = "sentry-api-0-user-identity-details"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            ident=self.user.email,
            user=self.user,
        )

        self.get_valid_response(self.user.id, auth_identity.id, status_code=204)

        assert not AuthIdentity.objects.filter(id=auth_identity.id).exists()
