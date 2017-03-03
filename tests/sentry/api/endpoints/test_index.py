from __future__ import absolute_import

import six

from base64 import b64encode
from django.core.urlresolvers import reverse

from sentry.models import ApiKey, ApiToken
from sentry.testutils import APITestCase


class ApiIndexTest(APITestCase):
    def test_anonymous(self):
        url = reverse('sentry-api-index')
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['version'] == '0'
        assert not response.data['user']
        assert not response.data['auth']

    def test_session_auth(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-index')
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['version'] == '0'
        assert response.data['user']['id'] == six.text_type(self.user.id)
        assert not response.data['auth']

    def test_key_auth(self):
        org = self.create_organization()
        key = ApiKey.objects.create(
            organization=org,
        )
        url = reverse('sentry-api-index')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Basic ' + b64encode('{}:'.format(key.key)),
        )
        assert response.status_code == 200
        assert response.data['version'] == '0'
        assert response.data['auth']['scopes'] == key.get_scopes()
        assert not response.data['user']

    def test_token_auth(self):
        token = ApiToken.objects.create(
            user=self.user,
        )
        url = reverse('sentry-api-index')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
        )
        assert response.status_code == 200
        assert response.data['version'] == '0'
        assert response.data['auth']['scopes'] == token.get_scopes()
        assert response.data['user']['id'] == six.text_type(self.user.id)
