from datetime import timedelta
from enum import StrEnum

from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.net.http import connection_from_url
from sentry.seer.anomaly_detection.types import StoreDataRequest, TimeSeriesPoint
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request
from sentry.utils import json

seer_anomaly_detection_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_ANOMALY_DETECTION_TIMEOUT,
)
MIN_DAYS = 7


def make_store_data_request(
    body: StoreDataRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or seer_anomaly_detection_connection_pool,
        SEER_ANOMALY_DETECTION_STORE_DATA_URL,
        body=json.dumps(body).encode("utf-8"),
        viewer_context=viewer_context,
    )


class SeerMethod(StrEnum):
    CREATE = "create"
    UPDATE = "update"


def get_start_index(data: list[TimeSeriesPoint]) -> int:
    """
    Helper to return the first data points that has an event count. We can assume that all
    subsequent data points without associated event counts have event counts of zero.
    Used to determine whether we have at least a week's worth of data.
    """
    for i, datum in enumerate(data):
        if datum.get("value", 0) != 0:
            return i
    return -1


def trim_leading_zeros(data: list[TimeSeriesPoint]) -> list[TimeSeriesPoint]:
    """
    Drop the leading run of zero-valued points. Zeros before the first real data point mean the
    data source wasn't instrumented yet, not that traffic was zero, and training on them badly
    inflates Seer's confidence bounds. Only trim if at least MIN_DAYS of real data remain, since
    that's Seer's minimum history requirement.
    """
    start_index = get_start_index(data)
    if start_index <= 0:
        return data

    trimmed = data[start_index:]
    if (
        trimmed[-1]["timestamp"] - trimmed[0]["timestamp"]
        < timedelta(days=MIN_DAYS).total_seconds()
    ):
        return data
    return trimmed
