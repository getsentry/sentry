from functools import cached_property
from typing import List

import pytest
from django.urls import reverse

from sentry.models import ApiApplication, ApiGrant, ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class OAuthRevokeTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-oauth-revoke")

    def setUp(self):
        super().setUp()

        # create a dummy api application
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://localhost:1234",
        )

        # create a second application to test app ownership boundary
        self.other_application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://localhost:5678",
        )

        self.grants: List[ApiGrant] = []
        self.tokens: List[ApiToken] = []

        for i in range(4):
            # authorize the api application to act on behalf of the test user
            grant = ApiGrant.objects.create(
                user=self.user,
                application=self.application,
                redirect_uri="http://localhost:1234",
            )
            self.grants.append(grant)

            # create associated token from the grant
            token = ApiToken.from_grant(self.grants[i])
            self.tokens.append(token)

    def test_no_get(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_can_revoke_by_access_token(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token_type_hint": "access_token",  # provided access_token hint
                "token": self.tokens[0].token,  # access_token
            },
        )
        assert resp.status_code == 200

        with pytest.raises(ApiToken.DoesNotExist):
            ApiToken.objects.get(id=self.tokens[0].id)

    def test_can_revoke_by_refresh_token(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token_type_hint": "refresh_token",  # provided refresh_token hint
                "token": self.tokens[1].refresh_token,  # refresh_token
            },
        )
        assert resp.status_code == 200

        with pytest.raises(ApiToken.DoesNotExist):
            ApiToken.objects.get(id=self.tokens[1].id)

    def test_can_revoke_by_access_token_without_hint(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token": self.tokens[2].token,  # just provided the access token, no hint
            },
        )
        assert resp.status_code == 200

        with pytest.raises(ApiToken.DoesNotExist):
            ApiToken.objects.get(id=self.tokens[2].id)

    def test_can_revoke_by_refresh_token_without_hint(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token": self.tokens[3].refresh_token,  # just provided the refresh_token, no hint
            },
        )
        assert resp.status_code == 200

        with pytest.raises(ApiToken.DoesNotExist):
            ApiToken.objects.get(id=self.tokens[3].id)

    def test_missing_token(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_request"
        assert resp.json()["error_description"] == "token parameter not found"

    def test_missing_client_id(self):
        resp = self.client.post(
            self.path,
            data={
                "client_secret": self.application.client_secret,
                "token_type_hint": "access_token",  # provided access_token hint
                "token": self.tokens[0].token,  # access_token
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_client"
        assert resp.json()["error_description"] == "client_id parameter not found"

    def test_missing_client_secret(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "token_type_hint": "access_token",  # provided access_token hint
                "token": self.tokens[0].token,  # access_token
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_client"
        assert resp.json()["error_description"] == "client_secret parameter not found"

    def test_unsupported_token_type(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token_type_hint": "lorem_ipsum_dolor",  # provided access_token hint
                "token": self.tokens[0].token,  # access_token
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "unsupported_token_type"
        assert (
            resp.json()["error_description"]
            == "an unsupported token_type_hint was provided, must be either 'access_token' or 'refresh_token'"
        )

    def test_non_existent_token_returns_200(self):
        # even in the case of invalid tokens we are supposed to respond with an HTTP 200 per the RFC
        # See: https://www.rfc-editor.org/rfc/rfc7009#section-2.2
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
                "token": "token123456does123456not123456exist",
            },
        )

        assert resp.status_code == 200

    def test_invalid_client_id(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": "someclientid123456",
                "client_secret": self.application.client_secret,
                "token": self.tokens[0].token,
            },
        )

        assert resp.status_code == 401
        assert resp.json()["error"] == "invalid_client"
        assert resp.json()["error_description"] == "failed to authenticate client"

    def test_invalid_client_secret(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": self.application.client_id,
                "client_secret": "someclientsecret123456",
                "token": self.tokens[0].token,
            },
        )

        assert resp.status_code == 401
        assert resp.json()["error"] == "invalid_client"
        assert resp.json()["error_description"] == "failed to authenticate client"

    def test_invalid_client_credentials(self):
        resp = self.client.post(
            self.path,
            data={
                "client_id": "invalidclientid123456",
                "client_secret": "someclientsecret123456",
                "token": self.tokens[0].token,
            },
        )

        assert resp.status_code == 401
        assert resp.json()["error"] == "invalid_client"
        assert resp.json()["error_description"] == "failed to authenticate client"

    def test_application_cannot_revoke_others_tokens(self):
        resp = self.client.post(
            self.path,
            data={
                # use another application's valid credentials that does not own
                # the targeted token
                "client_id": self.other_application.client_id,
                "client_secret": self.other_application.client_secret,
                "token": self.tokens[0].token,
            },
        )

        # seems odd at first, but per the RFC (https://www.rfc-editor.org/rfc/rfc7009#section-2.2)
        # this would just be treated as an invalid token in the context of tokens this client owns.
        # In order to avoid enumeration attempts we return a 200 and just silently do nothing.
        assert resp.status_code == 200

        # even though the token was real, it should still exist. A client is only able to revoke
        # tokens it owns.
        api_token_count = ApiToken.objects.filter(id=self.tokens[0].id).count()
        assert 1 == api_token_count
