from __future__ import annotations

import ipaddress
import logging
import socket
import threading
from collections.abc import Mapping
from contextlib import AbstractContextManager, nullcontext
from hashlib import sha256
from typing import Any

import sentry_sdk
import urllib3
from django.core.cache import cache
from django.http import HttpResponse
from django.http.request import HttpRequest
from django.utils.encoding import force_str
from requests import Request
from requests.adapters import Retry

from sentry import options
from sentry.http import build_session
from sentry.net.http import SafeSession, StatelessCookieJar
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.cell import (
    Cell,
    CellResolutionError,
    get_cell_by_name,
    get_global_directory,
)
from sentry.utils import metrics

REQUEST_ATTEMPTS_LIMIT = 10
CACHE_TIMEOUT = 43200  # 12 hours = 60 * 60 * 12 seconds

# Idle connections a process keeps open per cell. A thread past the cap still
# connects, but its connection is closed after use instead of pooled, so this
# mirrors the most requests one process has in flight to a cell: a webhook
# drain's `hybridcloud.webhookpayload.worker_threads`.
CELL_SESSION_POOL_MAXSIZE = 16


class SiloClientError(Exception):
    """Indicates an error in processing a cross-silo HTTP request"""


def get_cell_ip_addresses() -> frozenset[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """
    Infers the Cell Silo IP addresses from the SENTRY_CELLS setting.
    """
    cell_ip_addresses: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()

    for cell in get_global_directory().cells:
        addresses = [cell.address]
        if cell.api_gateway_address:
            addresses.append(cell.api_gateway_address)
        for address in addresses:
            url = urllib3.util.parse_url(address)
            if url.host:
                # This is an IPv4 address.
                # In the future we can consider adding IPv4/v6 dual stack support if and when we start using IPv6 addresses.
                try:
                    ip = socket.gethostbyname(url.host)
                except Exception:
                    metrics.incr(
                        "hybrid_cloud.silo_client.ip_address_resolution_error",
                        tags={"cell": cell.name},
                    )
                    sentry_sdk.capture_exception(
                        CellResolutionError(f"Unable to resolve cell host for: {url.host}")
                    )
                    continue
                cell_ip_addresses.add(ipaddress.ip_address(force_str(ip, strings_only=True)))
            else:
                sentry_sdk.capture_exception(
                    CellResolutionError(f"Unable to parse url to host for: {address}")
                )

    return frozenset(cell_ip_addresses)


def validate_cell_ip_address(ip: str) -> bool:
    """
    Checks if the provided IP address is a Cell Silo IP address.
    """
    allowed_cell_ip_addresses = get_cell_ip_addresses()
    if not allowed_cell_ip_addresses:
        sentry_sdk.capture_exception(
            CellResolutionError(f"allowed_cell_ip_addresses is empty for: {ip}")
        )
        return False

    ip_address = ipaddress.ip_address(force_str(ip, strings_only=True))
    result = ip_address in allowed_cell_ip_addresses

    if not result:
        sentry_sdk.capture_exception(CellResolutionError(f"Disallowed Cell Silo IP address: {ip}"))
    return result


def _new_cell_session(retries: int | None) -> SafeSession:
    max_retries = None
    if retries is not None:
        max_retries = Retry(
            total=retries,
            backoff_factor=0.1,
            status_forcelist=[503],
            allowed_methods=["PATCH", "HEAD", "PUT", "GET", "DELETE", "POST"],
        )
    session = build_session(
        is_ipaddress_permitted=validate_cell_ip_address,
        max_retries=max_retries,
        pool_maxsize=CELL_SESSION_POOL_MAXSIZE,
    )
    session.cookies = StatelessCookieJar()
    return session


# Keyed by cell name and whether the session retries; the value records the
# retry count the session was built with, so a live change to the retries
# option replaces the session instead of stranding the old one.
_cell_sessions: dict[tuple[str, bool], tuple[int | None, SafeSession]] = {}
_cell_sessions_lock = threading.Lock()


def get_cell_session(cell: Cell, retries: int | None) -> SafeSession:
    """
    The process-wide session for requests to `cell`, created on first use.

    Sharing it across `CellSiloClient` instances is what lets connections be
    reused: a session closed after one request pools nothing. Threads are
    free to send on it concurrently; urllib3 pools hand out one connection
    per in-flight request. The retry policy is baked into a session's
    adapter, so the retrying and non-retrying clients get separate sessions,
    and a session built with a stale retry count is closed and rebuilt. Cells
    get their own too, rather than sharing one session's host pools, so a
    `PoolManager` LRU-evicting a cell's pool cannot quietly bring back
    per-request connections.
    """
    key = (cell.name, retries is not None)
    stale: SafeSession | None = None
    with _cell_sessions_lock:
        entry = _cell_sessions.get(key)
        if entry is None or entry[0] != retries:
            if entry is not None:
                stale = entry[1]
            session = _new_cell_session(retries)
            _cell_sessions[key] = (retries, session)
        else:
            session = entry[1]
    if stale is not None:
        # Requests already running on it keep their connection; closing only
        # empties its pool so nothing new is handed out.
        stale.close()
    return session


def close_cell_sessions() -> None:
    """Close and forget every shared cell session. Tests reset with this."""
    with _cell_sessions_lock:
        sessions = [session for _, session in _cell_sessions.values()]
        _cell_sessions.clear()
    for session in sessions:
        session.close()


class CellSiloClient(BaseApiClient):
    integration_type = "silo_client"

    access_modes = [SiloMode.CONTROL]

    metrics_prefix = "silo_client.cell"
    logger = logging.getLogger("sentry.silo.client.cell")
    silo_client_name = "cell"

    def __init__(self, cell: Cell, retry: bool = False) -> None:
        super().__init__()
        if SiloMode.get_current_mode() not in self.access_modes:
            access_mode_str = ", ".join(str(m) for m in self.access_modes)
            raise SiloClientError(
                f"Cannot invoke {self.__class__.__name__} from {SiloMode.get_current_mode()}. "
                f"Only available in: {access_mode_str}"
            )

        if not isinstance(cell, Cell):
            raise SiloClientError(f"Invalid cell provided. Received {type(cell)} type instead.")

        # Ensure the cell is registered
        self.cell = get_cell_by_name(cell.name)
        self.base_url = self.cell.address

        if self.cell.api_gateway_address:
            self.base_url = self.cell.api_gateway_address
        self.retry = retry

    def proxy_request(self, incoming_request: HttpRequest) -> HttpResponse:
        """
        Directly proxy the provided request to the appropriate silo with minimal header changes.
        """
        full_url = self.build_url(incoming_request.get_full_path())
        prepared_request = Request(
            method=incoming_request.method,
            url=full_url,
            headers=clean_proxy_headers(incoming_request.headers),
            data=incoming_request.body,
        ).prepare()
        assert incoming_request.method is not None
        raw_response = super()._request(
            incoming_request.method,
            incoming_request.get_full_path(),
            prepared_request=prepared_request,
            raw_response=True,
        )
        self.logger.info(
            "proxy_request",
            extra={"method": incoming_request.method, "path": incoming_request.path},
        )
        http_response = HttpResponse(
            content=raw_response.content,
            status=raw_response.status_code,
            reason=raw_response.reason,
            content_type=raw_response.headers.get("Content-Type"),
            # XXX: Can be added in Django 3.2
            # headers=raw_response.headers
        )
        valid_headers = clean_outbound_headers(raw_response.headers)
        for header, value in valid_headers.items():
            http_response[header] = value
        http_response[PROXY_DIRECT_LOCATION_HEADER] = full_url
        return http_response

    def request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, Any] | None = None,
        data: Any | None = None,
        params: Mapping[str, Any] | None = None,
        json: bool = True,
        raw_response: bool = False,
        prefix_hash: str | None = None,
        timeout: int | None = None,
    ) -> Any:
        """
        Sends a request to the cell silo.
        If prefix_hash is provided, the request will be retries up to REQUEST_ATTEMPTS_LIMIT times.
        """
        if prefix_hash is not None:
            hash = sha256(f"{prefix_hash}{self.cell.name}{method}{path}".encode()).hexdigest()
            self.check_request_attempts(hash=hash, method=method, path=path)
        return self._request(
            method=method,
            path=path,
            headers=clean_proxy_headers(headers),
            data=data,
            params=params,
            json=json,
            allow_text=True,
            raw_response=raw_response,
            timeout=timeout,
        )

    def _retries(self) -> int | None:
        if not self.retry:
            return None
        return options.get("hybridcloud.regionsiloclient.retries")

    def build_session(self) -> SafeSession:
        """
        Generates a safe Requests session for the API client to use.
        This injects a custom is_ipaddress_permitted function to allow only connections to Cell Silo IP addresses.
        """
        return _new_cell_session(self._retries())

    def borrow_session(self) -> AbstractContextManager[SafeSession]:
        """
        Send on the process-wide session for this cell instead of a fresh one
        per request, and leave it open afterwards so its connections are there
        for the next request. The cell IP check is bound to the session's
        pools and runs on every new connection, reused session or not.
        """
        return nullcontext(get_cell_session(self.cell, self._retries()))

    def _get_hash_cache_key(self, hash: str) -> str:
        return f"region_silo_client:request_attempts:{hash}"

    def check_request_attempts(self, hash: str, method: str, path: str) -> None:
        cache_key = self._get_hash_cache_key(hash=hash)
        request_attempts: int | None = cache.get(cache_key)

        if not isinstance(request_attempts, int):
            request_attempts = 0

        self.logger.info(
            "silo_client.check_request_attempts",
            extra={
                "path": path,
                "method": method,
                "request_hash": hash,
                "request_attempts": request_attempts,
                "configured_attempt_limit": REQUEST_ATTEMPTS_LIMIT,
            },
        )
        request_attempts += 1
        cache.set(cache_key, request_attempts, timeout=CACHE_TIMEOUT)

        if request_attempts > REQUEST_ATTEMPTS_LIMIT:
            raise SiloClientError(f"Request attempts limit reached for: {method} {path}")
