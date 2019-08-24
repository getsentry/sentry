from __future__ import absolute_import

from django.core.urlresolvers import reverse

from social_auth.models import UserSocialAuth
from sentry.testutils import APITestCase


class UserSocialIdentityDetailsEndpointTest(APITestCase):
    def setUp(self):
        self.login_as(self.user)

    def test_can_disconnect(self):
        auth = UserSocialAuth.create_social_auth(self.user, "1234", "github")
        url = reverse(
            "sentry-api-0-user-social-identity-details",
            kwargs={"user_id": self.user.id, "identity_id": auth.id},
        )
        with self.settings(GITHUB_APP_ID="app-id", GITHUB_API_SECRET="secret"):
            response = self.client.delete(url)
            assert response.status_code == 204
            assert not len(UserSocialAuth.objects.filter(user=self.user))

    def test_disconnect_id_not_found(self):
        url = reverse(
            "sentry-api-0-user-social-identity-details",
            kwargs={"user_id": self.user.id, "identity_id": 999},
        )
        with self.settings(GITHUB_APP_ID="app-id", GITHUB_API_SECRET="secret"):
            response = self.client.delete(url)
            assert response.status_code == 404
            assert not len(UserSocialAuth.objects.filter(user=self.user))
