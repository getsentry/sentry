from __future__ import annotations

from base64 import b64encode
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, TypedDict

import orjson
from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel, SecretStr
from requests import RequestException

from sentry.constants import ObjectStatus
from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.locks import locks
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.silo.base import control_silo_function
from sentry.utils.locking import UnableToAcquireLock

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration

SUPABASE_API_URL = "https://api.supabase.com/v1"
SUPABASE_AUTHORIZE_URL = f"{SUPABASE_API_URL}/oauth/authorize"
SUPABASE_TOKEN_URL = f"{SUPABASE_API_URL}/oauth/token"
SUPABASE_REVOKE_URL = f"{SUPABASE_API_URL}/oauth/revoke"
SUPABASE_ORGANIZATIONS_URL = f"{SUPABASE_API_URL}/organizations"
SUPABASE_MCP_RESOURCE = "https://mcp.supabase.com/mcp"
# Account tools discover projects; debugging tools read logs and advisors. Do not enable
# database or notebooks tools, which can read application data even in read-only mode.
SUPABASE_MCP_URL = f"{SUPABASE_MCP_RESOURCE}?read_only=true&features=account,debugging"
SUPABASE_SCOPES = ("organizations:read", "projects:read", "analytics:read", "database:read")

SUPABASE_AUTHORIZATION_ERROR = "Supabase authorization failed. Connect your organization again."
SUPABASE_UNREACHABLE_ERROR = "Could not reach Supabase. Try again."
SUPABASE_RESPONSE_ERROR = "Could not verify the connection to Supabase. Try again."
SUPABASE_PERMISSIONS_ERROR = (
    "In the Supabase OAuth app settings, set Analytics, Database, Organizations, and Projects "
    "to Read-only and all other permissions to No access. Save the changes, then connect again."
)

FORCED_REFRESH_REUSE_WINDOW = timedelta(seconds=30)


class SupabaseOrganization(TypedDict):
    slug: str
    name: str


class SupabaseAccessToken(TypedDict):
    access_token: str
    expires_at: str


class SupabaseTokenMetadata(SupabaseAccessToken):
    refresh_token: str


class SupabaseRefreshTokenError(IntegrationConfigurationError):
    """The organization grant's refresh token is no longer valid."""


class SupabaseToken(BaseModel):
    access_token: SecretStr
    refresh_token: SecretStr
    expires_at: datetime

    def as_metadata(self) -> SupabaseTokenMetadata:
        return {
            "access_token": self.access_token.get_secret_value(),
            "refresh_token": self.refresh_token.get_secret_value(),
            "expires_at": self.expires_at.isoformat(),
        }


def _oauth_credentials() -> tuple[str, str]:
    if not settings.SUPABASE_FOR_SEER_CLIENT_ID or not settings.SUPABASE_FOR_SEER_CLIENT_SECRET:
        raise IntegrationConfigurationError("Supabase OAuth is not configured in Sentry.")
    return settings.SUPABASE_FOR_SEER_CLIENT_ID, settings.SUPABASE_FOR_SEER_CLIENT_SECRET


def _request_token(params: dict[str, str]) -> SupabaseToken:
    client_id, client_secret = _oauth_credentials()
    credentials = b64encode(f"{client_id}:{client_secret}".encode()).decode()
    requested_at = timezone.now()
    try:
        response = safe_urlopen(
            SUPABASE_TOKEN_URL,
            method="POST",
            data={"resource": SUPABASE_MCP_RESOURCE, **params},
            headers={"Accept": "application/json", "Authorization": f"Basic {credentials}"},
            timeout=10,
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(SUPABASE_UNREACHABLE_ERROR) from None

    try:
        body = orjson.loads(safe_urlread(response))
    except orjson.JSONDecodeError:
        body = None
    if response.status_code in (400, 401, 403):
        if (
            params["grant_type"] == "refresh_token"
            and isinstance(body, dict)
            and body.get("error") == "invalid_grant"
        ):
            raise SupabaseRefreshTokenError(SUPABASE_AUTHORIZATION_ERROR)
        raise IntegrationConfigurationError(SUPABASE_AUTHORIZATION_ERROR)
    # Supabase documents 201 for token exchanges; some deployments return 200.
    if response.status_code not in (200, 201) or not isinstance(body, dict):
        raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)

    access_token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    expires_in = body.get("expires_in")
    if (
        not isinstance(access_token, str)
        or not access_token
        or not isinstance(refresh_token, str)
        or not refresh_token
        or type(expires_in) is not int
        or not 0 < expires_in <= 30 * 24 * 60 * 60
        or str(body.get("token_type", "")).lower() != "bearer"
    ):
        raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)
    # Supabase's documented response omits scope. If it supplies one, don't silently
    # accept missing permissions or a broader grant than our observability app needs.
    if "scope" in body and (
        not isinstance(body["scope"], str) or set(body["scope"].split()) != set(SUPABASE_SCOPES)
    ):
        raise IntegrationConfigurationError(SUPABASE_PERMISSIONS_ERROR)
    return SupabaseToken(
        access_token=SecretStr(access_token),
        refresh_token=SecretStr(refresh_token),
        expires_at=requested_at + timedelta(seconds=expires_in),
    )


def exchange_authorization_code(code: str, redirect_uri: str, code_verifier: str) -> SupabaseToken:
    return _request_token(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        }
    )


def refresh_access_token(refresh_token: str) -> SupabaseToken:
    return _request_token({"grant_type": "refresh_token", "refresh_token": refresh_token})


