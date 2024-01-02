from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from social_auth.models import UserSocialAuth


@control_silo_test
class UserSocialIdentitiesIndexTest(APITestCase):
    endpoint = "sentry-api-0-user-social-identities-index"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        UserSocialAuth.create_social_auth(self.user, "1234", "github")

        response = self.get_success_response(self.user.id)
        assert len(response.data) == 1
        assert response.data[0]["provider"] == "github"
