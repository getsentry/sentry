import time

from django.conf import settings
from requests import PreparedRequest, Request

from sentry.integrations.client import ApiClient
from sentry.middleware.integrations.integration_proxy import (
    PROXY_ADDRESS,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    PROXY_TIMESTAMP_HEADER,
)
from sentry.silo.base import SiloMode
from sentry.silo.util import encode_subnet_signature


class IntegrationProxyClient(ApiClient):
    """
    Universal Client to access third-party resources safely in Hybrid Cloud.
    Requests to third parties must always exit the Sentry subnet via the Control Silo, and only
    add sensitive credentials at that stage.
    """

    should_proxy = False

    def __init__(self, org_integration_id: int) -> None:
        super().__init__()
        self.org_integration_id = org_integration_id

        is_region_silo = SiloMode.get_current_mode() == SiloMode.REGION
        subnet_secret = getattr(settings, "SENTRY_SUBNET_SECRET")
        control_address = getattr(settings, "SENTRY_CONTROL_ADDRESS")

        if is_region_silo and subnet_secret and control_address:
            self.should_proxy = True
            self.proxy_url = f"{settings.SENTRY_CONTROL_ADDRESS}{PROXY_ADDRESS}"

    def authorize_request(self, request: Request) -> Request:
        raise NotImplementedError(
            "'authorize_request' method must be implemented to safely proxy requests."
        )

    def build_url(self, path: str) -> str:
        """
        Overriding build_url here allows us to use a direct proxy, rather than a transparent one.
        """
        base = self.proxy_url if self.should_proxy else self.base_url
        if path.startswith("/"):
            return f"{base}{path}"
        return path

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        if not self.should_proxy:
            return prepared_request

        timestamp = str(int(time.time()))
        request_body = prepared_request.body
        if not isinstance(request_body, bytes):
            request_body = request_body.encode("utf-8")
        prepared_request.headers = {
            **prepared_request.headers,
            PROXY_OI_HEADER: f"{self.org_integration_id}",
            PROXY_TIMESTAMP_HEADER: timestamp,
            PROXY_SIGNATURE_HEADER: encode_subnet_signature(
                secret=settings.SENTRY_SUBNET_SECRET,
                timestamp=timestamp,
                request_body=request_body,
            ),
        }
        return prepared_request
