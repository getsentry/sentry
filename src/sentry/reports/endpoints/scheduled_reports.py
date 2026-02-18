from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.reports.models import ScheduledReport, ScheduledReportSourceType
from sentry.reports.schedule import compute_next_run_at
from sentry.reports.serializers import MAX_REPORTS_PER_ORG, ScheduledReportInputSerializer


@region_silo_endpoint
class ScheduledReportsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.EXPLORE

    def get(self, request: Request, organization: Organization) -> Response:
        """List all scheduled reports for the organization."""
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        queryset = ScheduledReport.objects.filter(organization=organization)

        source_type = request.query_params.get("sourceType")
        if source_type is not None:
            source_type_id = ScheduledReportSourceType.get_id_for_type_name(source_type)
            if source_type_id is not None:
                queryset = queryset.filter(source_type=source_type_id)

        source_id = request.query_params.get("sourceId")
        if source_id is not None:
            try:
                queryset = queryset.filter(source_id=int(source_id))
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid value for sourceId parameter."},
                    status=400,
                )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """Create a new scheduled report in this organization."""
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        existing_count = ScheduledReport.objects.filter(organization=organization).count()
        if existing_count >= MAX_REPORTS_PER_ORG:
            return Response(
                {"detail": f"Maximum of {MAX_REPORTS_PER_ORG} scheduled reports per organization."},
                status=400,
            )

        serializer = ScheduledReportInputSerializer(
            data=request.data,
            context={"organization": organization, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

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
            next_run_at=None,  # placeholder, computed below
        )

        report.next_run_at = compute_next_run_at(report)
        report.save()

        return Response(serialize(report, request.user), status=201)
