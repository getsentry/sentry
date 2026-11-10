from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, TypedDict

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

LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize"
LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token"
LINEAR_REVOKE_URL = "https://api.linear.app/oauth/revoke"
# This endpoint only exposes read tools, whatever the token itself is allowed to do.
# See https://linear.app/docs/mcp.
LINEAR_MCP_URL = "https://mcp.linear.app/mcp/readonly"

LINEAR_UNREACHABLE_MESSAGE = "Could not reach Linear. Please try again."
LINEAR_AUTHORIZATION_ERROR_MESSAGE = "Linear authorization failed. Authorize your workspace again."
LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE = (
    "The app can't read your Linear workspace. Check its access in Linear's application settings."
)
LINEAR_ERROR_MESSAGE = (
    "Something went wrong while checking the connection to Linear. Please try again."
)

_WORKSPACE_QUERY = "query SentrySeerConnectionCheck { organization { id name } viewer { id } }"

LINEAR_SCOPES = ["read", "write"]

# How long a just-written token satisfies a forced refresh. Concurrent callers whose shared
# token was rejected serialize on the lock below; the first one's refresh (or a concurrent
# reauthorization) already replaced the rejected token, so the rest reuse it instead of
# rotating the credentials once per caller.
FORCED_REFRESH_REUSE_WINDOW = timedelta(seconds=30)


class LinearWorkspace(TypedDict):
    id: str
    name: str
    app_user_id: str


class LinearAccessToken(TypedDict):
    access_token: str
    expires_at: str


class LinearTokenMetadata(LinearAccessToken):
    refresh_token: str
    scopes: list[str]


class LinearRefreshTokenError(IntegrationConfigurationError):
    """The workspace grant was revoked or its refresh token is no longer valid."""


class LinearToken(BaseModel):
    access_token: SecretStr
    refresh_token: SecretStr
    expires_at: datetime
    scopes: list[str]

    def as_metadata(self) -> LinearTokenMetadata:
        return {
            "access_token": self.access_token.get_secret_value(),
            "refresh_token": self.refresh_token.get_secret_value(),
            "expires_at": self.expires_at.isoformat(),
            "scopes": self.scopes,
        }


