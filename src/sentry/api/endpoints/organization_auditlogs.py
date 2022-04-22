from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationAuditPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.db.models.fields.bounded import BoundedIntegerField
from sentry.models import AuditLogEntry


class AuditLogQueryParamSerializer(serializers.Serializer):

    event = serializers.CharField(required=False)
    actor = serializers.IntegerField(required=False, max_value=BoundedIntegerField.MAX_VALUE)

    def validate_event(self, event):
        audit_log_api_name_lookup = audit_log.get_api_names()
        audit_log_event = audit_log_api_name_lookup[event]
        if not audit_log_event:
            raise serializers.ValidationError("Invalid audit log event")
        return audit_log_api_name_lookup[event]


class OrganizationAuditLogsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuditPermission,)

    def get(self, request: Request, organization) -> Response:
        queryset = AuditLogEntry.objects.filter(organization=organization).select_related("actor")

        serializer = AuditLogQueryParamSerializer(data=request.GET)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        query = serializer.validated_data

        if "actor" in query:
            queryset = queryset.filter(actor=query["actor"])

        if "event" in query:
            queryset = queryset.filter(event=query["event"])

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda x: serialize(x, request.user),
        )
