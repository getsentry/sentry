from __future__ import annotations

import logging
from time import time
from typing import Any

import orjson

from sentry import http
from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlread
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.services.identity import identity_service
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integration.gitea")


def get_oauth_data(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize a Gitea token response into the shape we persist on the Identity.

    Gitea returns:
    {
      "access_token": "...",
      "token_type": "bearer",
      "expires_in": 3600,
      "refresh_token": "...",
      "scope": "read:repository write:repository read:user write:issue"
    }
    """
    data: dict[str, Any] = {"access_token": payload["access_token"]}

    # Gitea access tokens are short lived (1 hour by default), so `expires` is
    # the field that actually drives the refresh path.
    if "expires_in" in payload:
        data["expires"] = int(time()) + int(payload["expires_in"])
    if "refresh_token" in payload:
        data["refresh_token"] = payload["refresh_token"]
    if "token_type" in payload:
        data["token_type"] = payload["token_type"]
    return data


def get_user_info(access_token: str, installation_data: dict[str, Any]) -> dict[str, Any]:
    with http.build_session() as session:
        resp = session.get(
            f"{installation_data['url']}/api/v1/user",
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
            verify=installation_data.get("verify_ssl", True),
        )
    try:
        resp.raise_for_status()
    except Exception as e:
        logger.info(
            "gitea.identity.get-user-info-failure",
            extra={
                "url": installation_data["url"],
                "verify_ssl": installation_data.get("verify_ssl", True),
                "client_id": installation_data.get("client_id"),
                "error_status": getattr(resp, "status_code"),  # error might not be an HTTP error
                "error_message": f"{e}",
            },
        )
        raise
    return resp.json()


class GiteaIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.GITEA.value
    name = "Gitea"

    # Gitea's OAuth2 scope enforcement is immature - a token can end up with
    # broader access than the requested scopes suggest. Request the minimum
    # anyway, and treat the token as broadly privileged in threat-model terms.
    # `write:issue` is what backs issue creation, linking and commenting; Gitea
    # treats a write scope as implying its read counterpart, so there is no
    # separate `read:issue` to ask for.
    oauth_scopes = ("read:repository", "write:repository", "read:user", "write:issue")

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        data = data["data"]
        user = data["user"]

        return {
            "type": IntegrationProviderSlug.GITEA.value,
            "id": user["id"],
            "email": user.get("email"),
            "scopes": sorted(data.get("scope", "").split()),
            "data": self.get_oauth_data(data),
        }

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "redirect_uri": absolute_uri("/extensions/gitea/setup/"),
            "client_id": identity.data.get("client_id"),
            "client_secret": identity.data.get("client_secret"),
        }

    def refresh_identity(self, identity: Identity | RpcIdentity, **kwargs: Any) -> None:
        """
        Gitea's token endpoint lives on the customer's own instance, so the URL
        can't be a class property the way it is for hosted providers - the
        caller passes it in as ``refresh_token_url``.
        """
        refresh_token = identity.data.get("refresh_token")
        refresh_token_url = kwargs.get("refresh_token_url")

        if not refresh_token:
            raise IdentityNotValid("Missing refresh token")

        if not refresh_token_url:
            raise IdentityNotValid("Missing refresh token url")

        req = self.get_refresh_token(
            refresh_token=refresh_token,
            url=refresh_token_url,
            identity=identity,
            verify_ssl=kwargs.get("verify_ssl", True),
        )

        try:
            body = safe_urlread(req)
            payload = orjson.loads(body)
            oauth_data = get_oauth_data(payload)
        except Exception as e:
            # A 200 carrying something other than a token response - an HTML
            # login page from a proxy in front of the instance, say - lands
            # here alongside the parse errors. Either way the identity can no
            # longer authenticate, and callers already know how to handle that.
            error_status = getattr(e, "code", req.status_code)
            self.logger.info(
                "gitea.refresh-identity-failure",
                extra={
                    "identity_id": identity.id,
                    "error_status": error_status,
                    "error_message": str(e),
                },
            )
            raise IdentityNotValid("Could not refresh the Gitea access token") from e

        identity.data.update(oauth_data)
        identity_service.update_data(identity_id=identity.id, data=identity.data)
