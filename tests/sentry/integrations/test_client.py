from __future__ import absolute_import

import pytest
import responses

from django.utils import timezone
from datetime import timedelta
from mock import Mock
from sentry.testutils import TestCase

from sentry.integrations.exceptions import (
    ApiError, ApiHostError, ApiUnauthorized, UnsupportedResponseType
)
from sentry.integrations.client import ApiClient, AuthApiClient, OAuth2ApiClient
from sentry.identity.oauth2 import OAuth2Provider
from sentry.models import Identity, IdentityProvider


class ApiClientTest(TestCase):
    @responses.activate
    def test_get(self):
        responses.add(responses.GET, 'http://example.com', json={})

        resp = ApiClient().get('http://example.com')
        assert resp.status_code == 200

    @responses.activate
    def test_post(self):
        responses.add(responses.POST, 'http://example.com', json={})

        resp = ApiClient().post('http://example.com')
        assert resp.status_code == 200

    @responses.activate
    def test_delete(self):
        responses.add(responses.DELETE, 'http://example.com', json={})

        resp = ApiClient().delete('http://example.com')
        assert resp.status_code == 200

    @responses.activate
    def test_put(self):
        responses.add(responses.PUT, 'http://example.com', json={})

        resp = ApiClient().put('http://example.com')
        assert resp.status_code == 200

    @responses.activate
    def test_patch(self):
        responses.add(responses.PATCH, 'http://example.com', json={})

        resp = ApiClient().patch('http://example.com')
        assert resp.status_code == 200


class AuthApiClientTest(TestCase):
    @responses.activate
    def test_without_authorization(self):
        responses.add(responses.GET, 'http://example.com', json={})

        resp = AuthApiClient().get('http://example.com')
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get('Authorization')

    @responses.activate
    def test_with_authorization(self):
        responses.add(responses.GET, 'http://example.com', json={})

        auth = Mock()
        auth.tokens = {
            'access_token': 'access-token',
        }

        resp = AuthApiClient(auth=auth).get('http://example.com')
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert request.headers.get('Authorization') == 'Bearer access-token'

    @responses.activate
    def test_with_authorization_and_no_auth(self):
        responses.add(responses.GET, 'http://example.com', json={})

        auth = Mock()
        auth.tokens = {
            'access_token': 'access-token',
        }

        resp = AuthApiClient(auth=auth).get('http://example.com', auth=None)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get('Authorization')

    @responses.activate
    def test_invalid_host(self):
        with pytest.raises(ApiHostError):
            AuthApiClient().get('http://example.com')

    @responses.activate
    def test_unauthorized(self):
        responses.add(responses.GET, 'http://example.com', status=404)
        with pytest.raises(ApiError):
            AuthApiClient().get('http://example.com')

    @responses.activate
    def test_forbidden(self):
        responses.add(responses.GET, 'http://example.com', status=401)
        with pytest.raises(ApiUnauthorized):
            AuthApiClient().get('http://example.com')

    @responses.activate
    def test_invalid_plaintext(self):
        responses.add(responses.GET, 'http://example.com', body='')
        with pytest.raises(UnsupportedResponseType):
            AuthApiClient().get('http://example.com')


class OAuthProvider(OAuth2Provider):
    key = 'oauth'
    name = 'OAuth Provider'

    def get_client_id(self):
        return 'client_id'

    def get_client_secret(self):
        return 'client_secret'

    def get_refresh_token_url(self):
        return 'https://world.wide.web'


class OAuth2ApiClientTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.access_token = '1234567890'
        self.identity_provider_model = IdentityProvider.objects.create(type='OAuthBase')
        self.identity_provider = OAuthProvider()

    def test_check_auth(self):
        new_auth = {
            'access_token': '1234567890',
            'refrsh_token': '0987654321',
            'expires_in': '45678988239',
        }
        responses.add(
            responses.POST,
            'https://world.wide.web',
            json=new_auth,
        )
        identity = Identity.objects.create(
            idp=self.identity_provider_model,
            user=self.user,
            external_id='oauth_base',
            data={
                'access_token': 'access_token',
                'refresh_token': 'refresh_token',
                'expires': timezone.now() - timedelta(days=200)
            }
        )
        client = OAuth2ApiClient(identity)
        client.check_auth()

        assert client.identity.config['access_token'] == new_auth['access_token']
        assert client.identity.config['refresh_token'] == new_auth['refresh_token']
        assert client.identity.config['expires'] > timezone.now()
