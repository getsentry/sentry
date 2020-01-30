from __future__ import absolute_import

import responses

from time import time
from sentry.testutils import TestCase

from sentry.identity import register
from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.identity.oauth2 import OAuth2Provider
from sentry.models import Identity, IdentityProvider


class ApiClientTest(TestCase):
    @responses.activate
    def test_get(self):
        responses.add(responses.GET, "http://example.com", json={})

        resp = ApiClient().get("http://example.com")
        assert resp.status_code == 200

    @responses.activate
    def test_post(self):
        responses.add(responses.POST, "http://example.com", json={})

        resp = ApiClient().post("http://example.com")
        assert resp.status_code == 200

    @responses.activate
    def test_delete(self):
        responses.add(responses.DELETE, "http://example.com", json={})

        resp = ApiClient().delete("http://example.com")
        assert resp.status_code == 200

    @responses.activate
    def test_put(self):
        responses.add(responses.PUT, "http://example.com", json={})

        resp = ApiClient().put("http://example.com")
        assert resp.status_code == 200

    @responses.activate
    def test_patch(self):
        responses.add(responses.PATCH, "http://example.com", json={})

        resp = ApiClient().patch("http://example.com")
        assert resp.status_code == 200


class OAuthProvider(OAuth2Provider):
    key = "oauth"
    name = "OAuth Provider"

    def get_client_id(self):
        return "client_id"

    def get_client_secret(self):
        return "client_secret"

    def get_refresh_token_url(self):
        return "https://example.com"


class OAuth2ApiClient(ApiClient, OAuth2RefreshMixin):
    def __init__(self, identity, *args, **kwargs):
        super(OAuth2ApiClient, self).__init__(*args, **kwargs)
        self.identity = identity


class OAuth2ApiClientTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.access_token = "1234567890"
        self.identity_provider_model = IdentityProvider.objects.create(type="oauth")
        register(OAuthProvider)

    @responses.activate
    def test_check_auth(self):
        new_auth = {
            "access_token": "1234567890",
            "refresh_token": "0987654321",
            "expires_in": 45678988239,
        }
        responses.add(responses.POST, "https://example.com", json=new_auth)
        identity = Identity.objects.create(
            idp=self.identity_provider_model,
            user=self.user,
            external_id="oauth_base",
            data={
                "access_token": "access_token",
                "refresh_token": "refresh_token",
                "expires": int(time()) - 3600,
            },
        )

        client = OAuth2ApiClient(identity)
        client.check_auth()

        assert client.identity.data["access_token"] == new_auth["access_token"]
        assert client.identity.data["refresh_token"] == new_auth["refresh_token"]
        assert client.identity.data["expires"] > int(time())

    @responses.activate
    def test_check_auth_no_refresh(self):
        new_auth = {
            "access_token": "1234567890",
            "refresh_token": "0987654321",
            "expires_in": 45678988239,
        }
        old_auth = {
            "access_token": "access_token",
            "refresh_token": "refresh_token",
            "expires": int(time()) + 3600,
        }
        responses.add(responses.POST, "https://example.com", json=new_auth)
        identity = Identity.objects.create(
            idp=self.identity_provider_model,
            user=self.user,
            external_id="oauth_base",
            data=old_auth,
        )

        client = OAuth2ApiClient(identity)
        client.check_auth()

        assert client.identity.data == old_auth
