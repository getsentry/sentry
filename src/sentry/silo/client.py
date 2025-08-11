from __future__ import annotations

import ipaddress
import logging
import socket
from collections.abc import Mapping
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
from sentry.net.http import SafeSession
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_DIRECT_LOCATION_HEADER,
    clean_outbound_headers,
    clean_proxy_headers,
)
from sentry.types.region import (
    Region,
    RegionResolutionError,
    find_all_region_addresses,
    get_region_by_name,
)

REQUEST_ATTEMPTS_LIMIT = 10
CACHE_TIMEOUT = 43200  # 12 hours = 60 * 60 * 12 seconds


class SiloClientError(Exception):
    """Indicates an error in processing a cross-silo HTTP request"""


def get_region_ip_addresses() -> frozenset[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """
    Infers the Region Silo IP addresses from the SENTRY_REGION_CONFIG setting.
    """
    region_ip_addresses: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()

    for address in find_all_region_addresses():
        url = urllib3.util.parse_url(address)
        if url.host:
            # This is an IPv4 address.
            # In the future we can consider adding IPv4/v6 dual stack support if and when we start using IPv6 addresses.
            ip = socket.gethostbyname(url.host)
            region_ip_addresses.add(ipaddress.ip_address(force_str(ip, strings_only=True)))
        else:
            sentry_sdk.capture_exception(
                RegionResolutionError(f"Unable to parse url to host for: {address}")
            )

    return frozenset(region_ip_addresses)


def validate_region_ip_address(ip: str) -> bool:
    """
    Checks if the provided IP address is a Region Silo IP address.
    """
    allowed_region_ip_addresses = get_region_ip_addresses()
    if not allowed_region_ip_addresses:
        sentry_sdk.capture_exception(
            RegionResolutionError(f"allowed_region_ip_addresses is empty for: {ip}")
        )
        return False

    ip_address = ipaddress.ip_address(force_str(ip, strings_only=True))
    result = ip_address in allowed_region_ip_addresses

    if not result:
        sentry_sdk.capture_exception(
            RegionResolutionError(f"Disallowed Region Silo IP address: {ip}")
        )
    return result


class RegionSiloClient(BaseApiClient):
    integration_type = "silo_client"

    access_modes = [SiloMode.CONTROL]

    metrics_prefix = "silo_client.region"
    logger = logging.getLogger("sentry.silo.client.region")
    silo_client_name = "region"

    def __init__(self, region: Region, retry: bool = False) -> None:
        super().__init__()
        if SiloMode.get_current_mode() not in self.access_modes:
            access_mode_str = ", ".join(str(m) for m in self.access_modes)
            raise SiloClientError(
                f"Cannot invoke {self.__class__.__name__} from {SiloMode.get_current_mode()}. "
                f"Only available in: {access_mode_str}"
            )

        if not isinstance(region, Region):
            raise SiloClientError(f"Invalid region provided. Received {type(region)} type instead.")

        # Ensure the region is registered
        self.region = get_region_by_name(region.name)
        self.base_url = self.region.address
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
    ) -> Any:
        """
        Sends a request to the region silo.
        If prefix_hash is provided, the request will be retries up to REQUEST_ATTEMPTS_LIMIT times.
        """
        if prefix_hash is not None:
            hash = sha256(f"{prefix_hash}{self.region.name}{method}{path}".encode()).hexdigest()
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
        )

    def build_session(self) -> SafeSession:
        """
        Generates a safe Requests session for the API client to use.
        This injects a custom is_ipaddress_permitted function to allow only connections to Region Silo IP addresses.
        """
        if not self.retry:
            return build_session(
                is_ipaddress_permitted=validate_region_ip_address,
            )

        return build_session(
            is_ipaddress_permitted=validate_region_ip_address,
            max_retries=Retry(
                total=options.get("hybridcloud.regionsiloclient.retries"),
                backoff_factor=0.1,
                status_forcelist=[503],
                allowed_methods=["PATCH", "HEAD", "PUT", "GET", "DELETE", "POST"],
            ),
        )

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
