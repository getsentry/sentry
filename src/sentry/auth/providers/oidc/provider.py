from __future__ import annotations

import hashlib
from collections.abc import Callable, Mapping
from typing import Any

from django.http import HttpRequest

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import Provider
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.models.authidentity import AuthIdentity
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .views import ConfigureIdP, OIDCCallback, OIDCLogin, ValidateIDToken, oidc_configure_view


def identity_id(issuer: str, subject: str) -> str:
    """
    `sub` is only unique per issuer (OIDC Core §2), so the identity is keyed by both.
    Hashed because AuthIdentity.ident is limited to 128 characters and `sub` alone may be 255.
    """
    return hashlib.sha256(f"{issuer}\n{subject}".encode()).hexdigest()


class OIDCProvider(Provider):
    """
    Generic OpenID Connect provider, configured per organization with an issuer URL,
    client ID and client secret.

    Vendor presets (Okta, Entra ID, ...) can subclass this, override `name` and `key`,
    and swap the first step of `get_setup_pipeline` for a vendor-specific form.
    """

    name = "OpenID Connect"
    key = "oidc"
    required_feature = "organizations:sso-oidc"
    hidden_without_required_feature = True
    # OIDC has no standard way to ask "is this user still active?" without a refresh
    # token, which needs `offline_access` and a stored long-lived secret. Like SAML, we
    # skip the periodic check and rely on each login and on SCIM deprovisioning.
    requires_refresh = False

    def get_configure_view(
        self,
    ) -> Callable[[HttpRequest, RpcOrganization, RpcAuthProvider], DeferredResponse]:
        return oidc_configure_view

    def get_auth_pipeline(self) -> list[AuthView]:
        return [OIDCLogin(), OIDCCallback(), ValidateIDToken()]

    def get_setup_pipeline(self) -> list[AuthView]:
        return [ConfigureIdP(), *self.get_auth_pipeline()]

    def build_config(self, state: Mapping[str, Any]) -> dict[str, Any]:
        return dict(state["oidc"])

    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        user = state.get("user")
        if not user or not user.get("sub") or not user.get("email"):
            raise IdentityNotValid("Missing identity claims from the provider.")

        return {
            "id": identity_id(user["iss"], user["sub"]),
            "email": user["email"],
            "name": user.get("name") or user["email"],
            # The provider said it verified the email, but it's run by the customer, so
            # AuthHelper treats it as untrusted (see TRUSTED_EMAIL_VERIFIED_PROVIDERS).
            "email_verified": True,
            "data": {"iss": user["iss"], "sub": user["sub"]},
        }

    def refresh_identity(self, auth_identity: AuthIdentity) -> None:
        # See requires_refresh.
        pass
