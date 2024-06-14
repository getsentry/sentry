import logging
from urllib.parse import urljoin

from requests import RequestException

from sentry.lang.native.symbolicator import SymbolicatorPlatform
from sentry.net.http import Session

from . import base

logger = logging.getLogger(__name__)

# The timeout for rpc calls, in seconds.
# We expect these to be very quick, and never want to block more than 2 ms (4 with connect + read).
RPC_TIMEOUT = 2 / 1000  # timeout in seconds


class PbRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, target: str):
        self.target = target
        self.session = Session()

    def record_project_duration(
        self, platform: SymbolicatorPlatform, project_id: int, duration: float
    ) -> None:
        url = urljoin(self.target, "/record_spending")
        request = {
            "config_name": f"symbolication-{platform.value}",
            "project_id": project_id,
            "spent": duration,
        }
        try:
            self.session.post(
                url,
                timeout=RPC_TIMEOUT,
                json=request,
            )
        except RequestException:
            pass

    def is_lpq_project(self, platform: SymbolicatorPlatform, project_id: int) -> bool:
        url = urljoin(self.target, "/exceeds_budget")
        request = {
            "config_name": f"symbolication-{platform.value}",
            "project_id": project_id,
        }
        try:
            response = self.session.post(
                url,
                timeout=RPC_TIMEOUT,
                json=request,
            )
            return response.json()["exceeds_budget"]
        except RequestException:
            return False

    # NOTE: The functions below are just default impls copy-pasted from `DummyRealtimeMetricsStore`.
    # They are not used in the actual implementation of recording budget spend,
    # and checking if a project is within its budget.

    def validate(self) -> None:
        pass
