from __future__ import annotations

import base64
import hashlib
import os
from collections.abc import Mapping
from hmac import compare_digest
from logging import getLogger
from time import time
from typing import Any, Optional
from urllib.parse import urlencode

import jwt
from jwt.algorithms import RSAAlgorithm

from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider
from sentry.auth.view import AuthView
from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import json
from sentry.utils.cache import cache

logger = getLogger(__name__)


class OIDCError(Exception):
    """Base exception for OIDC-specific errors."""

    def __init__(
        self, error: str, error_description: str | None = None, error_uri: str | None = None
    ):
        self.error = error
        self.error_description = error_description
        self.error_uri = error_uri
        super().__init__(error_description or error)


class LoginRequired(OIDCError):
    """End-User authentication is required."""

    def __init__(self, error_description: str | None = None, error_uri: str | None = None):
        super().__init__("login_required", error_description, error_uri)


class ConsentRequired(OIDCError):
    """End-User consent is required."""

    def __init__(self, error_description: str | None = None, error_uri: str | None = None):
        super().__init__("consent_required", error_description, error_uri)


class InvalidRequest(OIDCError):
    """The request is missing a required parameter or is otherwise malformed."""

    def __init__(self, error_description: str | None = None, error_uri: str | None = None):
        super().__init__("invalid_request", error_description, error_uri)


class InvalidToken(OIDCError):
    """The ID Token is invalid."""

    def __init__(self, error_description: str | None = None, error_uri: str | None = None):
        super().__init__("invalid_token", error_description, error_uri)


def generate_code_verifier(length: int = 64) -> str:
    """Generate a code verifier for PKCE."""
    return base64.urlsafe_b64encode(os.urandom(length)).decode("utf-8").rstrip("=")


def generate_code_challenge(code_verifier: str) -> str:
    """Generate a code challenge from a code verifier using S256 method."""
    return (
        base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode("utf-8")).digest())
        .decode("utf-8")
        .rstrip("=")
    )


