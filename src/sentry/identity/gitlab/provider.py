import logging

from sentry import http
from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.oauth2 import OAuth2Provider
from sentry.utils import json

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

    return data


def get_user_info(access_token, installation_data):
    session = http.build_session()
    resp = session.get(
        "{}/api/v4/user".format(installation_data["url"]),
        headers={"Accept": "application/json", "Authorization": "Bearer %s" % access_token},
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
                "error_message": str(e),
            },
        )
        raise e
    return resp.json()


class GitlabIdentityProvider(OAuth2Provider):
    key = "gitlab"
    name = "Gitlab"

    oauth_scopes = ("api",)

    def build_identity(self, data):
        data = data["data"]

        return {
            "type": "gitlab",
            "id": data["user"]["id"],
            "email": data["user"]["email"],
            "scopes": sorted(data["scope"].split(",")),
            "data": self.get_oauth_data(data),
        }

    def get_refresh_token_params(self, refresh_token, *args, **kwargs):
        return {"grant_type": "refresh_token", "refresh_token": refresh_token}

    def refresh_identity(self, identity, *args, **kwargs):
        refresh_token = identity.data.get("refresh_token")
        refresh_token_url = kwargs.get("refresh_token_url")

        if not refresh_token:
            raise IdentityNotValid("Missing refresh token")

        if not refresh_token_url:
            raise IdentityNotValid("Missing refresh token url")

        data = self.get_refresh_token_params(refresh_token, *args, **kwargs)

        req = safe_urlopen(url=refresh_token_url, headers={}, data=data)

        try:
            body = safe_urlread(req)
            payload = json.loads(body)
        except Exception as e:
            self.logger(
                "gitlab.refresh-identity-failure",
                extra={
                    "identity_id": identity.id,
                    "error_status": e.code,
                    "error_message": str(e),
                },
            )
            payload = {}

        self.handle_refresh_error(req, payload)

        identity.data.update(get_oauth_data(payload))
        return identity.update(data=identity.data)
