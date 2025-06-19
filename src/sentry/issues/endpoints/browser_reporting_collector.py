from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Literal

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint, allow_cors_options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Known browser report types as defined by the Browser Reporting API specification
BrowserReportType = Literal[
    # Core report types (always sent to 'default' endpoint)
    "deprecation",  # Deprecated API usage
    "intervention",  # Browser interventions/blocks
    "crash",  # Browser crashes
    # Policy violation report types (can be sent to named endpoints)
    "csp-violation",  # Content Security Policy violations
    "coep",  # Cross-Origin-Embedder-Policy violations
    "coop",  # Cross-Origin-Opener-Policy violations
    "document-policy-violation",  # Document Policy violations
    "permissions-policy",  # Permissions Policy violations
]


@dataclass
class BrowserReport:
    body: dict[str, Any]
    type: BrowserReportType
    url: str
    user_agent: str
    destination: str
    timestamp: int
    attempts: int


class BrowserReportsJSONParser(JSONParser):
    """
    Custom parser for browser Reporting API that handles the application/reports+json content type.
    This extends JSONParser since the content is still JSON, just with a different media type.
    """

    media_type = "application/reports+json"


@all_silo_endpoint
class BrowserReportingCollectorEndpoint(Endpoint):
    """
    An experimental endpoint which is a proxy for browser Reporting API reports. For now just
    records metrics and forwards data to GCP, so we can collect real-world data on what gets sent,
    how much gets sent, etc.
    """

    permission_classes = ()
    # Support both standard JSON and browser reporting API content types
    parser_classes = [BrowserReportsJSONParser, JSONParser]
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    # CSRF exemption and CORS support required for Browser Reporting API
    @csrf_exempt
    @allow_cors_options
    def post(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        if not options.get("issues.browser_reporting.collector_endpoint_enabled"):
            return HttpResponse(status=404)

        logger.info("browser_report_received", extra={"request_body": request.data})

        # Browser Reporting API sends an array of reports
        # request.data could be any type, so we need to validate and cast
        raw_data: Any = request.data

        if not isinstance(raw_data, list):
            logger.warning(
                "browser_report_invalid_format",
                extra={"data_type": type(raw_data).__name__, "data": raw_data},
            )
            return HttpResponse(status=422)

        for report in raw_data:
            browser_report = BrowserReport(**report)
            metrics.incr(
                "browser_reporting.raw_report_received",
                tags={"browser_report_type": browser_report.type},
                sample_rate=1.0,  # XXX: Remove this once we have a ballpark figure
            )

        return HttpResponse(status=200)
