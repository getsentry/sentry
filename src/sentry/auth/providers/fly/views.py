import logging
from typing import Any, cast

from django.http import HttpRequest, HttpResponse

from sentry.auth.providers.oauth2 import OAuth2Login
from sentry.auth.view import AuthView, ConfigureView

from .client import FlyClient
from .constants import AUTHORIZE_URL, ERR_NO_ORG_ACCESS, SCOPE

logger = logging.getLogger("sentry.auth.fly")


class FlyOAuth2Login(OAuth2Login):
    authorize_url = AUTHORIZE_URL
    scope = SCOPE

    def __init__(self, client_id):
        super().__init__(client_id=client_id)


class FetchUser(AuthView):
    def __init__(self, org=None, *args, **kwargs):
        """
        NOTE: org/args are configured via provider `build_config` method and provided at SSO time
        """
        self.org = org
        super().__init__(*args, **kwargs)

    def handle(self, request: HttpRequest, helper) -> HttpResponse:  # type: ignore
        with FlyClient(helper.fetch_state("data")["access_token"]) as client:
            """
            Utilize the access token to make final request to token introspection endpoint
            helper.fetch_state -> base pipeline _fetch_state

            Validate whether the authenticated user is authorized to access the configured SSO org
            """
            info = client.get_info()
            if self.org is not None:
                user_orgs = info.get("organizations", {})
                if self.org["id"] not in [org["id"] for org in user_orgs]:
                    logger.warning(
                        "SSO attempt no org access", extra={"org": self.org, "user_orgs": user_orgs}
                    )
                    return helper.error(ERR_NO_ORG_ACCESS)

            helper.bind_state("user", info)

            return helper.next_step()


class FlyConfigureView(ConfigureView):
    # This is the View for configuring your Fly OAuth set up
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:  # type: ignore
        return cast(HttpResponse, self.render("sentry_auth_fly/configure.html"))
