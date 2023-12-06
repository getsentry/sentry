from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserIdentityTest(APITestCase):
    endpoint = "sentry-api-0-user-identity"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        response = self.get_success_response(self.user.id)
        assert response.data[0]["identityProvider"]["type"] == "slack"
