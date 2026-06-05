from __future__ import annotations

import logging
from typing import Any

import orjson

from sentry import options
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.oauth2 import (
    OAuth2Provider,
    PkceOAuth2CallbackView,
    PkceOAuth2LoginView,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity

logger = logging.getLogger(__name__)


def get_user_info(access_token: str, site: str) -> dict[str, Any]:
    """Fetch the current Datadog user via ``GET /api/v2/current_user``.

    Returns the ``data`` object containing ``id`` (user UUID) and
    ``attributes`` (name, email, handle, etc.).
    """
    url = f"https://api.{site}/api/v2/current_user"
    resp = safe_urlopen(url, method="GET", headers={"Authorization": f"Bearer {access_token}"})
    resp.raise_for_status()

    body = orjson.loads(safe_urlread(resp))
    return body["data"]


class DatadogIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"

    oauth_scopes: tuple[str, ...] = ()

    def get_oauth_client_id(self) -> str:
        return options.get("datadog.client-id")

    def get_oauth_client_secret(self) -> str:
        return options.get("datadog.client-secret")

    def get_oauth_authorize_url(self) -> str:
        site = self._get_site()
        return f"https://app.{site}/oauth2/v1/authorize"

    def get_oauth_access_token_url(self) -> str:
        site = self._get_site()
        return f"https://app.{site}/oauth2/v1/token"

    def _get_site(self) -> str:
        """Return the Datadog site from IdentityProvider.config.

        e.g. ``datadoghq.com``, ``us3.datadoghq.com``, ``datadoghq.eu``.
        """
        return self._get_oauth_parameter("site")

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            PkceOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            PkceOAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_oauth_data(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = super().get_oauth_data(payload)
        if "scope" in payload:
            data["scope"] = payload["scope"]
        return data

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        token_data = data["data"]
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Datadog token exchange did not return an access_token")

        user = get_user_info(access_token, self._get_site())

        return {
            "type": IntegrationProviderSlug.DATADOG,
            "id": user["id"],
            "email": user.get("attributes", {}).get("email"),
            "name": user.get("attributes", {}).get("name"),
            "scopes": [],
            "data": self.get_oauth_data(token_data),
        }

    def get_refresh_token_url(self) -> str:
        return self.get_oauth_access_token_url()

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.get_oauth_client_id(),
            "client_secret": self.get_oauth_client_secret(),
        }
