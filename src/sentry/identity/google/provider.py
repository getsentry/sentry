from collections.abc import Mapping
from typing import Any, cast

from sentry import options
from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import MigratingIdentityId
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.oidc import verify_id_token

# When no hosted domain is in use for the authenticated user, we default to the
# gmail domain. It doesn't necessarily mean the users account is a gmail
# account (you can register a google account with any email), but it is not a
# gsuite account, which we want to differentiate on.
DEFAULT_GOOGLE_DOMAIN = "gmail.com"

# https://developers.google.com/identity/openid-connect/openid-connect#validatinganidtoken
GOOGLE_ID_TOKEN_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"


def normalize_email_verified(value: Any) -> bool:
    """Coerce Google's email_verified claim to a bool.

    Google's docs define this as a bool but their example (and the tokeninfo endpoint) show the string "true".
    Only True or "true" counts as verified.
    """
    return value is True or (isinstance(value, str) and value.strip().lower() == "true")


class GoogleIdentityProvider(OAuth2Provider):
    key = "google"
    name = "Google"

    oauth_access_token_url = "https://www.googleapis.com/oauth2/v4/token"
    oauth_authorize_url = "https://accounts.google.com/o/oauth2/auth"

    oauth_scopes = ("email",)

    def get_oauth_client_id(self) -> str:
        client_id = options.get("auth-google.client-id")
        return client_id

    def get_oauth_client_secret(self) -> str:
        client_secret = options.get("auth-google.client-secret")
        return client_secret

    def build_identity(self, state: Mapping[str, object]) -> Mapping[str, object]:
        data = cast(Mapping[str, object], state.get("data", {}))

        try:
            id_token = cast(str, data["id_token"])
        except KeyError:
            raise IdentityNotValid("Missing id_token in OAuth response, keys: %s" % sorted(data))

        user_data = verify_id_token(
            id_token,
            jwks_uri=GOOGLE_JWKS_URI,
            issuers=GOOGLE_ID_TOKEN_ISSUERS,
            audience=self.get_oauth_client_id(),
        )

        # XXX(epurkhiser): This is carryover from the AuthProvider version of
        # google identity. Because we will have code that handles interop
        # between newstyle generic Identity, and oldstyle AuthProviders, we
        # have to keep the MigratingIdentityId here.
        user_id = MigratingIdentityId(id=user_data["sub"], legacy_id=user_data["email"])

        return {
            "type": "google",
            "id": user_id,
            "email": user_data["email"],
            "email_verified": normalize_email_verified(user_data["email_verified"]),
            "name": user_data["email"],
            "domain": user_data.get("hd", DEFAULT_GOOGLE_DOMAIN),
            "scopes": sorted(self.oauth_scopes),
            "data": self.get_oauth_data(data),
        }
