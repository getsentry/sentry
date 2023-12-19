from __future__ import annotations

import ipaddress
import logging
import socket
from functools import lru_cache
from typing import Any, Mapping
from urllib.parse import ParseResult, urljoin, urlparse

import sentry_sdk
import urllib3
from django.conf import settings
from django.utils.encoding import force_str
from requests import PreparedRequest

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.http import build_session
from sentry.integrations.client import ApiClient
from sentry.net.http import SafeSession
from sentry.services.hybrid_cloud.integration.service import integration_service
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    DEFAULT_REQUEST_BODY,
    PROXY_BASE_PATH,
    PROXY_BASE_URL_HEADER,
    PROXY_KEYID_HEADER,
    PROXY_OI_HEADER,
    PROXY_PATH,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
    trim_leading_slashes,
)
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_control_silo_ip_address() -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    address: str | None = settings.SENTRY_CONTROL_ADDRESS
    if address is None:
        return None

    url = urllib3.util.parse_url(address)
    if url.host:
        # This is an IPv4 address.
        # In the future we can consider adding IPv4/v6 dual stack support if and when we start using IPv6 addresses.
        ip = socket.gethostbyname(url.host)
        return ipaddress.ip_address(force_str(ip, strings_only=True))
    else:
        sentry_sdk.capture_exception(
            Exception(f"Unable to parse hostname of control silo address: {address}")
        )
    return None


def is_control_silo_ip_address(ip: str) -> bool:
    ip_address = ipaddress.ip_address(force_str(ip, strings_only=True))

    expected_address = get_control_silo_ip_address()
    result = ip_address == expected_address

    if not result:
        sentry_sdk.capture_exception(Exception(f"Disallowed Control Silo IP address: {ip}"))
    return result


def infer_org_integration(
    integration_id: int, ctx_logger: logging.Logger | None = None
) -> int | None:
    """
    Given an integration_id, return the first associated org_integration_id.
    The IntegrationProxyClient requires org_integration context to proxy requests properly
    but sometimes clients don't have context on the specific organization issuing a request.
    In those situations, we just grab the first organization and log this assumption.
    """
    org_integration_id = None
    with in_test_hide_transaction_boundary():
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration_id
        )
    if len(org_integrations) > 0:
        org_integration_id = org_integrations[0].id
        if ctx_logger:
            ctx_logger.info(
                "infer_organization_from_integration",
                extra={
                    "integration_id": integration_id,
                    "org_integration_id": org_integration_id,
                },
            )
    return org_integration_id


def get_proxy_url() -> str:
    control_address: str = settings.SENTRY_CONTROL_ADDRESS
    return urljoin(control_address, PROXY_BASE_PATH)


class IntegrationProxyClient(ApiClient):
    """
    Universal Client to access third-party resources safely in Hybrid Cloud.
    Requests to third parties must always exit the Sentry subnet via the Control Silo, and only
    add sensitive credentials at that stage.

    When testing, client requests will always go to the base_url unless `self._use_proxy_url_for_tests`
    is set to True. Enable to test proxying locally.
    """

    _should_proxy_to_control = False
    _use_proxy_url_for_tests = False

    def __init__(
        self,
        integration_id: int | None = None,
        org_integration_id: int | None = None,
        keyid: str | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(
            verify_ssl=verify_ssl, logging_context=logging_context, integration_id=integration_id
        )
        self.org_integration_id = org_integration_id
        self.keyid = keyid

        if self.determine_whether_should_proxy_to_control():
            self._should_proxy_to_control = True
            self.proxy_url = get_proxy_url()

        if in_test_environment() and not self._use_proxy_url_for_tests:
            logger.info("proxy_disabled_in_test_env")
            self.proxy_url = self.base_url

    def build_session(self) -> SafeSession:
        """
        Generates a safe Requests session for the API client to use.
        This injects a custom is_ipaddress_permitted function to allow only connections to the IP address of the Control Silo.
        We only validate the IP address from within the Region Silo.
        For all other silo modes, we use the default is_ipaddress_permitted function, which tests against SENTRY_DISALLOWED_IPS.
        """
        if SiloMode.get_current_mode() == SiloMode.REGION:
            return build_session(is_ipaddress_permitted=is_control_silo_ip_address)
        return build_session()

    @staticmethod
    def determine_whether_should_proxy_to_control() -> bool:
        return (
            SiloMode.get_current_mode() == SiloMode.REGION
            and getattr(settings, "SENTRY_SUBNET_SECRET", None) is not None
            and getattr(settings, "SENTRY_CONTROL_ADDRESS", None) is not None
        )

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Used in the Control Silo to authorize all outgoing requests to the service provider.
        """
        return prepared_request

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Every request through these subclassed clients run this method.
        If running as a monolith/control, we must authorize each request before sending.
        If running as a region, we don't authorize and instead, send it to our proxy endpoint,
        where tokens are added in by Control Silo. We do this to avoid race conditions around
        stale tokens and centralize token refresh flows.
        """
        if not self._should_proxy_to_control or not prepared_request.url:
            prepared_request = self.authorize_request(prepared_request=prepared_request)
            return prepared_request

        assert self.base_url and self.proxy_url

        base_url = self.base_url.rstrip("/")
        if not prepared_request.url.startswith(base_url):
            parsed = urlparse(prepared_request.url)
            proxy_path = parsed.path
            base_url = ParseResult(
                scheme=parsed.scheme,
                netloc=parsed.netloc,
                path="",
                params="",
                query="",
                fragment="",
            ).geturl()
            base_url = base_url.rstrip("/")

        # E.g. client.get("/chat.postMessage") -> proxy_path = 'chat.postMessage'
        proxy_path = trim_leading_slashes(prepared_request.url[len(base_url) :])
        proxy_url = self.proxy_url.rstrip("/")

        url = f"{proxy_url}/"

        if (
            not self._should_proxy_to_control
            or (in_test_environment() and not self._use_proxy_url_for_tests)
            and proxy_path
        ):
            # When proxying to control is disabled, or in the default test environment
            # This proxy acts as a passthrough, so we need to append the path directly
            url = f"{url}{proxy_path}".rstrip("/")

        request_body = prepared_request.body
        if not isinstance(request_body, bytes):
            request_body = request_body.encode("utf-8") if request_body else DEFAULT_REQUEST_BODY
        prepared_request.headers[PROXY_OI_HEADER] = str(self.org_integration_id)
        prepared_request.headers[PROXY_PATH] = proxy_path
        if self.keyid:
            prepared_request.headers[PROXY_KEYID_HEADER] = str(self.keyid)
        prepared_request.headers[PROXY_BASE_URL_HEADER] = base_url
        prepared_request.headers[PROXY_SIGNATURE_HEADER] = encode_subnet_signature(
            secret=settings.SENTRY_SUBNET_SECRET,
            base_url=base_url,
            path=proxy_path,
            identifier=str(self.org_integration_id),
            request_body=request_body,
        )
        prepared_request.url = url
        logger.info(
            "prepare_proxy_request",
            extra={
                "desitination": prepared_request.url,
                "organization_integration_id": self.org_integration_id,
            },
        )
        return prepared_request
