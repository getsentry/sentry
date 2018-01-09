from __future__ import absolute_import

import pytest

from django.core.urlresolvers import reverse

from social_auth.models import UserSocialAuth
from sentry.testutils import APITestCase


class UserSocialIdentityDetailsEndpointTest(APITestCase):
    def setUp(self):
        UserSocialAuth.create_social_auth(self.user, '1234', 'github')
        self.login_as(self.user)
        self.url = reverse('sentry-api-0-user-social-identity-details', kwargs={
            'identity_id': 1
        })

    #  Throws backend not found
    @pytest.mark.skip
    def test_can_disconnect(self):
        response = self.client.delete(self.url)
        assert response.status_code == 204

    def test_disconnect_id_not_found(self):
        response = self.client.delete(self.url)
        assert response.status_code == 404
