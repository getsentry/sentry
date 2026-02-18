from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.reports.email import send_report_email
from sentry.reports.generate import generate_csv_for_explore_query
from sentry.reports.models import (
    ScheduledReport,
    ScheduledReportSourceType,
)
from sentry.reports.serializers import ScheduledReportInputSerializer
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ScheduledReportTestEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.EXPLORE

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=5, window=3600),
            },
        },
    )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Generate and send a test report without persisting a ScheduledReport.
        Validates the payload identically to the create endpoint.
        """
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        serializer = ScheduledReportInputSerializer(
            data=request.data,
            context={"organization": organization, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        # Build a transient (unsaved) ScheduledReport for the generator
        report = ScheduledReport(
            organization=organization,
            created_by_id=request.user.id if request.user.is_authenticated else None,
            name=data["name"],
            source_type=data["source_type_int"],
            source_id=data["sourceId"],
            frequency=data["frequency_int"],
            day_of_week=data.get("dayOfWeek"),
            day_of_month=data.get("dayOfMonth"),
            hour=data["hour"],
            time_range=data.get("timeRange"),
            recipient_emails=list({e.lower() for e in data["recipientEmails"]}),
        )

        source_type = data["source_type_int"]

        try:
            if source_type == ScheduledReportSourceType.EXPLORE_SAVED_QUERY:
                filename, file_bytes, empty_result = generate_csv_for_explore_query(
                    report, organization
                )
                mimetype = "text/csv"
            elif source_type == ScheduledReportSourceType.DASHBOARD:
                return Response(
                    {"detail": "Scheduled reports for dashboards are not yet supported."},
                    status=400,
                )
            else:
                return Response(
                    {"detail": "Unknown source type."},
                    status=400,
                )
        except Exception:
            logger.exception(
                "scheduled_report.test_send_generation_failed",
                extra={
                    "source_type": source_type,
                    "source_id": data["sourceId"],
                    "user_id": request.user.id,
                },
            )
            return Response(
                {"detail": "Failed to generate the report. Please try again."},
                status=500,
            )

        send_report_email(
            report,
            filename,
            file_bytes,
            mimetype,
            organization,
            empty_result=empty_result,
        )

        return Response({"detail": "Test email sent."}, status=200)
