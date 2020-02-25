from __future__ import absolute_import

from sentry import options
from sentry.identity.oauth2 import OAuth2Provider
from sentry.auth.exceptions import IdentityNotValid
from sentry.utils import json
from sentry.utils.signing import urlsafe_b64decode
from sentry.auth.provider import MigratingIdentityId
from sentry.utils.compat import map


# When no hosted domain is in use for the authenticated user, we default to the
# gmail domain. It doesn't necessarily mean the users account is a gmail
# account (you can register a google account with any email), but it is not a
# gsuite account, which we want to differentiate on.
DEFAULT_GOOGLE_DOMAIN = "gmail.com"


class GoogleIdentityProvider(OAuth2Provider):
    key = "google"
    name = "Google"

    oauth_access_token_url = "https://www.googleapis.com/oauth2/v4/token"
    oauth_authorize_url = "https://accounts.google.com/o/oauth2/auth"

    oauth_scopes = ("email",)

    def get_oauth_client_id(self):
        return options.get("auth-google.client-id")

    def get_oauth_client_secret(self):
        return options.get("auth-google.client-secret")

    def build_identity(self, state):
        data = state["data"]

        try:
            id_token = data["id_token"]
        except KeyError:
            raise IdentityNotValid(u"Missing id_token in OAuth response: %s" % data)

        try:
            _, payload, _ = map(urlsafe_b64decode, id_token.split(".", 2))
        except Exception as exc:
            raise IdentityNotValid(u"Unable to decode id_token: %s" % exc)

        try:
            user_data = json.loads(payload)
        except ValueError as exc:
            raise IdentityNotValid(u"Unable to decode id_token payload: %s" % exc)

        # XXX(epurkhiser): This is carryover from the AuthProvider version of
        # google identity. Because we will have code that handles interop
        # between newstyle generic Identity, and oldstyle AuthProviders, we
        # have to keep the MigratingIdentityId here.
        user_id = MigratingIdentityId(id=user_data["sub"], legacy_id=user_data["email"])

        return {
            "type": "google",
            "id": user_id,
            "email": user_data["email"],
            "email_verified": user_data["email_verified"],
            "name": user_data["email"],
            "domain": user_data.get("hd", DEFAULT_GOOGLE_DOMAIN),
            "scopes": sorted(self.oauth_scopes),
            "data": self.get_oauth_data(data),
        }
