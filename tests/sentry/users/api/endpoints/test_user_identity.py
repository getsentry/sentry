from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityStatus


@control_silo_test
class UserIdentityTest(APITestCase):
    endpoint = "sentry-api-0-user-identity"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        response = self.get_success_response(self.user.id)
        assert response.data[0]["identityProvider"]["type"] == "slack"
