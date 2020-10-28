from __future__ import absolute_import

import pytest
import responses

from sentry.utils.compat.mock import Mock
from sentry.testutils import TestCase

from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiUnauthorized,
    UnsupportedResponseType,
)
from sentry_plugins.client import ApiClient, AuthApiClient


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


class AuthApiClientTest(TestCase):
    @responses.activate
    def test_without_authorization(self):
        responses.add(responses.GET, "http://example.com", json={})

        resp = AuthApiClient().get("http://example.com")
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get("Authorization")

    @responses.activate
    def test_with_authorization(self):
        responses.add(responses.GET, "http://example.com", json={})

        auth = Mock()
        auth.tokens = {"access_token": "access-token"}

        resp = AuthApiClient(auth=auth).get("http://example.com")
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert request.headers.get("Authorization") == "Bearer access-token"

    @responses.activate
    def test_with_authorization_and_no_auth(self):
        responses.add(responses.GET, "http://example.com", json={})

        auth = Mock()
        auth.tokens = {"access_token": "access-token"}

        resp = AuthApiClient(auth=auth).get("http://example.com", auth=None)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get("Authorization")

    @responses.activate
    def test_invalid_host(self):
        with pytest.raises(ApiHostError):
            AuthApiClient().get("http://example.com")

    @responses.activate
    def test_unauthorized(self):
        responses.add(responses.GET, "http://example.com", status=404)
        with pytest.raises(ApiError):
            AuthApiClient().get("http://example.com")

    @responses.activate
    def test_forbidden(self):
        responses.add(responses.GET, "http://example.com", status=401)
        with pytest.raises(ApiUnauthorized):
            AuthApiClient().get("http://example.com")

    @responses.activate
    def test_invalid_plaintext(self):
        responses.add(responses.GET, "http://example.com", body="")
        with pytest.raises(UnsupportedResponseType):
            AuthApiClient().get("http://example.com")
