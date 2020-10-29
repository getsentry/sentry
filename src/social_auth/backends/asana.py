"""
Obtain
ASANA_CLIENT_ID & ASANA_CLIENT_SECRET
and put into sentry.conf.py
"""
from __future__ import absolute_import

import requests

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.exceptions import AuthCanceled, AuthUnknownError

ASANA_TOKEN_EXCHANGE_URL = "https://app.asana.com/-/oauth_token"
ASANA_AUTHORIZATION_URL = "https://app.asana.com/-/oauth_authorize"
ASANA_USER_DETAILS_URL = "https://app.asana.com/api/1.0/users/me"


class AsanaBackend(OAuthBackend):
    """Asana OAuth authentication backend"""

    name = "asana"
    EXTRA_DATA = [
        ("email", "email"),
        ("name", "full_name"),
        ("gid", "id"),
        ("refresh_token", "refresh_token"),
    ]
    ID_KEY = "gid"

    def get_user_details(self, response):
        """Return user details from Asana account"""

        return {
            "email": response.get("email"),
            "id": response.get("gid"),
            "full_name": response.get("name"),
        }


class AsanaAuth(BaseOAuth2):
    """Asana OAuth authentication mechanism"""

    AUTHORIZATION_URL = ASANA_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = ASANA_TOKEN_EXCHANGE_URL
    AUTH_BACKEND = AsanaBackend
    SETTINGS_KEY_NAME = "ASANA_CLIENT_ID"
    SETTINGS_SECRET_NAME = "ASANA_CLIENT_SECRET"
    REDIRECT_STATE = False

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        headers = {"Authorization": "Bearer %s" % access_token}
        try:
            resp = requests.get(ASANA_USER_DETAILS_URL, headers=headers)
            resp.raise_for_status()
            return resp.json()["data"]
        except ValueError:
            return None

    def auth_complete(self, *args, **kwargs):
        """Completes logging process, must return user instance"""
        self.process_error(self.data)
        params = self.auth_complete_params(self.validate_state())

        response = requests.post(self.ACCESS_TOKEN_URL, data=params, headers=self.auth_headers())
        if response.status_code == 400:
            raise AuthCanceled(self)

        response.raise_for_status()

        try:
            response = response.json()
        except (ValueError, KeyError):
            raise AuthUnknownError(self)

        response.pop("data")
        self.process_error(response)
        return self.do_auth(response["access_token"], response=response, *args, **kwargs)


# Backend definition
BACKENDS = {"asana": AsanaAuth}
