from __future__ import absolute_import

import six

from django.db.models import Q

from sentry import features
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.validators import MonitorValidator
from sentry.models import AuditLogEntryEvent, Monitor, MonitorStatus, MonitorType
from sentry.search.utils import tokenize_query
from sentry.db.models.query import in_iexact


def map_value_to_constant(constant, value):
    value = value.upper()
    if value == "OK":
        value = "ACTIVE"
    if not hasattr(constant, value):
        raise ValueError(value)
    return getattr(constant, value)


class OrganizationMonitorsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve monitors for an organization
        `````````````````````````````````````

        :pparam string organization_slug: the slug of the organization
        :auth: required
        """
        if not features.has("organizations:monitors", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond([])

        queryset = Monitor.objects.filter(
            organization_id=organization.id, project_id__in=filter_params["project_id"]
        ).exclude(status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS])
        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(id__iexact=value))
                elif key == "id":
                    queryset = queryset.filter(in_iexact("id", value))
                elif key == "name":
                    queryset = queryset.filter(in_iexact("name", value))
                elif key == "status":
                    try:
                        queryset = queryset.filter(
                            status__in=map_value_to_constant(MonitorStatus, value)
                        )
                    except ValueError:
                        queryset = queryset.none()
                elif key == "type":
                    try:
                        queryset = queryset.filter(
                            status__in=map_value_to_constant(MonitorType, value)
                        )
                    except ValueError:
                        queryset = queryset.none()
                else:
                    queryset = queryset.none()

        queryset = queryset.extra(
            select={"is_error": "sentry_monitor.status = %s" % (MonitorStatus.ERROR,)}
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("-is_error", "-name"),
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
        """
        Create a monitor
        ````````````````

        :pparam string organization_slug: the slug of the organization
        :auth: required
        """
        validator = MonitorValidator(
            data=request.data, context={"organization": organization, "access": request.access}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        monitor = Monitor.objects.create(
            project_id=result["project"].id,
            organization_id=organization.id,
            name=result["name"],
            status=result["status"],
            type=result["type"],
            config=result["config"],
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=monitor.id,
            event=AuditLogEntryEvent.MONITOR_ADD,
            data=monitor.get_audit_log_data(),
        )

        return self.respond(serialize(monitor, request.user), status=201)