class OIDCLogin(OAuth2Login):
    """OIDC-specific login handler that adds required OIDC parameters and PKCE."""

    def generate_pkce_params(self) -> tuple[str, dict[str, str]]:
        """Generate PKCE parameters for the authorization request."""
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        # Store the code verifier for the callback
        self.provider.code_verifier = code_verifier

        return {
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

    def get_authorize_params(self, state, redirect_uri):
        params = super().get_authorize_params(state, redirect_uri)
        # Add OIDC-specific parameters
        params.update(
            {
                "scope": self.get_scope(),
                "response_type": "code",
                "nonce": state,  # OIDC requires a nonce for security
            }
        )
        return params


class OIDCCallback(OAuth2Callback):
    """OIDC-specific callback handler that validates the ID token."""

    def __init__(self, provider):
        self.provider = provider
        super().__init__(
            access_token_url=provider.get_token_url(),
            client_id=provider.get_oauth_client_id(),
            client_secret=provider.get_oauth_client_secret(),
        )

    def handle_error(self, error: Exception) -> Any:
        """Handle OIDC-specific errors according to the spec."""
        if isinstance(error, OIDCError):
            # Build error response according to OIDC spec
            params = {
                "error": error.error,  # REQUIRED
                "state": self.provider.state,  # REQUIRED if state was in auth request
            }
            if error.error_description:  # OPTIONAL
                params["error_description"] = error.error_description
            if error.error_uri:  # OPTIONAL
                params["error_uri"] = error.error_uri

            redirect_uri = self.provider.get_redirect_uri()
            return self.redirect(f"{redirect_uri}?{urlencode(params)}")

        return super().handle_error(error)

    def exchange_token(self, request, helper, code):
        """Exchange the authorization code for tokens."""
        try:
            data = super().exchange_token(request, helper, code)
            logger.info(
                "OIDC token exchange response",
                extra={
                    "token_types": list(data.keys()),  # Log what types of tokens we received
                    "has_access_token": "access_token" in data,
                    "has_id_token": "id_token" in data,
                },
            )

            # Clean up PKCE code verifier after use
            if hasattr(self.provider, "code_verifier"):
                delattr(self.provider, "code_verifier")

            # Get userinfo if available
            if hasattr(self.provider, "get_userinfo"):
                try:
                    userinfo = self.provider.get_userinfo(data["access_token"])
                    logger.info(
                        "OIDC userinfo response",
                        extra={
                            "userinfo_fields": list(userinfo.keys()),
                            "userinfo_data": userinfo,
                        },
                    )
                    data["userinfo"] = userinfo
                except Exception as e:
                    logger.error("Failed to get userinfo", exc_info=e)

            # Validate the ID token if present
            id_token = data.get("id_token")
            if id_token:
                try:
                    # Log the raw ID token for debugging
                    unverified_claims = jwt.decode(id_token, options={"verify_signature": False})
                    logger.info(
                        "OIDC ID token contents (pre-validation)",
                        extra={
                            "id_token_claims": unverified_claims,
                            "id_token_header": jwt.get_unverified_header(id_token),
                        },
                    )

                    nonce = helper.state.nonce if hasattr(helper.state, "nonce") else None
                    claims = self.provider.validate_id_token(id_token, nonce)
                    logger.info(
                        "OIDC ID token validated successfully", extra={"validated_claims": claims}
                    )
                    data["id_token_claims"] = claims
                except jwt.InvalidTokenError as e:
                    logger.error(
                        "OIDC ID token validation failed", extra={"error": str(e)}, exc_info=e
                    )
                    raise InvalidToken(error_description=str(e))

            return data

        except jwt.ExpiredSignatureError:
            raise InvalidToken(error_description="Token has expired")
        except jwt.InvalidTokenError as e:
            raise InvalidToken(error_description=str(e))
        except Exception as e:
            logger.error(f"OIDC token exchange failed: {e}")
            raise InvalidRequest(error_description=f"Token exchange failed: {e}")


class OIDCProvider(OAuth2Provider):
    """
    Base OpenID Connect provider implementing the basic OIDC flow.

    This can be extended by specific OIDC providers to customize behavior.
    """

    # Cache timeouts
    JWKS_CACHE_TIMEOUT = 60 * 60  # 1 hour
    OIDC_CONFIG_CACHE_TIMEOUT = 60 * 60 * 24  # 24 hours

    # Enable PKCE by default
    use_pkce = True
    required_feature = "organizations:sso-basic"

    # These properties control visibility in the UI
    name = "OpenID Connect"  # Display name in the UI

    def get_oauth_client_id(self) -> str:
        return self.config["client_id"]

    def get_oauth_client_secret(self) -> str:
        return self.config["client_secret"]

    def get_oauth_base_url(self) -> str:
        return self.config["domain"]

    def get_client_id(self):
        return self.get_oauth_client_id()

    def get_client_secret(self):
        return self.get_oauth_client_secret()

    def get_oauth_scopes(self) -> set[str]:
        # Standard OIDC scopes - providers can override to add more
        return {"openid", "profile", "email"}

    def get_auth_pipeline(self) -> list[AuthView]:
        return [
            OIDCLogin(
                authorize_url=self.get_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            OIDCCallback(self),
        ]

    def get_refresh_token_url(self) -> str:
        return f"{self.get_oauth_base_url()}/oauth/token"

    def get_token_params(self) -> dict[str, Any]:
        """Get parameters for token exchange, including PKCE if enabled."""
        params = super().get_token_params()
        params["grant_type"] = "authorization_code"

        # Add PKCE code verifier if it was used in authorization
        if self.use_pkce and hasattr(self, "code_verifier"):
            params["code_verifier"] = self.code_verifier

        return params

    def get_userinfo_params(self) -> dict[str, Any]:
        return {
            "access_token": self.access_token,
        }

    def get_userinfo(self, access_token: str) -> Mapping[str, Any]:
        """Fetches user info from the OIDC userinfo endpoint."""
        resp = safe_urlopen(
            f"{self.get_oauth_base_url()}/userinfo",
            params=self.get_userinfo_params(),
        )
        return json.loads(safe_urlread(resp))

    def build_identity(self, data: Mapping[str, Any]) -> Mapping[str, Any]:
        # Map standard OIDC claims to Sentry identity
        return {
            "id": data["sub"],
            "email": data["email"],
            "name": data.get("name"),
            "data": {
                "sub": data["sub"],
                "email": data["email"],
                "name": data.get("name"),
                "email_verified": data.get("email_verified", False),
            },
        }

    def get_well_known_url(self) -> str:
        """Get the OIDC discovery document URL."""
        return f"{self.get_oauth_base_url()}/.well-known/openid-configuration"

    def get_oidc_config(self) -> Mapping[str, Any]:
        """Fetch and cache the OIDC configuration."""
        cache_key = f"oidc-config:{self.get_oauth_base_url()}"
        config = cache.get(cache_key)

        if config is None:
            resp = safe_urlopen(self.get_well_known_url())
            config = json.loads(safe_urlread(resp))
            cache.set(cache_key, config, self.OIDC_CONFIG_CACHE_TIMEOUT)

        return config

    def get_jwks(self) -> Mapping[str, Any]:
        """Fetch and cache the JWKS (JSON Web Key Set)."""
        cache_key = f"oidc-jwks:{self.get_oauth_base_url()}"
        jwks = cache.get(cache_key)

        if jwks is None:
            config = self.get_oidc_config()
            resp = safe_urlopen(config["jwks_uri"])
            jwks = json.loads(safe_urlread(resp))
            cache.set(cache_key, jwks, self.JWKS_CACHE_TIMEOUT)

        return jwks

    def validate_id_token(self, id_token: str, nonce: str | None = None) -> Mapping[str, Any]:
        """
        Validate the ID token according to the OIDC specification.

        Args:
            id_token: The ID token to validate
            nonce: Optional nonce to verify

        Returns:
            The validated token claims

        Raises:
            InvalidToken: If the token validation fails
        """
        try:
            # First decode without verification to get the header
            unverified_header = jwt.get_unverified_header(id_token)
            if unverified_header.get("alg") != "RS256":
                raise InvalidToken("Invalid algorithm - only RS256 is supported")

            # Get and validate key
            jwks = self.get_jwks()
            key_id = unverified_header.get("kid")
            if not key_id:
                raise InvalidToken("No key ID (kid) in token header")

            rsa_key = next((key for key in jwks["keys"] if key["kid"] == key_id), None)
            if not rsa_key:
                raise InvalidToken("No matching signing key found")

            # Convert JWK to PEM
            public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_key))

            # Get issuer from config
            config = self.get_oidc_config()
            issuer = config["issuer"]

            # Full validation options
            options = {
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
                "verify_iat": True,
                "verify_nbf": True,
                "require": ["exp", "iss", "iat", "aud", "sub"],
            }

            # Decode and validate claims
            claims = jwt.decode(
                id_token,
                key=public_key,
                algorithms=["RS256"],
                audience=self.get_oauth_client_id(),
                issuer=issuer,
                options=options,
            )

            # Additional OIDC-specific validation
            if not claims.get("sub"):
                raise InvalidToken("Missing required sub claim")

            if nonce:
                token_nonce = claims.get("nonce")
                if not token_nonce:
                    raise InvalidToken("Missing nonce claim")
                if not compare_digest(str(token_nonce), str(nonce)):
                    raise InvalidToken("Invalid nonce")

            # Validate auth_time if max_age was specified in auth request
            max_age = getattr(self, "max_age", None)
            if max_age is not None:
                auth_time = claims.get("auth_time")
                if not auth_time:
                    raise InvalidToken("Missing auth_time claim")
                if time() - auth_time > max_age:
                    raise InvalidToken("Authentication too old")

            return claims

        except jwt.InvalidTokenError as e:
            raise InvalidToken(str(e))
