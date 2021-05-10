"""
Obtain
VISUALSTUDIO_CLIENT_ID & VISUALSTUDIO_CLIENT_SECRET
and put into sentry.conf.py
"""

import requests
from django.conf import settings
from django.urls import reverse

from sentry.utils.http import absolute_uri
from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import setting

VISUALSTUDIO_AUTHORIZATION_URL = "https://app.vssps.visualstudio.com/oauth2/authorize"
VISUALSTUDIO_TOKEN_EXCHANGE_URL = "https://app.vssps.visualstudio.com/oauth2/token"
VISUALSTUDIO_USER_DETAILS_URL = (
    "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=1.0"
)


class VisualStudioBackend(OAuthBackend):
    """Visual Studio OAuth authentication backend"""

    name = "visualstudio"
    EXTRA_DATA = [("id", "id"), ("refresh_token", "refresh_token")]

    def get_user_details(self, response):
        """Return user details from Visual Studio account"""
        return {
            "email": response.get("email"),
            "id": response.get("id"),
            "full_name": response.get("full_name"),
        }


class VisualStudioAuth(BaseOAuth2):
    """Slack OAuth authentication mechanism"""

    AUTHORIZATION_URL = VISUALSTUDIO_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = VISUALSTUDIO_TOKEN_EXCHANGE_URL
    AUTH_BACKEND = VisualStudioBackend
    SETTINGS_KEY_NAME = "VISUALSTUDIO_APP_ID"
    SETTINGS_SECRET_NAME = "VISUALSTUDIO_APP_SECRET"
    SETTINGS_CLIENT_SECRET_NAME = "VISUALSTUDIO_CLIENT_SECRET"
    REDIRECT_STATE = False
    DEFAULT_SCOPE = settings.VISUALSTUDIO_SCOPES
    RESPONSE_TYPE = "Assertion"

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        resp = requests.get(
            VISUALSTUDIO_USER_DETAILS_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        content = resp.json()
        return {
            "id": content["id"],
            "email": content["emailAddress"],
            "full_name": content["displayName"],
        }

    def auth_complete_params(self, state=None):
        secret = setting(self.SETTINGS_CLIENT_SECRET_NAME)
        return {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": secret,
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": self.data.get("code", ""),
            "redirect_uri": self.get_redirect_uri(state),
        }

    @classmethod
    def refresh_token_params(cls, token, provider):
        secret = setting(cls.SETTINGS_CLIENT_SECRET_NAME)

        return {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": secret,
            "grant_type": "refresh_token",
            "redirect_uri": absolute_uri(reverse("socialauth_associate_complete", args=[provider])),
            "assertion": token,
        }


# Backend definition
BACKENDS = {"visualstudio": VisualStudioAuth}
