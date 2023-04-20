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
    Requests to third parties must always exit the Sentry subnet via the Control Silo, and only
    add sensitive credentials at that stage.
    """

    should_proxy = False

    def __init__(self, org_integration_id: int) -> None:
        super().__init__()
        self.org_integration_id = org_integration_id
        if SiloMode.get_current_mode() == SiloMode.REGION:
            self.should_proxy = True

    def authorize_request(self, request: Request) -> Request:
        raise NotImplementedError(
            "'authorize' method must be implemented to safely proxy requests."
        )

    def build_url(self, path: str) -> str:
        """
        Overriding build_url here allows us to use a direct proxy, rather than a transparent one.
        """
        base = PROXY_ADDRESS if self.should_proxy else self.base_url
        if path.startswith("/"):
            return f"{base}{path}"
        return path

    def _request(self, *args, **kwargs) -> BaseApiResponseX:
        headers = kwargs.pop("headers", {})
        headers[PROXY_OI_HEADER] = f"{self.org_integration_id}"
        return (
            super()._request(*args, **{**kwargs, "headers": headers})
            if self.should_proxy
            else super()._request(*args, **kwargs)
        )
