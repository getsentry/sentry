from django.conf import settings
from requests import Request

from sentry.integrations.client import ApiClient
from sentry.middleware.integrations.integration_proxy import PROXY_ADDRESS, PROXY_OI_HEADER
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.silo.base import SiloMode

PROXY_ADDRESS = f"{settings.SENTRY_CONTROL_ADDRESS}{PROXY_ADDRESS}"


class IntegrationProxyClient(ApiClient):
    """
    Universal Client to access third-party resources safely in Hybrid Cloud.
    Requests to third parties always exit the Sentry subnet via the Control Silo.
    """

    active = True
    is_direct = True

    proxies = {"http": PROXY_ADDRESS, "https": PROXY_ADDRESS}
    host_url = PROXY_ADDRESS

    def __init__(self, org_integration_id: int) -> None:
        super().__init__()
        self.org_integration_id = org_integration_id
        if SiloMode.get_current_mode() != SiloMode.REGION:
            self.active = False

    def authorize_request(self, request: Request) -> Request:
        raise NotImplementedError(
            "'authorize' method must be implemented to safely proxy requests."
        )

    def build_url(self, path: str) -> str:
        base = self.base_url if not self.active else self.host_url
        if path.startswith("/"):
            return f"{base}{path}"
        return path

    def _proxy_request(self, *args, **kwargs) -> BaseApiResponseX:
        headers = kwargs.get("headers", {})
        headers[PROXY_OI_HEADER] = f"{self.org_integration_id}"
        return (
            super()._request(*args, **{**kwargs, "headers": headers})
            if self.is_direct
            else super()._request(*args, **kwargs, proxies=self.proxies)
        )

    def _request(self, *args, **kwargs) -> BaseApiResponseX:
        return (
            self._proxy_request(*args, **kwargs)
            if self.active
            else super()._request(*args, **kwargs)
        )
