from __future__ import annotations

import logging
from typing import Any

from django.core.validators import URLValidator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers
from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint, allow_cors_options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

BROWSER_REPORT_TYPES = [
    "deprecation",
    "intervention",
    "crash",
    "csp-violation",
    "coep",
    "coop",
    "document-policy-violation",
    "permissions-policy-violation",
]


class LongURLValidator(URLValidator):
    """URLValidator with a higher max_length for browser reporting URLs."""

    max_length = 4096  # 4KB should be sufficient for most browser reporting URLs


class LongURLField(serializers.URLField):
    """
    A URLField that allows longer URLs than Django's default 2048 character limit.
    This is needed for browser reporting where URLs can be very long due to many query parameters.
    """

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        # Replace the default URLValidator with our custom one
        self.validators = [
            LongURLValidator() if isinstance(v, URLValidator) else v for v in self.validators
        ]


# Working Draft https://www.w3.org/TR/reporting-1/#concept-reports
# Editor's Draft https://w3c.github.io/reporting/#concept-reports
# We need to support both
class BrowserReportSerializer(serializers.Serializer[Any]):
    """Serializer for validating browser report data structure."""

    body = serializers.DictField()
    type = serializers.ChoiceField(choices=BROWSER_REPORT_TYPES)
    url = LongURLField()
    user_agent = serializers.CharField()
    destination = serializers.CharField(required=False)
    attempts = serializers.IntegerField(required=False, min_value=1)
    # Fields that do not overlap between specs
    # We need to support both specs
    age = serializers.IntegerField(required=False)
    timestamp = serializers.IntegerField(required=False, min_value=0)

    def validate_timestamp(self, value: int) -> int:
        """Validate that age is absent, but timestamp is present."""
        if self.initial_data.get("age"):
            raise serializers.ValidationError("If timestamp is present, age must be absent")
        return value

    def validate_age(self, value: int) -> int:
        """Validate that age is present, but not timestamp."""
        if self.initial_data.get("timestamp"):
            raise serializers.ValidationError("If age is present, timestamp must be absent")
        return value


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
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.ISSUES

    # CSRF exemption and CORS support required for Browser Reporting API
    @csrf_exempt
    @allow_cors_options
    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        if not options.get("issues.browser_reporting.collector_endpoint_enabled"):
            return Response(status=HTTP_404_NOT_FOUND)

        logger.info("browser_report_received", extra={"request_body": request.data})

        # Browser Reporting API sends an array of reports
        # request.data could be any type, so we need to validate and cast
        raw_data: Any = request.data

        if not isinstance(raw_data, list):
            logger.warning(
                "browser_report_invalid_format",
                extra={"data_type": type(raw_data).__name__, "data": raw_data},
            )
            return Response(status=HTTP_422_UNPROCESSABLE_ENTITY)

        # Validate each report in the array
        validated_reports = []
        for report in raw_data:
            serializer = BrowserReportSerializer(data=report)
            if not serializer.is_valid():
                logger.warning(
                    "browser_report_validation_failed",
                    extra={"validation_errors": serializer.errors, "raw_report": report},
                )
                return Response(
                    {"error": "Invalid report data", "details": serializer.errors},
                    status=HTTP_422_UNPROCESSABLE_ENTITY,
                )

            validated_reports.append(serializer.validated_data)

        # Process all validated reports
        for browser_report in validated_reports:
            metrics.incr(
                "browser_reporting.raw_report_received",
                tags={"browser_report_type": str(browser_report["type"])},
                sample_rate=1.0,  # XXX: Remove this once we have a ballpark figure
            )

        return Response(status=HTTP_200_OK)
