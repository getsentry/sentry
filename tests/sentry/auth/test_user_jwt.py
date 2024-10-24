from datetime import datetime, timedelta
from math import isclose
from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest

from sentry import options
from sentry.auth.user_jwt import InvalidTokenError, UserJWTToken, get_jwt_token
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.jwt import peek_claims


@control_silo_test
class UserJWTTokenTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.expiration = datetime.now() + timedelta(days=30)

    def test_from_request_requires_active_user(self):
        request = HttpRequest()
        request.user = AnonymousUser()

        result = UserJWTToken.from_request(request, {})
        assert result is None

    def test_from_request_requires_organization_in_context(self):
        request = HttpRequest()
        request.user = self.user

        result = UserJWTToken.from_request(request, {"organization": None})
        assert result is None

    def test_from_request_requires_project_in_context(self):
        request = HttpRequest()
        request.user = self.user

        result = UserJWTToken.from_request(
            request, {"organization": self.organization, "project": None}
        )
        assert result is None

    def test_from_request_requires_sets_claims(self):
        request = HttpRequest()
        request.user = self.user

        result = UserJWTToken.from_request(
            request, {"organization": self.organization, "project": self.project}
        )
        assert result is not None
        claims = peek_claims(result)
        assert claims.get("exp") == int(self.expiration.timestamp())
        assert claims.get("iss") == options.get("system.base-hostname")
        assert isclose(claims.get("iat"), datetime.now().timestamp())
        assert claims.get("sub") == self.user.id
        assert claims.get("org") == self.organization.id
        assert claims.get("proj") == self.project.id

    def test_is_jwt_accepts_any_jwt_shape(self):
        # minimal JWT with header=`{"typ": "JWT","alg": "HS256"}` with empty body & secret
        assert (
            UserJWTToken.is_jwt(
                "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.e30.uJKHM4XyWv1bC_-rpkjK19GUy0Fgrkm_pGHi8XghjWM"
            )
            is True
        )

    def test_is_jwt_rejects_random_strings(self):
        with pytest.raises(InvalidTokenError):
            UserJWTToken.is_jwt("foo")
        with pytest.raises(InvalidTokenError):
            UserJWTToken.is_jwt("abc.def.ace")
        with pytest.raises(InvalidTokenError):
            UserJWTToken.is_jwt("abc.e30.uJKHM4XyWv1bC_-rpkjK19GUy0Fgrkm_pGHi8XghjWM")

    def test_decode_verified_user_raises_when_signature_invalid(self):
        with pytest.raises(InvalidTokenError):
            UserJWTToken.decode_verified_user("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.e30.FOOBAR")

    @mock.patch("sentry.options.get", side_effect=iter(["a", "b", "c", "d"]))
    def test_decode_verified_user_raises_when_issuer_invalid(self, mock_options_get):
        token = get_jwt_token(self.user, self.organization, self.project, self.expiration)

        with pytest.raises(InvalidTokenError):
            UserJWTToken.decode_verified_user(token)

    def test_decode_verified_user_raises_when_expiration_passed(self):
        three_days_ago = datetime.now() - timedelta(days=3)
        token = get_jwt_token(self.user, self.organization, self.project, three_days_ago)
        with pytest.raises(InvalidTokenError):
            UserJWTToken.decode_verified_user(token)

    def test_decode_verified_user_returns_signed_userid(self):
        token = get_jwt_token(self.user, self.organization, self.project, self.expiration)
        assert UserJWTToken.decode_verified_user(token) == self.user.id
