from __future__ import annotations

import logging
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

logger = logging.getLogger("sentry.integration.gitlab")


def get_oauth_data(payload):
    data = {"access_token": payload["access_token"]}

    # https://docs.gitlab.com/ee/api/oauth2.html#2-requesting-access-token
    # doesn't seem to be correct, format we actually get:
    # {
    #   "access_token": "123432sfh29uhs29347",
    #   "token_type": "bearer",
    #   "refresh_token": "29f43sdfsk22fsj929",
    #   "created_at": 1536798907,
    #   "scope": "api"
    # }
    if "refresh_token" in payload:
        data["refresh_token"] = payload["refresh_token"]
    if "token_type" in payload:
        data["token_type"] = payload["token_type"]
    if "created_at" in payload:
        data["created_at"] = int(payload["created_at"])
    # Preserve client_id and client_secret if present in payload
    # These are needed for token refresh operations
    if "client_id" in payload:
        data["client_id"] = payload["client_id"]
    if "client_secret" in payload:
        data["client_secret"] = payload["client_secret"]
    return data


def get_user_info(access_token, installation_data):
    with http.build_session() as session:
        resp = session.get(
            f"{installation_data['url']}/api/v4/user",
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
            verify=installation_data["verify_ssl"],
        )
    try:
        resp.raise_for_status()
    except Exception as e:
        logger.info(
            "gitlab.identity.get-user-info-failure",
            extra={
                "url": installation_data["url"],
                "verify_ssl": installation_data["verify_ssl"],
                "client_id": installation_data["client_id"],
                "error_status": getattr(resp, "status_code"),  # error might not be an HTTP error
                "error_message": f"{e}",
            },
        )
        raise
    return resp.json()


class GitlabIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.GITLAB.value
    name = "Gitlab"

    oauth_scopes = ("api",)

    def build_identity(self, data):
        data = data["data"]

        return {
            "type": IntegrationProviderSlug.GITLAB.value,
            "id": data["user"]["id"],
            "email": data["user"]["email"],
            "scopes": sorted(data["scope"].split(",")),
            "data": self.get_oauth_data(data),
        }

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        client_id = identity.data.get("client_id")
        client_secret = identity.data.get("client_secret")

        return {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "redirect_uri": absolute_uri("/extensions/gitlab/setup/"),
            "client_id": client_id,
            "client_secret": client_secret,
        }

    def refresh_identity(self, identity: Identity | RpcIdentity, **kwargs: Any) -> None:
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
            verify_ssl=kwargs["verify_ssl"],
        )

        try:
            body = safe_urlread(req)
            payload = orjson.loads(body)
        except Exception as e:
            # JSONDecodeError's will happen when we get a 301
            # from GitLab, and won't have the `code` attribute
            # we use the req.status_code instead in that case
            error_status = getattr(e, "code", req.status_code)
            self.logger.info(
                "gitlab.refresh-identity-failure",
                extra={
                    "identity_id": identity.id,
                    "error_status": error_status,
                    "error_message": str(e),
                },
            )
            payload = {}

        # Preserve client_id and client_secret from existing identity data
        # as they are not returned in the refresh token response
        client_id = identity.data.get("client_id")
        client_secret = identity.data.get("client_secret")
        
        identity.data.update(get_oauth_data(payload))
        
        # Restore client_id and client_secret if they were present
        if client_id is not None:
            identity.data["client_id"] = client_id
        if client_secret is not None:
            identity.data["client_secret"] = client_secret
        
        identity_service.update_data(identity_id=identity.id, data=identity.data)
