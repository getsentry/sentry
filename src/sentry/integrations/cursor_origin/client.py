from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict

from requests import PreparedRequest

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_API_BASE_URL,
    PAGE_SIZE,
    TOKEN_MINIMUM_VALIDITY_SECONDS,
)
from sentry.integrations.cursor_origin.utils import get_jwt
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import ApiError, ApiPaginationTruncated
from sentry.silo.base import control_silo_function

logger = logging.getLogger("sentry.integrations.cursor_origin")

_APP_ROUTE_PREFIX = "/v1/origin/app"


def _is_app_route(path_url: str) -> bool:
    path = path_url.split("?", 1)[0]
    return path == _APP_ROUTE_PREFIX or path.startswith(f"{_APP_ROUTE_PREFIX}/")


def _parse_expires_at(value: str) -> datetime | None:
    """Origin sends RFC 3339. Returns an aware datetime, or None if unparseable."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class CursorOriginSetupApiClient(IntegrationProxyClient):
    """Authenticates as the app. Used during install, before an Integration exists."""

    base_url = CURSOR_ORIGIN_API_BASE_URL
    integration_name = "cursor_origin_setup"

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bearer {get_jwt()}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    def get_app(self) -> dict[str, Any]:
        return self.get("/app")

    def get_installation(self, installation_id: str) -> dict[str, Any]:
        return self.get(f"/app/installations/{installation_id}")


class CursorOriginApiClient(IntegrationProxyClient):
    """Authenticates as an installation, for an installed integration."""

    base_url = CURSOR_ORIGIN_API_BASE_URL
    integration_name = "cursor_origin"
    # Origin caps pageSize at 100, so this bounds a listing at 10,000 items.
    page_number_limit = 100

    integration: Integration | RpcIntegration

    class AccessTokenData(TypedDict):
        access_token: str
        expires_at: str

    def __init__(
        self,
        integration: Integration | RpcIntegration,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.integration = integration
        super().__init__(
            integration_id=integration.id,
            org_integration_id=org_integration_id,
            verify_ssl=verify_ssl,
            logging_context=logging_context,
        )

    @control_silo_function
    def _refresh_access_token(self) -> AccessTokenData | None:
        integration = Integration.objects.filter(id=self.integration.id).first()
        if not integration:
            return None

        data = self.post(f"/app/installations/{self.integration.external_id}/access_tokens")

        token = data.get("token") if isinstance(data, dict) else None
        expires_at = data.get("expiresAt") if isinstance(data, dict) else None
        if not isinstance(token, str) or not isinstance(expires_at, str):
            raise ApiError("unexpected access_tokens response from Cursor Origin")
        # Storing an expiry we cannot read would refresh on every later request, quietly
        # and forever. Fail once here instead.
        if _parse_expires_at(expires_at) is None:
            raise ApiError(f"unparseable expiresAt from Cursor Origin: {expires_at!r}")

        integration.metadata.update({"access_token": token, "expires_at": expires_at})
        integration.save()
        self.integration = integration

        return {"access_token": token, "expires_at": expires_at}

    @control_silo_function
    def get_access_token(
        self, token_minimum_validity_time: timedelta | None = None
    ) -> AccessTokenData | None:
        """Reuse the stored installation token, refreshing it before it expires."""
        if token_minimum_validity_time is None:
            token_minimum_validity_time = timedelta(seconds=TOKEN_MINIMUM_VALIDITY_SECONDS)

        access_token = self.integration.metadata.get("access_token")
        raw_expires_at = self.integration.metadata.get("expires_at")
        if not isinstance(access_token, str) or not isinstance(raw_expires_at, str):
            return self._refresh_access_token()

        # An unparseable expiry refreshes rather than being treated as valid: Origin
        # invalidates tokens on uninstall, so a token we cannot date is not safe to reuse.
        expires_at = _parse_expires_at(raw_expires_at)
        if expires_at is None or expires_at < datetime.now(UTC) + token_minimum_validity_time:
            return self._refresh_access_token()

        return {"access_token": access_token, "expires_at": raw_expires_at}

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        if _is_app_route(prepared_request.path_url):
            token: str | None = get_jwt()
        else:
            data = self.get_access_token()
            token = data["access_token"] if data else None

        if not token:
            logger.info(
                "cursor_origin.no_token",
                extra={
                    "path_url": prepared_request.path_url,
                    "integration_id": self.integration.id,
                },
            )
            return prepared_request

        prepared_request.headers["Authorization"] = f"Bearer {token}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    def _paginate(self, path: str, collection_key: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        page_token: str | None = None

        for _ in range(self.page_number_limit):
            params: dict[str, Any] = {"pageSize": PAGE_SIZE}
            if page_token:
                params["pageToken"] = page_token

            response = self.get(path, params=params)
            if not isinstance(response, dict):
                return results

            results.extend(response.get(collection_key) or [])

            page_token = response.get("nextPageToken") or None
            if not page_token:
                return results

        raise ApiPaginationTruncated(results)
