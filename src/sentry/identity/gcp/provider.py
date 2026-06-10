from __future__ import annotations

from typing import Any

import orjson

from sentry import options
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.oauth2 import (
    OAuth2ApiStep,
    OAuth2CallbackView,
    OAuth2LoginView,
    OAuth2Provider,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity
from sentry.utils.signing import urlsafe_b64decode


class GCPOAuth2LoginView(OAuth2LoginView):
    """OAuth2 login for the GCP MCP with offline access for refresh tokens."""

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        params = super().get_authorize_params(state, redirect_uri)
        params["access_type"] = "offline"  # Required for Google to return a refresh token
        params["prompt"] = (
            "consent"  # Forces consent screen so refresh token is returned even on re-auth
        )
        return params


class GCPIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.GCP
    name = "Google Cloud Platform"

    oauth_access_token_url = "https://oauth2.googleapis.com/token"
    oauth_authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"

    oauth_scopes = (
        "openid",
        "email",
        "https://www.googleapis.com/auth/logging.read",
        "https://www.googleapis.com/auth/monitoring.read",
        "https://www.googleapis.com/auth/trace.readonly",
    )

    def get_oauth_client_id(self) -> str:
        return options.get("gcp.client-id")

    def get_oauth_client_secret(self) -> str:
        return options.get("gcp.client-secret")

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            GCPOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            OAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def make_oauth_api_step(self, **kwargs: Any) -> OAuth2ApiStep:
        return super().make_oauth_api_step(
            extra_authorize_params={"access_type": "offline", "prompt": "consent"},
            **kwargs,
        )

    def build_identity(self, state: dict[str, Any]) -> dict[str, Any]:
        data = state.get("data", {})

        try:
            id_token = data["id_token"]
        except KeyError:
            raise IdentityNotValid("Missing id_token in OAuth response")

        try:
            _, payload, _ = map(urlsafe_b64decode, id_token.split(".", 2))
        except Exception as exc:
            raise IdentityNotValid("Unable to decode id_token: %s" % exc)

        try:
            user_data = orjson.loads(payload)
        except ValueError as exc:
            raise IdentityNotValid("Unable to decode id_token payload: %s" % exc)

        user_id = user_data.get("sub")
        if not user_id:
            raise IdentityNotValid("Missing sub claim in id_token")

        return {
            "type": IntegrationProviderSlug.GCP,
            "id": user_id,
            "email": user_data.get("email"),
            "name": user_data.get("name", user_data.get("email")),
            "scopes": sorted(self.oauth_scopes),
            "data": self.get_oauth_data(data),
        }

    def get_refresh_token_url(self) -> str:
        return self.oauth_access_token_url

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.get_oauth_client_id(),
            "client_secret": self.get_oauth_client_secret(),
        }
