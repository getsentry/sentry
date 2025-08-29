"""
Obtain
ASANA_CLIENT_ID & ASANA_CLIENT_SECRET
and put into sentry.conf.py
"""

from urllib.parse import parse_qsl, urlencode

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
        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            resp = requests.get(ASANA_USER_DETAILS_URL, headers=headers)
            resp.raise_for_status()
            return resp.json()["data"]
        except ValueError:
            return None

    def auth_url(self):
        if self.STATE_PARAMETER or self.REDIRECT_STATE:
            # Store state in session for further request validation. The state
            # value is passed as state parameter (as specified in OAuth2 spec),
            # but also added to redirect_uri, that way we can still verify the
            # request if the provider doesn't implement the state parameter.
            # Reuse token if any.
            name = self.AUTH_BACKEND.name + "_state"
            state = self.request.session.get(name) or self.state_token()
            self.request.session[self.AUTH_BACKEND.name + "_state"] = state
        else:
            state = None

        params = self.auth_params(state)
        params.update(self.get_scope_argument())
        params.update(self.auth_extra_arguments())

        query_string = self._get_safe_query_string()
        return self.AUTHORIZATION_URL + "?" + urlencode(params) + query_string

    def _get_safe_query_string(self):
        """
        Returns filtered query string without client_id parameter.
        """

        query_string = self.request.META.get("QUERY_STRING", "")
        if not query_string:
            return ""

        parsed_params = parse_qsl(query_string, keep_blank_values=True)
        safe_params = []

        for param_name, param_value in parsed_params:
            # Remove client_id parameter
            if param_name.lower() != "client_id":
                safe_params.append((param_name, param_value))

        if safe_params:
            return "&" + urlencode(safe_params)
        else:
            return ""

    def auth_complete(self, *args, **kwargs):
        """Completes logging process, must return user instance"""
        self.process_error(self.data)
        params = self.auth_complete_params(self.validate_state())

        response = requests.post(self.ACCESS_TOKEN_URL, data=params, headers=self.auth_headers())
        if response.status_code == 400:
            raise AuthCanceled(self)

        response.raise_for_status()

        try:
            response_json = response.json()
        except (ValueError, KeyError):
            raise AuthUnknownError(self)

        response_json.pop("data")
        self.process_error(response_json)
        return self.do_auth(response_json["access_token"], response=response_json, *args, **kwargs)


# Backend definition
BACKENDS = {"asana": AsanaAuth}
