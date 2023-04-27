from __future__ import annotations

import logging

from django.conf import settings
from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    DEFAULT_REQUEST_BODY,
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
    trim_leading_slashes,
)

logger = logging.getLogger(__name__)


class IntegrationProxyClient(ApiClient):  # type: ignore
    """
    Universal Client to access third-party resources safely in Hybrid Cloud.
    Requests to third parties must always exit the Sentry subnet via the Control Silo, and only
    add sensitive credentials at that stage.
    """

    should_proxy_to_control = False

    def __init__(
        self, integration_id: int | None = None, org_integration_id: int | None = None
    ) -> None:
        super().__init__()

        self.integration_id = integration_id
        self.org_integration_id = org_integration_id

        is_region_silo = SiloMode.get_current_mode() == SiloMode.REGION
        subnet_secret = getattr(settings, "SENTRY_SUBNET_SECRET")
        control_address = getattr(settings, "SENTRY_CONTROL_ADDRESS")

        if is_region_silo and subnet_secret and control_address:
            self.should_proxy_to_control = True
            self.proxy_url = f"{settings.SENTRY_CONTROL_ADDRESS}{PROXY_BASE_PATH}"

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Used in the Control Silo to authorize all outgoing requests to the service provider.
        """
        return prepared_request

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Every request through this subclassed clients run this method.
        If running as a monolith/control, we must authorize each request before sending.
        If running as a region, we don't authorize and instead, send it to our proxy endpoint.
        """
        if not self.should_proxy_to_control or not prepared_request.url:
            return self.authorize_request(prepared_request=prepared_request)

        # E.g. client.get("/chat.postMessage") -> proxy_path = 'chat.postMessage'
        proxy_path = trim_leading_slashes(prepared_request.url[len(self.base_url) :])
        url = f"{self.proxy_url}/{proxy_path}"

        request_body = prepared_request.body
        if not isinstance(request_body, bytes):
            request_body = request_body.encode("utf-8") if request_body else DEFAULT_REQUEST_BODY
        prepared_request.headers[PROXY_OI_HEADER] = str(self.org_integration_id)
        prepared_request.headers[PROXY_SIGNATURE_HEADER] = encode_subnet_signature(
            secret=settings.SENTRY_SUBNET_SECRET,
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
