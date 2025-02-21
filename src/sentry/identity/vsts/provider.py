from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl

import orjson
from django.core.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import http, options
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView, OAuth2Provider, record_event
from sentry.integrations.utils.metrics import IntegrationPipelineViewType
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri


def get_user_info(access_token):
    with http.build_session() as session:
        resp = session.get(
            "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=1.0",
            headers={"Accept": "application/json", "Authorization": f"bearer {access_token}"},
        )
        resp.raise_for_status()

        user = resp.json()
        user["uuid"] = user["id"]

        resp = session.get(
            "https://app.vssps.visualstudio.com/_apis/connectionData/",
            headers={"Accept": "application/json", "Authorization": f"bearer {access_token}"},
        )
        resp.raise_for_status()

        # NOTE (from Microsoft PM):
        # The "descriptor" is the universal identifier for a given user and is consistent across
        # all VSTS accounts (organizations). The "id" field for the same user can be different for
        # the same user in different places, so the "descriptor" is the best identifier for a user.
        # This is returned in most/all of the VSTS REST APIs at this point (except for the
        # profiles/me API above). To get the current user's descriptor, we call the "connection data"
        # REST API (this assumes we are authenticating with an access token issued to the user).
        # We will also see descriptors returned for every user in the "Get users" (Graph) REST API.
        user["id"] = resp.json()["authenticatedUser"]["subjectDescriptor"]

    return user


class VSTSIdentityProvider(OAuth2Provider):
    key = "vsts"
    name = "Azure DevOps"

    oauth_access_token_url = "https://app.vssps.visualstudio.com/oauth2/token"
    oauth_authorize_url = "https://app.vssps.visualstudio.com/oauth2/authorize"

    def get_oauth_client_id(self):
        return options.get("vsts.client-id")

    def get_oauth_client_secret(self):
        return options.get("vsts.client-secret")

    def get_refresh_token_url(self):
        return self.oauth_access_token_url

    def get_pipeline_views(self) -> list[PipelineView]:
        return [
            OAuth2LoginView(
                authorize_url=self.oauth_authorize_url,
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            VSTSOAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_refresh_token_headers(self):
        return {"Content-Type": "application/x-www-form-urlencoded", "Content-Length": "1654"}

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity, **kwargs: Any
    ) -> dict[str, str | None]:
        client_secret = options.get("vsts.client-secret")

        # The token refresh flow does not operate within a pipeline in the same way
        # that installation does, this means that we have to use the identity.scopes
        # to determine which client_secret to use.
        #
        # If "vso.code" is missing from the identity.scopes, we know that we installed
        # using the "vsts-limited.client-secret" and therefore should use that to refresh
        # the token.
        if "vso.code" not in identity.scopes:
            client_secret = options.get("vsts-limited.client-secret")

        oauth_redirect_url = kwargs.get("redirect_url")
        if oauth_redirect_url is None:
            raise ValueError("VSTS requires oauth redirect url when refreshing identity")
        return {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_secret,
            "grant_type": "refresh_token",
            "assertion": refresh_token,
            "redirect_uri": absolute_uri(oauth_redirect_url),
        }

    def build_identity(self, data):
        data = data["data"]
        access_token = data.get("access_token")
        if not access_token:
            raise PermissionDenied()
        user = get_user_info(access_token)

        return {
            "type": "vsts",
            "id": user["id"],
            "email": user["emailAddress"],
            "email_verified": True,
            "name": user["displayName"],
            "scopes": sorted(self.oauth_scopes),
            "data": self.get_oauth_data(data),
        }


class VSTSOAuth2CallbackView(OAuth2CallbackView):
    def exchange_token(self, request: Request, pipeline, code):
        from sentry.http import safe_urlopen, safe_urlread
        from sentry.utils.http import absolute_uri

        with record_event(
            IntegrationPipelineViewType.TOKEN_EXCHANGE, pipeline.provider.key
        ).capture():
            req = safe_urlopen(
                url=self.access_token_url,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": "1322",
                },
                data={
                    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    "client_assertion": self.client_secret,
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": code,
                    "redirect_uri": absolute_uri(pipeline.redirect_url()),
                },
            )
            body = safe_urlread(req)
            if req.headers["Content-Type"].startswith("application/x-www-form-urlencoded"):
                return dict(parse_qsl(body))
            return orjson.loads(body)


# TODO(iamrajjoshi): Make this the default provider
# We created this new flow in order to quickly update the DevOps integration to use
# the new Azure AD OAuth2 flow.
# This is a temporary solution until we can fully migrate to the new flow once customers are migrated
class VSTSNewIdentityProvider(OAuth2Provider):
    key = "vsts_new"
    name = "Azure DevOps"

    oauth_access_token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    oauth_authorize_url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"

    # Using a new option
    def get_oauth_client_id(self):
        return options.get("vsts_new.client-id")

    def get_oauth_client_secret(self):
        return options.get("vsts_new.client-secret")

    def get_refresh_token_url(self):
        return self.oauth_access_token_url

    def get_pipeline_views(self):
        return [
            # made a new view to override `get_authorize_params` for the new params needed for the oauth
            VSTSOAuth2LoginView(
                authorize_url=self.oauth_authorize_url,
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            VSTSNewOAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_refresh_token_headers(self):
        return {"Content-Type": "application/x-www-form-urlencoded", "Content-Length": "1654"}

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity, **kwargs: Any
    ) -> dict[str, str | None]:
        # TODO(iamrajjoshi): Fix vsts-limited here
        # Note: ignoring the below from the original provider
        # # If "vso.code" is missing from the identity.scopes, we know that we installed
        # using the "vsts-limited.client-secret" and therefore should use that to refresh
        # the token.

        oauth_redirect_url = kwargs.get("redirect_url")
        if oauth_redirect_url is None:
            raise ValueError("VSTS requires oauth redirect url when refreshing identity")

        return {
            "grant_type": "refresh_token",
            "client_id": self.get_oauth_client_id(),
            "client_secret": self.get_oauth_client_secret(),
            "refresh_token": refresh_token,
        }

    def build_identity(self, data):
        data = data["data"]
        access_token = data.get("access_token")
        if not access_token:
            raise PermissionDenied()
        user = get_user_info(access_token)

        return {
            "type": "vsts",
            "id": user["id"],
            "email": user["emailAddress"],
            "email_verified": True,
            "name": user["displayName"],
            "scopes": sorted(self.oauth_scopes),
            "data": self.get_oauth_data(data),
        }


class VSTSOAuth2LoginView(OAuth2LoginView):
    def get_authorize_params(self, state, redirect_uri):
        return {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": self.get_scope(),
            "state": state,
            "prompt": "consent",
        }


class VSTSNewOAuth2CallbackView(OAuth2CallbackView):
    def exchange_token(self, request: Request, pipeline, code):
        from urllib.parse import parse_qsl

        from sentry.http import safe_urlopen, safe_urlread
        from sentry.utils.http import absolute_uri

        with record_event(
            IntegrationPipelineViewType.TOKEN_EXCHANGE, pipeline.provider.key
        ).capture():
            req = safe_urlopen(
                url=self.access_token_url,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": "1322",
                },
                data={
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": absolute_uri(pipeline.redirect_url()),
                },
            )
            body = safe_urlread(req)
            if req.headers["Content-Type"].startswith("application/x-www-form-urlencoded"):
                return dict(parse_qsl(body))
            return orjson.loads(body)
