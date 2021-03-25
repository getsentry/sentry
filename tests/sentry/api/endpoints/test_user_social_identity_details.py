from social_auth.models import UserSocialAuth
from sentry.testutils import APITestCase


class UserSocialIdentityDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-user-social-identity-details"
    method = "delete"

    def setUp(self):
        self.login_as(self.user)

    def test_can_disconnect(self):
        auth = UserSocialAuth.create_social_auth(self.user, "1234", "github")

        with self.settings(GITHUB_APP_ID="app-id", GITHUB_API_SECRET="secret"):
            self.get_valid_response(self.user.id, auth.id, status_code=204)
            assert not len(UserSocialAuth.objects.filter(user=self.user))

    def test_disconnect_id_not_found(self):
        with self.settings(GITHUB_APP_ID="app-id", GITHUB_API_SECRET="secret"):
            self.get_valid_response(self.user.id, 999, status_code=404)
            assert not len(UserSocialAuth.objects.filter(user=self.user))
