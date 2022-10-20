from __future__ import annotations

from abc import ABC, abstractmethod

from django.conf import settings
from requests import Response

from sentry.http import build_session
from sentry.silo.base import SiloMode
from sentry.types.region import get_region_by_name
from sentry.utils import json

"""
Dev Notes:

Set SENTRY_USE_RELAY = false
Set SENTRY_CONTROL_ADDRESS
Set SENTRY_REGION_CONFIG

In Terminal:

control: SENTRY_SILO_MODE=CONTROL sentry devserver"
region:  SENTRY_DEVSERVER_BIND=localhost:8002 SENTRY_SILO_MODE=REGION SENTRY_REGION=region sentry devserver"
"""

DEFAULT_API_VERSION = "0"


class BaseSiloClient(ABC):
    @property
    @abstractmethod
    def access_mode():
        raise NotImplementedError

    @property
    def prefix(self):
        return f"/api/{self.version}"

    def __init__(self, version: str = DEFAULT_API_VERSION):
        if SiloMode.get_current_mode() != self.access_mode:
            raise Exception("No Access")
        self.version = version

    def _build_url(self, path: str) -> str:
        return f"{self.destination_url}{self.prefix}{path}"


class SiloResponse:
    def __init__(self, response: Response) -> None:
        self.headers = response.headers
        self.status_code = response.status_code
        self.data = json.loads(response.text)


class RegionSiloClient(BaseSiloClient):
    access_mode = SiloMode.CONTROL

    def __init__(self, region_name, **kwargs):
        super().__init__(**kwargs)
        self.region = get_region_by_name(region_name)
        self.destination_url = self.region.address

    def req(self, path):
        url = self._build_url(path)
        with build_session() as session:
            response = session.get(url)
            return SiloResponse(response=response)


class ControlSiloClient(BaseSiloClient):
    access_mode = SiloMode.REGION

    def __init__(self, region_name, **kwargs):
        super().__init__(**kwargs)
        self.destination_url = settings.SENTRY_CONTROL_ADDRESS
