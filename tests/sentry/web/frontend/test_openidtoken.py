from datetime import datetime

from sentry.models.apiapplication import ApiApplication
from sentry.models.apigrant import ApiGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import jwt as jwt_utils
from sentry.web.frontend.openidtoken import OpenIDToken


@control_silo_test
class OpenIDTokenTest(TestCase):
    def setUp(self):
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.id_token = OpenIDToken("ex_client_id", self.user.id, "shared_secret", nonce="abcd")

    def test_get_user_details_no_scope(self):
        grant_no_scopes = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid"],
        )

        user_details = self.id_token._get_user_details(grant_no_scopes)
        assert user_details == {}

    def test_get_user_details_profile_scope(self):
        grant_profile_scope = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid", "profile"],
        )
        user_details = self.id_token._get_user_details(grant_profile_scope)
        assert user_details == {
            "name": grant_profile_scope.user.name,
            "avatar_type": grant_profile_scope.user.avatar_type,
            "avatar_url": grant_profile_scope.user.avatar_url,
            "date_joined": str(grant_profile_scope.user.date_joined),
        }

    def test_get_user_details_email_scope(self):
        grant_email_scope = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid", "email"],
        )
        user_details = self.id_token._get_user_details(grant_email_scope)
        assert user_details == {"email": "admin@localhost", "email_verified": True}

    def test_get_user_details_multiple_scopes(self):
        grant_multiple_scopes = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid", "email", "profile"],
        )
        user_details = self.id_token._get_user_details(grant_multiple_scopes)

        assert user_details == {
            "email": "admin@localhost",
            "email_verified": True,
            "name": grant_multiple_scopes.user.name,
            "avatar_type": grant_multiple_scopes.user.avatar_type,
            "avatar_url": grant_multiple_scopes.user.avatar_url,
            "date_joined": str(grant_multiple_scopes.user.date_joined),
        }

    def test_get_signed_id_token_no_scopes(self):
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid"],
        )
        id_token = OpenIDToken("ex_client_id", self.user.id, "shared_secret", nonce="abcd")
        encrypted_id_token = id_token.get_signed_id_token(grant)
        assert encrypted_id_token.count(".") == 2

        decrypted_id_token = jwt_utils.decode(
            encrypted_id_token, "shared_secret", audience="ex_client_id"
        )

        now = datetime.now()
        current_timestamp = datetime.timestamp(now)

        assert decrypted_id_token["aud"] == "ex_client_id"
        assert decrypted_id_token["iss"] == "https://sentry.io"
        assert decrypted_id_token["nonce"] == "abcd"
        assert isinstance(decrypted_id_token["sub"], int)
        assert decrypted_id_token["exp"] > current_timestamp
        assert decrypted_id_token["iat"] < current_timestamp

    def test_get_signed_id_token_with_scopes(self):
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            scope_list=["openid", "profile", "email"],
        )
        id_token = OpenIDToken("ex_client_id", self.user.id, "shared_secret", nonce="abcd")
        encrypted_id_token = id_token.get_signed_id_token(grant)
        assert encrypted_id_token.count(".") == 2

        decrypted_id_token = jwt_utils.decode(
            encrypted_id_token, "shared_secret", audience="ex_client_id"
        )

        now = datetime.now()
        current_timestamp = datetime.timestamp(now)

        assert decrypted_id_token["aud"] == "ex_client_id"
        assert decrypted_id_token["iss"] == "https://sentry.io"
        assert decrypted_id_token["nonce"] == "abcd"
        assert isinstance(decrypted_id_token["sub"], int)
        assert decrypted_id_token["exp"] > current_timestamp
        assert decrypted_id_token["iat"] < current_timestamp
        assert decrypted_id_token["email"] == "admin@localhost"
        assert decrypted_id_token["email_verified"] is True
        assert decrypted_id_token["name"] == grant.user.name
        assert decrypted_id_token["avatar_type"] == grant.user.avatar_type
        assert decrypted_id_token["avatar_url"] == grant.user.avatar_url
        assert decrypted_id_token["date_joined"] == str(grant.user.date_joined)
