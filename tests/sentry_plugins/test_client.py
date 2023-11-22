from unittest.mock import patch

import pytest
import responses

from sentry.services.hybrid_cloud.usersocialauth.serial import serialize_usersocialauth
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiUnauthorized,
    UnsupportedResponseType,
)
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry_plugins.client import ApiClient, AuthApiClient


class ApiClientTest(TestCase):
    @responses.activate
    def test_get(self):
        responses.add(responses.GET, "http://example.com", json={})

        resp = ApiClient().get("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_post(self):
        responses.add(responses.POST, "http://example.com", json={})

        resp = ApiClient().post("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_delete(self):
        responses.add(responses.DELETE, "http://example.com", json={})

        resp = ApiClient().delete("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_put(self):
        responses.add(responses.PUT, "http://example.com", json={})

        resp = ApiClient().put("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_patch(self):
        responses.add(responses.PATCH, "http://example.com", json={})

        resp = ApiClient().patch("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200


@region_silo_test
class AuthApiClientTest(TestCase):
    @responses.activate
    def test_without_authorization(self):
        responses.add(responses.GET, "http://example.com", json={})

        resp = AuthApiClient().get("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get("Authorization")

    @responses.activate
    def test_with_authorization(self):
        responses.add(responses.GET, "http://example.com", json={})

        auth = self.create_usersocialauth(extra_data={"access_token": "access-token"})
        rpc_auth = serialize_usersocialauth(auth=auth)

        resp = AuthApiClient(auth=rpc_auth).get("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert request.headers.get("Authorization") == "Bearer access-token"

    @responses.activate
    def test_with_authorization_and_no_auth(self):
        responses.add(responses.GET, "http://example.com", json={})

        auth = self.create_usersocialauth(extra_data={"access_token": "access-token"})
        rpc_auth = serialize_usersocialauth(auth=auth)
        resp = AuthApiClient(auth=rpc_auth).get("http://example.com", auth=None)

        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert not request.headers.get("Authorization")

    @responses.activate
    def test_with_authorized_token_refresh(self):
        # First attempt
        responses.add(responses.GET, "http://example.com", json={}, status=401)
        # After refresh
        responses.add(responses.GET, "http://example.com", json={}, status=200)

        auth = self.create_usersocialauth(extra_data={"access_token": "access-token"})
        rpc_auth = serialize_usersocialauth(auth=auth)

        with patch("social_auth.models.UserSocialAuth.refresh_token") as mock_refresh_token:
            resp = AuthApiClient(auth=rpc_auth).get("http://example.com")
            assert mock_refresh_token.called

        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

        request = responses.calls[-1].request
        assert request.headers.get("Authorization") == "Bearer access-token"

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
