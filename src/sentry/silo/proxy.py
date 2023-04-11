from django.conf import settings

from sentry.integrations.client import ApiClient
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.silo.base import SiloMode

PROXY_ADDRESS = "https://proxy-leeandher.ngrok.io"


class IntegrationProxyClient(ApiClient):
    """
    Universal Client to access third-party resources safely in Hybrid Cloud.
    Requests to third parties always exit the Sentry subnet via the Control Silo.
    """

    active = True

    proxies = {"http": PROXY_ADDRESS, "https": PROXY_ADDRESS}

    def __init__(self) -> None:
        super().__init__()
        if SiloMode.get_current_mode() != SiloMode.REGION:
            self.active = False

    def _request(self, *args, **kwargs) -> BaseApiResponseX:
        return (
            super()._request(*args, **kwargs, proxies=self.proxies)
            if self.active
            else super()._request(*args, **kwargs)
        )
