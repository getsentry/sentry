from __future__ import annotations

from typing import Any, Iterable, Mapping

from django.conf import settings

from sentry.shared_integrations.client.base import BaseApiClient, BaseApiResponseX
from sentry.silo.base import SiloMode
from sentry.types.region import Region, get_region_by_id

INVALID_PROXY_HEADERS = ["Host", "Content-Type", "Content-Length"]


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

    def request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, Any] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
    ) -> BaseApiResponseX:
        # TODO: Establish a scheme to authorize requests across silos
        # (e.g. signing secrets, JWTs)
        modified_headers = {**headers}
        for invalid_header in INVALID_PROXY_HEADERS:
            modified_headers.pop(invalid_header)
        client_response = super()._request(
            method,
            path,
            headers=modified_headers,
            data=data,
            params=params,
            json=True,
            allow_text=True,
        )
        # TODO: Establish a scheme to check/log the Sentry Version of the requestor and server
        # optionally raising an error to alert developers of version drift
        return client_response.to_http_response()


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
        self.region = get_region_by_id(region.id)
        self.base_url = self.region.address


class ControlSiloClient(BaseSiloClient):
    access_modes = [SiloMode.REGION]

    metrics_prefix = "silo_client.control"
    log_path = "sentry.silo.client.control"
    silo_client_name = "control"

    def __init__(self) -> None:
        super().__init__()
        self.base_url = settings.SENTRY_CONTROL_ADDRESS
