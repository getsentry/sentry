from unittest.mock import patch

import pytest

from sentry import identity
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.gitea.provider import GiteaIdentityProvider, get_oauth_data
from sentry.integrations.types import IntegrationProviderSlug
from sentry.testutils.cases import TestCase


class GiteaIdentityProviderTest(TestCase):
    def test_registered(self) -> None:
        assert identity.exists(IntegrationProviderSlug.GITEA.value)
        assert isinstance(identity.get(IntegrationProviderSlug.GITEA.value), GiteaIdentityProvider)

    def test_get_oauth_data_records_expiry(self) -> None:
        with patch("sentry.identity.gitea.provider.time", return_value=1000):
            data = get_oauth_data(
                {
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    "token_type": "bearer",
                    "expires_in": 3600,
                }
            )

        assert data == {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "token_type": "bearer",
            "expires": 4600,
        }

    def test_get_oauth_data_without_optional_fields(self) -> None:
        assert get_oauth_data({"access_token": "access-token"}) == {"access_token": "access-token"}

    def test_build_identity(self) -> None:
        provider = GiteaIdentityProvider()
        result = provider.build_identity(
            {
                "data": {
                    "access_token": "access-token",
                    "scope": "read:repository write:repository read:user",
                    "user": {"id": 42, "email": "bot@example.com"},
                }
            }
        )

        assert result["type"] == IntegrationProviderSlug.GITEA.value
        assert result["id"] == 42
        assert result["email"] == "bot@example.com"
        assert result["scopes"] == ["read:repository", "read:user", "write:repository"]
        assert result["data"]["access_token"] == "access-token"

    def test_refresh_identity_requires_a_refresh_token(self) -> None:
        provider = GiteaIdentityProvider()
        identity_model = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(
                type=IntegrationProviderSlug.GITEA.value
            ),
            external_id="gitea.example.com:42",
        )
        identity_model.data = {}

        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(
                identity_model,
                refresh_token_url="https://gitea.example.com/login/oauth/access_token",
            )

    def test_refresh_identity_requires_a_refresh_token_url(self) -> None:
        provider = GiteaIdentityProvider()
        identity_model = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(
                type=IntegrationProviderSlug.GITEA.value
            ),
            external_id="gitea.example.com:42",
        )
        identity_model.data = {"refresh_token": "refresh-token"}

        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(identity_model)
