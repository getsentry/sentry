from __future__ import absolute_import
import responses
import pytest

from sentry.auth.exceptions import IdentityNotValid
from sentry.models import Identity
from sentry.utils import json
from .testutils import GitLabTestCase


class GitlabRefreshAuthTest(GitLabTestCase):
    get_user_should_succeed = True

    def setUp(self):
        super(GitlabRefreshAuthTest, self).setUp()
        self.client = self.installation.get_client()
        self.request_data = {"id": "user_id"}
        self.request_url = "https://example.gitlab.com/api/v4/user"
        self.refresh_url = "https://example.gitlab.com/oauth/token"
        self.refresh_response = {
            "access_token": "123432sfh29uhs29347",
            "token_type": "bearer",
            "refresh_token": "29f43sdfsk22fsj929",
            "created_at": 1536798907,
            "scope": "api",
        }
        self.original_identity_data = dict(self.client.identity.data)

    def tearDown(self):
        responses.reset()

    def make_users_request(self):
        return self.client.get_user()

    def add_refresh_auth(self, success=True):
        responses.add(
            responses.POST,
            self.refresh_url,
            status=200 if success else 401,
            json=self.refresh_response if success else {},
        )

    def add_get_user_response(self, success):
        responses.add(
            responses.GET,
            self.request_url,
            json=self.request_data if success else {},
            status=200 if success else 401,
        )

    def assert_response_call(self, call, url, status):
        assert call.request.url == url
        assert call.response.status_code == status

    def assert_data(self, data, expected_data):
        assert data["access_token"] == expected_data["access_token"]
        assert data["refresh_token"] == expected_data["refresh_token"]
        assert data["created_at"] == expected_data["created_at"]

    def assert_request_failed_refresh(self):
        responses_calls = responses.calls
        assert len(responses_calls) == 2

        self.assert_response_call(responses_calls[0], self.request_url, 401)
        self.assert_response_call(responses_calls[1], self.refresh_url, 401)

    def assert_request_with_refresh(self):
        responses_calls = responses.calls
        assert len(responses_calls) == 3

        self.assert_response_call(responses_calls[0], self.request_url, 401)
        self.assert_response_call(responses_calls[1], self.refresh_url, 200)
        self.assert_response_call(responses_calls[2], self.request_url, 200)

        assert json.loads(responses_calls[2].response.text) == self.request_data

    def assert_identity_was_refreshed(self):
        data = self.client.identity.data
        self.assert_data(data, self.refresh_response)

        data = Identity.objects.get(id=self.client.identity.id).data
        self.assert_data(data, self.refresh_response)

    def assert_identity_was_not_refreshed(self):
        data = self.client.identity.data
        self.assert_data(data, self.original_identity_data)

        data = Identity.objects.get(id=self.client.identity.id).data
        self.assert_data(data, self.original_identity_data)

    @responses.activate
    def test_refresh_auth_flow(self):
        # Fail first then succeed
        self.add_get_user_response(success=False)
        self.add_get_user_response(success=True)

        self.add_refresh_auth(success=True)

        resp = self.make_users_request()
        self.assert_request_with_refresh()
        assert resp == self.request_data
        self.assert_identity_was_refreshed()

    @responses.activate
    def test_refresh_auth_fails_gracefully(self):
        self.add_get_user_response(success=False)
        self.add_refresh_auth(success=False)

        with pytest.raises(IdentityNotValid):
            self.make_users_request()

        self.assert_request_failed_refresh()
        self.assert_identity_was_not_refreshed()

    @responses.activate
    def test_no_refresh_when_api_call_successful(self):
        self.add_get_user_response(success=True)
        resp = self.make_users_request()

        len(responses.calls) == 1
        call = responses.calls[0]
        self.assert_response_call(call, self.request_url, 200)
        assert resp == self.request_data
        self.assert_identity_was_not_refreshed()
