import json
from collections.abc import Mapping
from logging import getLogger
from typing import Any, Optional

import jwt

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login
from sentry.auth.providers.oidc.provider import (
    ConsentRequired,
    InvalidToken,
    LoginRequired,
    OIDCCallback,
    OIDCLogin,
    OIDCProvider,
)
from sentry.exceptions import InvalidRequest
from sentry.http import safe_urlopen, safe_urlread

from .views import OktaOIDCConfigureView

logger = getLogger(__name__)


class OktaOAuth2Callback(OAuth2Callback):
    def exchange_token(self, request, helper, code):
        data = super().exchange_token(request, helper, code)

        # Log raw token data
        logger.info("Okta raw token response:", extra={"token_data": data})

        # If we have an id_token, decode and log it
        if "id_token" in data:
            try:
                decoded = jwt.decode(data["id_token"], options={"verify_signature": False})
                logger.info("Okta decoded ID token:", extra={"decoded_token": decoded})
            except jwt.InvalidTokenError as e:
                logger.error("Failed to decode ID token", exc_info=e)

        return data


class OktaOIDCProvider(OIDCProvider):
    """
    Okta-specific OIDC provider implementation.
    """

    name = "Okta (Open ID Connect)"
    is_partner = False
    use_pkce = True

    def get_setup_pipeline(self):
        return [OktaOIDCConfigureView()]

    def get_auth_pipeline(self):
        return [
            OIDCLogin(
                authorize_url=self.get_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            OIDCCallback(self),
        ]

    def get_oauth_scopes(self) -> set[str]:
        return {"openid", "profile", "email"}

    def get_oauth_base_url(self):
        domain = self.config["domain"]
        # Ensure domain has a scheme
        if not domain.startswith(("http://", "https://")):
            domain = f"https://{domain}"
        return domain

    def get_authorize_url(self):
        return f"{self.get_oauth_base_url()}/oauth2/v1/authorize"

    def get_token_url(self):
        return f"{self.get_oauth_base_url()}/oauth2/v1/token"

    def get_userinfo_url(self):
        return f"{self.get_oauth_base_url()}/oauth2/v1/userinfo"

    def get_userinfo(self, access_token: str) -> Mapping[str, Any]:
        """
        Fetch user info from Okta's userinfo endpoint.
        This includes email verification status.
        """
        logger.info("Fetching Okta userinfo", extra={"userinfo_url": self.get_userinfo_url()})

        resp = safe_urlopen(
            self.get_userinfo_url(),
            headers={"Authorization": f"Bearer {access_token}"},
        )
        data = json.loads(safe_urlread(resp))

        logger.info(
            "Okta userinfo response",
            extra={
                "userinfo_fields": list(data.keys()),
                "email_verified": data.get("email_verified"),
                "response_data": data,
            },
        )

        # Check email verification from userinfo
        if not data.get("email_verified", False):
            logger.warning("Okta user email not verified", extra={"email": data.get("email")})
            raise ConsentRequired("Email verification required")

        return data

    def validate_id_token(self, id_token: str, nonce: str | None = None) -> Mapping[str, Any]:
        """
        Extends base validation with Okta-specific checks.
        Note: Email verification is now checked in get_userinfo instead.
        """
        try:
            claims = super().validate_id_token(id_token, nonce)

            # Validate Okta-specific audience format
            aud = claims["aud"]
            if isinstance(aud, list):
                # Multi-audience case
                if self.get_oauth_client_id() not in aud:
                    raise InvalidToken("Client ID not found in audience list")
                if "azp" not in claims:
                    raise InvalidToken("azp claim required for multiple audiences")
                if claims["azp"] != self.get_oauth_client_id():
                    raise InvalidToken("Invalid azp claim")

            return claims

        except jwt.ExpiredSignatureError:
            raise LoginRequired("Authentication session has expired")
        except jwt.InvalidTokenError as e:
            logger.error("Okta ID token validation failed", exc_info=e)
            raise InvalidToken(str(e))

    def get_oauth_client_id(self):
        return self.config["client_id"]

    def get_oauth_client_secret(self):
        return self.config["client_secret"]

    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        """
        Build the identity from either the ID token claims or userinfo data.
        """
        data = state.get("data", {})
        logger.info(
            "Building Okta identity",
            extra={
                "available_data": list(data.keys()),
                "has_id_token": "id_token" in data,
                "has_userinfo": "userinfo" in data,
            },
        )

        # Try to get user info from the ID token first
        if "id_token" in data:
            try:
                claims = jwt.decode(data["id_token"], options={"verify_signature": False})
                logger.info("Using ID token claims for identity", extra={"claims": claims})
            except jwt.InvalidTokenError as e:
                logger.error("Failed to decode ID token", exc_info=e)
                raise IdentityNotValid("Invalid ID token")
        else:
            # If no ID token, we should have userinfo data
            claims = data.get("userinfo", {})
            logger.info("Using userinfo for identity", extra={"userinfo_data": claims})

        if not claims:
            raise IdentityNotValid("No user data available")

        # Validate required fields
        if not claims.get("sub"):
            raise IdentityNotValid("Missing user ID (sub)")
        if not claims.get("email"):
            raise IdentityNotValid("Missing email")

        identity = {
            "id": claims["sub"],
            "email": claims["email"],
            "name": claims.get("name", claims["email"]),
            "data": {
                "sub": claims["sub"],
                "email": claims["email"],
                "email_verified": claims.get("email_verified", False),
                "name": claims.get("name"),
                "access_token": data.get("access_token"),
                "refresh_token": data.get("refresh_token"),
                "token_type": data.get("token_type"),
                "scope": data.get("scope"),
            },
        }

        logger.info(
            "Built Okta identity",
            extra={
                "identity_fields": list(identity.keys()),
                "identity_data_fields": list(identity["data"].keys()),
            },
        )

        return identity
