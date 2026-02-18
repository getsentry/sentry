from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.reports.models import ScheduledReport
from sentry.reports.schedule import compute_next_run_at
from sentry.reports.serializers import ScheduledReportInputSerializer


class ScheduledReportDetailPermission(OrganizationPermission):
    """
    Relaxed scope_map so that object-level checks can handle
    creator-or-admin authorization for PUT/DELETE.
    """

    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, ScheduledReport):
            if request.method == "GET":
                return True
            # PUT/DELETE: only the creator or org admins
            if request.user.is_authenticated and request.user.id == obj.created_by_id:
                return True
            if request.access.has_scope("org:admin"):
                return True
            return False

        return True


class ScheduledReportDetailBase(OrganizationEndpoint):
    owner = ApiOwner.EXPLORE
    permission_classes = (ScheduledReportDetailPermission,)

    def convert_args(self, request, organization_id_or_slug, report_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["scheduled_report"] = ScheduledReport.objects.get(
                id=report_id,
                organization=kwargs["organization"],
            )
        except ScheduledReport.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)


@region_silo_endpoint
class ScheduledReportDetailEndpoint(ScheduledReportDetailBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(
        self,
        request: Request,
        organization: Organization,
        scheduled_report: ScheduledReport,
    ) -> Response:
        """Retrieve a single scheduled report."""
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        self.check_object_permissions(request, scheduled_report)

        return Response(serialize(scheduled_report, request.user), status=200)

    def put(
        self,
        request: Request,
        organization: Organization,
        scheduled_report: ScheduledReport,
    ) -> Response:
        """Update a scheduled report."""
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        self.check_object_permissions(request, scheduled_report)

        serializer = ScheduledReportInputSerializer(
            data=request.data,
            context={"organization": organization},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        scheduled_report.name = data["name"]
        scheduled_report.source_type = data["source_type_int"]
        scheduled_report.source_id = data["sourceId"]
        scheduled_report.frequency = data["frequency_int"]
        scheduled_report.day_of_week = data.get("dayOfWeek")
        scheduled_report.day_of_month = data.get("dayOfMonth")
        scheduled_report.hour = data["hour"]
        scheduled_report.time_range = data.get("timeRange")
        scheduled_report.recipient_emails = list({e.lower() for e in data["recipientEmails"]})

        # Recompute next_run_at since schedule config may have changed
        scheduled_report.next_run_at = compute_next_run_at(scheduled_report)
        scheduled_report.save()

        return Response(serialize(scheduled_report, request.user), status=200)

    def delete(
        self,
        request: Request,
        organization: Organization,
        scheduled_report: ScheduledReport,
    ) -> Response:
        """Delete a scheduled report."""
        if not features.has("organizations:scheduled-reports", organization, actor=request.user):
            return Response(status=404)

        self.check_object_permissions(request, scheduled_report)

        scheduled_report.delete()

        return Response(status=204)