def validate_supabase_access_token(access_token: str) -> SupabaseOrganization:
    """Identify the single organization selected in Supabase's consent screen."""
    try:
        response = safe_urlopen(
            SUPABASE_ORGANIZATIONS_URL,
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(SUPABASE_UNREACHABLE_ERROR) from None
    if response.status_code == 401:
        raise IntegrationConfigurationError(SUPABASE_AUTHORIZATION_ERROR)
    if response.status_code == 403:
        raise IntegrationConfigurationError(SUPABASE_PERMISSIONS_ERROR)
    try:
        body = orjson.loads(safe_urlread(response))
    except orjson.JSONDecodeError:
        body = None
    if response.status_code != 200 or not isinstance(body, list) or len(body) != 1:
        raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)
    organization = body[0]
    if not isinstance(organization, dict):
        raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)
    slug = organization.get("slug")
    name = organization.get("name")
    if not isinstance(slug, str) or not slug or not isinstance(name, str) or not name:
        raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)
    return {"slug": slug, "name": name}


def _stored_token(
    integration: Integration, minimum_validity: timedelta, force_refresh: bool
) -> SupabaseAccessToken | None:
    access_token = integration.metadata.get("access_token")
    raw_expires_at = integration.metadata.get("expires_at")
    try:
        expires_at = datetime.fromisoformat(raw_expires_at) if raw_expires_at else None
    except (TypeError, ValueError):
        expires_at = None
    if (
        not isinstance(access_token, str)
        or not access_token
        or expires_at is None
        or expires_at.tzinfo is None
        or expires_at <= timezone.now() + minimum_validity
    ):
        return None
    if force_refresh and integration.date_updated <= timezone.now() - FORCED_REFRESH_REUSE_WINDOW:
        return None
    return {"access_token": access_token, "expires_at": raw_expires_at}


class SupabaseClient:
    def __init__(self, integration: Integration | RpcIntegration) -> None:
        self.integration = integration

    @control_silo_function
    def get_access_token(
        self,
        token_minimum_validity_time: timedelta | None = None,
        *,
        force_refresh: bool = False,
    ) -> SupabaseAccessToken | None:
        minimum_validity = token_minimum_validity_time or timedelta(minutes=5)
        lock = locks.get(
            f"supabase:access-token:{self.integration.id}",
            duration=30,
            name="supabase_access_token",
        )
        try:
            acquired = lock.blocking_acquire(initial_delay=0.1, timeout=5)
        except UnableToAcquireLock:
            integration = Integration.objects.filter(
                id=self.integration.id, status=ObjectStatus.ACTIVE
            ).first()
            stored = (
                _stored_token(integration, minimum_validity, force_refresh) if integration else None
            )
            if stored is None:
                raise
            return stored
        with acquired:
            integration = Integration.objects.filter(
                id=self.integration.id, status=ObjectStatus.ACTIVE
            ).first()
            if integration is None:
                return None
            stored = _stored_token(integration, minimum_validity, force_refresh)
            if stored is not None:
                return stored
            metadata = integration.metadata
            refresh_token = metadata.get("refresh_token")
            if not isinstance(refresh_token, str) or not refresh_token:
                raise IntegrationConfigurationError(SUPABASE_AUTHORIZATION_ERROR)
            try:
                token = refresh_access_token(refresh_token).as_metadata()
            except SupabaseRefreshTokenError:
                # Reauthorization can replace the grant while the token request is in flight.
                current = Integration.objects.filter(id=integration.id).first()
                if current is not None and current.metadata.get("refresh_token") == refresh_token:
                    Integration.objects.filter(
                        id=integration.id,
                        status=ObjectStatus.ACTIVE,
                        date_updated=integration.date_updated,
                    ).update(status=ObjectStatus.DISABLED, date_updated=timezone.now())
                raise
            if not Integration.objects.filter(
                id=integration.id,
                status=ObjectStatus.ACTIVE,
                date_updated=integration.date_updated,
            ).update(metadata={**metadata, **token}, date_updated=timezone.now()):
                return None
            return token

    @control_silo_function
    def revoke_access(self, organization_id: int) -> None:
        lock = locks.get(
            f"supabase:access-token:{self.integration.id}",
            duration=30,
            name="supabase_access_token",
        )
        with lock.blocking_acquire(initial_delay=0.1, timeout=5):
            # The Supabase organization grant can be shared by separately authorized Sentry orgs.
            if (
                OrganizationIntegration.objects.filter(integration_id=self.integration.id)
                .exclude(organization_id=organization_id)
                .exclude(
                    status__in=[ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS]
                )
                .exists()
            ):
                return
            integration = Integration.objects.filter(id=self.integration.id).first()
            if integration is None:
                return
            refresh_token = integration.metadata.get("refresh_token")
            if refresh_token:
                client_id, client_secret = _oauth_credentials()
                try:
                    response = safe_urlopen(
                        SUPABASE_REVOKE_URL,
                        method="POST",
                        json={
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "refresh_token": refresh_token,
                        },
                        timeout=10,
                    )
                except (RestrictedIPAddress, RequestException):
                    raise IntegrationConfigurationError(SUPABASE_UNREACHABLE_ERROR) from None
                if response.status_code not in (200, 204):
                    raise IntegrationConfigurationError(SUPABASE_RESPONSE_ERROR)
            Integration.objects.filter(
                id=integration.id, date_updated=integration.date_updated
            ).update(
                metadata={
                    key: value
                    for key, value in integration.metadata.items()
                    if key not in {"access_token", "refresh_token", "expires_at"}
                },
                status=ObjectStatus.DISABLED,
                date_updated=timezone.now(),
            )
