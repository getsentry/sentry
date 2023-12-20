from __future__ import annotations

import ipaddress
import socket
from hashlib import sha1
from typing import TYPE_CHECKING, Any, Iterable, Mapping, Set

import sentry_sdk
import urllib3
from django.core.cache import cache
from django.http import HttpResponse
from django.http.request import HttpRequest
from django.utils.encoding import force_str
from requests import Request

from sentry.http import build_session
from sentry.net.http import SafeSession
from sentry.shared_integrations.client.base import BaseApiClient, BaseApiResponseX
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

if TYPE_CHECKING:
    from typing import FrozenSet

REQUEST_ATTEMPTS_LIMIT = 10
CACHE_TIMEOUT = 600  # 10 minutes = 600 seconds


class SiloClientError(Exception):
    """Indicates an error in processing a cross-silo HTTP request"""


class BaseSiloClient(BaseApiClient):
    integration_type = "silo_client"

    @property
    def access_modes(self) -> Iterable[SiloMode]:
        """
        Limit access to the client to only the SiloModes set here.
        """
        raise NotImplementedError

    def __init__(self) -> None:
        super().__init__()
        if SiloMode.get_current_mode() not in self.access_modes:
            access_mode_str = ", ".join(str(m) for m in self.access_modes)
            raise SiloClientError(
                f"Cannot invoke {self.__class__.__name__} from {SiloMode.get_current_mode()}. "
                f"Only available in: {access_mode_str}"
            )

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
    ) -> BaseApiResponseX:
        """
        Use the BaseApiClient interface to send a cross-region request.
        If the API is protected, auth may have to be provided manually.
        """
        # TODO: Establish a scheme to authorize requests across silos
        # (e.g. signing secrets, JWTs)
        client_response = super()._request(
            method,
            path,
            headers=clean_proxy_headers(headers),
            data=data,
            params=params,
            json=json,
            allow_text=True,
            raw_response=raw_response,
        )
        # TODO: Establish a scheme to check/log the Sentry Version of the requestor and server
        # optionally raising an error to alert developers of version drift
        return client_response


def get_region_ip_addresses() -> FrozenSet[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """
    Infers the Region Silo IP addresses from the SENTRY_REGION_CONFIG setting.
    """
    region_ip_addresses: Set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()

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


class RegionSiloClient(BaseSiloClient):
    access_modes = [SiloMode.CONTROL]

    metrics_prefix = "silo_client.region"
    log_path = "sentry.silo.client.region"
    silo_client_name = "region"

    def __init__(self, region: Region) -> None:
        super().__init__()
        if not isinstance(region, Region):
            raise SiloClientError(f"Invalid region provided. Received {type(region)} type instead.")

        # Ensure the region is registered
        self.region = get_region_by_name(region.name)
        self.base_url = self.region.address

    def build_session(self) -> SafeSession:
        """
        Generates a safe Requests session for the API client to use.
        This injects a custom is_ipaddress_permitted function to allow only connections to Region Silo IP addresses.
        """
        return build_session(is_ipaddress_permitted=validate_region_ip_address)

    def _get_hash_cache_key(self, hash: str) -> str:
        return f"region_silo_client:request_attempts:{hash}"

    def check_request_attempts(self, hash: str | None, method: str, path: str) -> None:
        if hash is None:
            return

        cache_key = self._get_hash_cache_key(hash=hash)
        request_attempts: int | None = cache.get(cache_key)

        if not isinstance(request_attempts, int):
            request_attempts = 0

        if request_attempts < REQUEST_ATTEMPTS_LIMIT:
            request_attempts += 1
            cache.set(cache_key, request_attempts, timeout=CACHE_TIMEOUT)
        else:
            cache.delete(cache_key)
            raise SiloClientError(f"Request attempts limit reached for: {method} {path}")

    def cleanup_request_attempts(self, hash: str | None) -> None:
        if hash is None:
            return
        cache_key = self._get_hash_cache_key(hash=hash)
        cache.delete(cache_key)

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
    ) -> BaseApiResponseX:
        """
        Sends a request to the region silo.
        If prefix_hash is provided, the request will be retries up to REQUEST_ATTEMPTS_LIMIT times.
        """
        hash = None
        if prefix_hash is not None:
            hash = sha1(f"{prefix_hash}{self.region.name}{method}{path}".encode()).hexdigest()

        try:
            response = super().request(
                method=method,
                path=path,
                headers=headers,
                data=data,
                params=params,
                json=json,
                raw_response=raw_response,
            )
        except Exception as error:
            self.check_request_attempts(hash=hash, method=method, path=path)
            raise error
        self.cleanup_request_attempts(hash=hash)
        return response