def _request_token(params: dict[str, str]) -> LinearToken:
    client_id = settings.LINEAR_CLIENT_ID
    client_secret = settings.LINEAR_CLIENT_SECRET
    if not client_id or not client_secret:
        raise IntegrationConfigurationError("Linear OAuth is not configured in Sentry.")
    requested_at = timezone.now()
    try:
        resp = safe_urlopen(
            LINEAR_TOKEN_URL,
            method="POST",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                **params,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(LINEAR_UNREACHABLE_MESSAGE) from None

    try:
        body = orjson.loads(safe_urlread(resp))
    except orjson.JSONDecodeError:
        body = None
    if resp.status_code in (400, 401, 403):
        if (
            params["grant_type"] == "refresh_token"
            and isinstance(body, dict)
            and body.get("error") == "invalid_grant"
        ):
            raise LinearRefreshTokenError(LINEAR_AUTHORIZATION_ERROR_MESSAGE)
        raise IntegrationConfigurationError(LINEAR_AUTHORIZATION_ERROR_MESSAGE)
    if resp.status_code != 200 or not isinstance(body, dict):
        raise IntegrationConfigurationError(LINEAR_ERROR_MESSAGE)

    access_token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    expires_in = body.get("expires_in")
    scope = body.get("scope")
    # Older Linear apps return scopes as an array rather than a space-separated string.
    scopes = scope.replace(",", " ").split() if isinstance(scope, str) else scope
    if (
        not isinstance(access_token, str)
        or not access_token
        or not isinstance(refresh_token, str)
        or not refresh_token
        or type(expires_in) is not int
        or not 0 < expires_in <= 30 * 24 * 60 * 60
        or str(body.get("token_type", "")).lower() != "bearer"
        or not isinstance(scopes, list)
        or sorted(scopes) != LINEAR_SCOPES
    ):
        raise IntegrationConfigurationError(LINEAR_ERROR_MESSAGE)
    return LinearToken(
        access_token=SecretStr(access_token),
        refresh_token=SecretStr(refresh_token),
        expires_at=requested_at + timedelta(seconds=expires_in),
        scopes=list(LINEAR_SCOPES),
    )


def exchange_authorization_code(code: str, redirect_uri: str) -> LinearToken:
    return _request_token(
        {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}
    )


def refresh_access_token(refresh_token: str) -> LinearToken:
    return _request_token({"grant_type": "refresh_token", "refresh_token": refresh_token})


def _errors(body: Any) -> list[Any]:
    errors = body.get("errors") if isinstance(body, dict) else None
    return errors if isinstance(errors, list) else []


def _error_codes(errors: list[Any]) -> set[str]:
    return {
        error["extensions"]["code"]
        for error in errors
        if isinstance(error, dict)
        and isinstance(error.get("extensions"), dict)
        and isinstance(error["extensions"].get("code"), str)
    }


def _workspace(body: Any) -> LinearWorkspace | None:
    data = body.get("data") if isinstance(body, dict) else None
    organization = data.get("organization") if isinstance(data, dict) else None
    viewer = data.get("viewer") if isinstance(data, dict) else None
    if not isinstance(organization, dict) or not isinstance(viewer, dict):
        return None
    workspace_id = organization.get("id")
    name = organization.get("name")
    app_user_id = viewer.get("id")
    if not (
        isinstance(workspace_id, str)
        and workspace_id
        and isinstance(name, str)
        and name
        and isinstance(app_user_id, str)
        and app_user_id
    ):
        return None
    return {"id": workspace_id, "name": name, "app_user_id": app_user_id}


def validate_linear_access_token(access_token: str) -> LinearWorkspace:
    """Return the workspace the app can read, or raise if validation fails."""
    try:
        resp = safe_urlopen(
            LINEAR_GRAPHQL_URL,
            method="POST",
            json={"query": _WORKSPACE_QUERY},
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(LINEAR_UNREACHABLE_MESSAGE) from None

    # GraphQL reports failures in the body, so read it whatever the status is.
    try:
        body = orjson.loads(safe_urlread(resp))
    except orjson.JSONDecodeError:
        body = None

    errors = _errors(body)
    codes = _error_codes(errors)
    if resp.status_code == 401 or "AUTHENTICATION_ERROR" in codes:
        raise IntegrationConfigurationError(LINEAR_AUTHORIZATION_ERROR_MESSAGE)
    if resp.status_code == 403 or "FORBIDDEN" in codes:
        raise IntegrationConfigurationError(LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE)

    workspace = _workspace(body)
    # The query reads a single object, so any error means the check didn't pass.
    if resp.status_code != 200 or errors or workspace is None:
        raise IntegrationConfigurationError(LINEAR_ERROR_MESSAGE)
    return workspace


def _reusable_stored_token(
    integration: Integration, minimum_validity: timedelta, force_refresh: bool
) -> LinearAccessToken | None:
    """Return the stored token if it's valid for long enough and, when the caller's copy
    was rejected, has been replaced since."""
    metadata = integration.metadata
    access_token = metadata.get("access_token")
    raw_expires_at = metadata.get("expires_at")
    try:
        expires_at = datetime.fromisoformat(raw_expires_at) if raw_expires_at else None
    except (TypeError, ValueError):
        expires_at = None
    stored_token_usable = (
        access_token
        and expires_at is not None
        and expires_at.tzinfo is not None
        and expires_at > datetime.now(UTC) + minimum_validity
    )
    # Every credential write bumps date_updated, so a recent bump means the rejected
    # token a forcing caller saw is already gone.
    if stored_token_usable and (
        not force_refresh or integration.date_updated > timezone.now() - FORCED_REFRESH_REUSE_WINDOW
    ):
        return {"access_token": access_token, "expires_at": raw_expires_at}
    return None


class LinearClient:
    def __init__(self, integration: Integration | RpcIntegration) -> None:
        self.integration = integration

    @control_silo_function
    def get_access_token(
        self,
        token_minimum_validity_time: timedelta | None = None,
        *,
        force_refresh: bool = False,
    ) -> LinearAccessToken | None:
        minimum_validity = token_minimum_validity_time or timedelta(minutes=5)
        lock = locks.get(
            f"linear:access-token:{self.integration.id}", duration=30, name="linear_access_token"
        )
        try:
            acquired = lock.blocking_acquire(initial_delay=0.1, timeout=5)
        except UnableToAcquireLock:
            # The holder's token request can outlast this wait. If it already stored a
            # usable replacement, hand that out instead of failing.
            integration = Integration.objects.filter(
                id=self.integration.id, status=ObjectStatus.ACTIVE
            ).first()
            if integration is None:
                return None
            token = _reusable_stored_token(integration, minimum_validity, force_refresh)
            if token is None:
                raise
            return token
        with acquired:
            integration = Integration.objects.filter(
                id=self.integration.id, status=ObjectStatus.ACTIVE
            ).first()
            if integration is None:
                return None
            metadata = integration.metadata
            stored = _reusable_stored_token(integration, minimum_validity, force_refresh)
            if stored is not None:
                return stored

            refresh_token = metadata.get("refresh_token")
            if not refresh_token:
                raise IntegrationConfigurationError(LINEAR_AUTHORIZATION_ERROR_MESSAGE)
            try:
                token = refresh_access_token(refresh_token).as_metadata()
            except LinearRefreshTokenError:
                # A concurrent reauthorization must not be disabled by the old grant's failure.
                # The date_updated filter catches stamped writes atomically; re-reading the
                # stored refresh token also covers writers that persist new credentials
                # without bumping date_updated.
                current = Integration.objects.filter(id=integration.id).first()
                if current is not None and current.metadata.get("refresh_token") == refresh_token:
                    Integration.objects.filter(
                        id=integration.id,
                        status=ObjectStatus.ACTIVE,
                        date_updated=integration.date_updated,
                    ).update(status=ObjectStatus.DISABLED, date_updated=timezone.now())
                raise
            # Persist both rotating tokens together, without overwriting a new authorization.
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
            f"linear:access-token:{self.integration.id}", duration=30, name="linear_access_token"
        )
        with lock.blocking_acquire(initial_delay=0.1, timeout=5):
            # Linear's app grant belongs to the workspace, which can serve multiple Sentry orgs.
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
                try:
                    resp = safe_urlopen(
                        LINEAR_REVOKE_URL,
                        method="POST",
                        data={"token": refresh_token, "token_type_hint": "refresh_token"},
                        timeout=10,
                    )
                except (RestrictedIPAddress, RequestException):
                    raise IntegrationConfigurationError(LINEAR_UNREACHABLE_MESSAGE) from None
                # Linear returns 400 when the token has already been revoked.
                if resp.status_code not in (200, 400):
                    raise IntegrationConfigurationError(LINEAR_ERROR_MESSAGE)
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
