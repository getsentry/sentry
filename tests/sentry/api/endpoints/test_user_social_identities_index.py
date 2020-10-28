from __future__ import absolute_import

from django.core.urlresolvers import reverse

from social_auth.models import UserSocialAuth
from sentry.testutils import APITestCase


class UserSocialIdentitiesIndexTest(APITestCase):
    def test_simple(self):
        UserSocialAuth.create_social_auth(self.user, "1234", "github")
        self.login_as(self.user)
        url = reverse("sentry-api-0-user-social-identities-index", kwargs={"user_id": self.user.id})
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["provider"] == "github"
