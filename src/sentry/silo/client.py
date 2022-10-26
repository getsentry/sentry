from __future__ import annotations

from typing import List

from django.conf import settings

from sentry.shared_integrations.client.base import BaseApiClient
from sentry.silo.base import SiloMode
from sentry.types.region import get_region_by_name

DEFAULT_API_VERSION = "0"


class SiloClientError(Exception):
    """Indicates an error in processing a cross-silo HTTP request"""


class BaseSiloClient(BaseApiClient):
    integration_type = "silo_client"

    @property
    def access_modes() -> List[SiloMode]:
        """
        Limit access to the client to only the SiloModes set here.
        """
        raise NotImplementedError

    def create_base_url(self, address: str) -> str:
        # We're intentionally not exposing API Versioning as an interface just yet
        # This may be revisited once more of deployment drift in Hybrid Cloud is pinned down.
        api_prefix = "/api/0"
        return f"{address}{api_prefix}"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if SiloMode.get_current_mode() not in self.access_modes:
            access_mode_str = ", ".join(str(m) for m in self.access_modes)
            raise SiloClientError(
                f"Cannot invoke {self.__class__.__name__} from {SiloMode.get_current_mode()}. "
                f"Only available in: {access_mode_str}"
            )


class RegionSiloClient(BaseSiloClient):
    access_modes = [SiloMode.CONTROL]

    datadog_prefix = "silo_client.region"
    log_path = "sentry.silo.client.region"
    silo_client_name = "region"

    def __init__(self, region_name, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.region = get_region_by_name(region_name)
        self.base_url = self.create_base_url(self.region.address)


class ControlSiloClient(BaseSiloClient):
    access_modes = [SiloMode.REGION]

    datadog_prefix = "silo_client.control"
    log_path = "sentry.silo.client.control"
    silo_client_name = "control"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.base_url = self.create_base_url(settings.SENTRY_CONTROL_ADDRESS)
