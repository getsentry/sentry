import pytest

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import MigratingIdentityId
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class FlyOAuth2ProviderTest(TestCase):
    def setUp(self):
        self.auth_provider: AuthProvider = AuthProvider.objects.create(
            provider="fly", organization_id=self.organization.id
        )
        super().setUp()

    def test_refresh_identity_without_refresh_token(self):
        auth_identity: AuthIdentity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider, user=self.user, data={"access_token": "access_token"}
        )

        provider = self.auth_provider.get_provider()

        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(auth_identity)

    def test_build_config(self):
        provider = self.auth_provider.get_provider()
        state = {
            "state": "9da4041848844e8088864eaea3c3a705",
            "data": {
                "access_token": "fo1_6xgeCrB8ew8vFQ86vdaakBSFTVDGCzOUvebUbvgPGhI",
                "token_type": "Bearer",
                "expires_in": 7200,
                "refresh_token": "PmUkAB75UPLKGZplERMq8WwOHnsTllZ5HveY4RvNUTk",
                "scope": "read",
                "created_at": 1686786353,
                "user": {
                    "resource_owner_id": "k9d01lp82rky6vo2",
                    "scope": ["read"],
                    "expires_in": 7200,
                    "application": {"uid": "elMJpuhA5bXbR59ZaKdXrxXGFVKTypGHuJ4h6Rfw1Qk"},
                    "created_at": 1686786353,
                    "user_id": "k9d01lp82rky6vo2",
                    "user_name": "Nathan",
                    "email": "k9d01lp82rky6vo2@customer.fly.io",
                    "organizations": [
                        {"id": "nathans-org", "role": "member"},
                        {"id": "0vogzmzoj1k5xp29", "role": "admin"},
                    ],
                },
            },
        }
        result = provider.build_config(state)
        assert result == {"org": {"id": "nathans-org", "role": "member"}}

    def test_build_identity(self):
        provider = self.auth_provider.get_provider()
        data = {
            "access_token": "fo1_6xgeCrB8ew8vFQ86vdaakBSFTVDGCzOUvebUbvgPGhI",
            "token_type": "Bearer",
            "expires_in": 7200,
            "refresh_token": "PmUkAB75UPLKGZplERMq8WwOHnsTllZ5HveY4RvNUTk",
            "scope": "read",
            "created_at": 1686786353,
        }
        user_info = {
            "resource_owner_id": "k9d01lp82rky6vo2",
            "scope": ["read"],
            "expires_in": 7200,
            "application": {"uid": "elMJpuhA5bXbR59ZaKdXrxXGFVKTypGHuJ4h6Rfw1Qk"},
            "created_at": 1686786353,
            "user_id": "k9d01lp82rky6vo2",
            "user_name": "Nathan",
            "email": "k9d01lp82rky6vo2@customer.fly.io",
            "organizations": [
                {"id": "nathans-org", "role": "member"},
                {"id": "0vogzmzoj1k5xp29", "role": "admin"},
            ],
        }
        state = {
            "state": "9da4041848844e8088864eaea3c3a705",
            "data": data,
            "user": user_info,
        }
        expected_user_id = MigratingIdentityId(
            id=user_info["user_id"], legacy_id=user_info["email"]
        )
        result = provider.build_identity(state)
        assert result == {
            "id": expected_user_id,
            "email": user_info["email"],
            "name": user_info["email"],
            "data": provider.get_oauth_data(data),
            "email_verified": False,
        }
