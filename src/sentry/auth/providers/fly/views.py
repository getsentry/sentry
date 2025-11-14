from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, int

from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.providers.oauth2 import OAuth2Login
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .client import FlyClient
from .constants import AUTHORIZE_URL, ERR_NO_ORG_ACCESS, SCOPE

if TYPE_CHECKING:
    from sentry.auth.helper import AuthHelper

logger = logging.getLogger("sentry.auth.fly")


class FlyOAuth2Login(OAuth2Login):
    authorize_url = AUTHORIZE_URL
    scope = SCOPE

    def __init__(self, client_id: str) -> None:
        super().__init__(client_id=client_id)


class FetchUser(AuthView):
    def __init__(
        self, org: RpcOrganization | dict[str, Any] | None = None, *args: Any, **kwargs: Any
    ) -> None:
        """
        NOTE: org/args are configured via provider `build_config` method and provided at SSO time
        """
        self.org = org
        super().__init__(*args, **kwargs)

    def handle(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        data: dict[str, Any] | None = pipeline.fetch_state("data")
        assert data is not None
        with FlyClient(data["access_token"]) as client:
            """
            Utilize the access token to make final request to token introspection endpoint
            pipeline.fetch_state -> base pipeline _fetch_state

            Validate whether the authenticated user is authorized to access the configured SSO org
            """
            info = client.get_info()
            if self.org is not None:
                user_orgs = info.get("organizations", {})
                org_id = self.org["id"] if isinstance(self.org, dict) else self.org.id
                if org_id not in [org["id"] for org in user_orgs]:
                    logger.warning(
                        "SSO attempt no org access", extra={"org": self.org, "user_orgs": user_orgs}
                    )
                    return pipeline.error(ERR_NO_ORG_ACCESS)

            pipeline.bind_state("user", info)

            return pipeline.next_step()


def fly_configure_view(
    request: HttpRequest, org: RpcOrganization | dict[str, Any], auth_provider: RpcAuthProvider
) -> DeferredResponse:
    return DeferredResponse("sentry_auth_fly/configure.html")
