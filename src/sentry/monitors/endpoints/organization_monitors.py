from django.db.models import Case, IntegerField, Q, Value, When

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.db.models.query import in_iexact
from sentry.models import Organization, Project
from sentry.monitors.models import Monitor, MonitorStatus, MonitorType
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.validators import MonitorValidator
from sentry.search.utils import tokenize_query
from sentry.signals import first_cron_monitor_created

from .base import OrganizationMonitorPermission


def map_value_to_constant(constant, value):
    value = value.upper()
    if value == "OK":
        value = "ACTIVE"
    if not hasattr(constant, value):
        raise ValueError(value)
    return getattr(constant, value)


from rest_framework.request import Request
from rest_framework.response import Response

DEFAULT_ORDERING = [
    MonitorStatus.ERROR,
    MonitorStatus.MISSED_CHECKIN,
    MonitorStatus.OK,
    MonitorStatus.ACTIVE,
    MonitorStatus.DISABLED,
]

DEFAULT_ORDERING_CASE = Case(
    *[When(status=s, then=Value(i)) for i, s in enumerate(DEFAULT_ORDERING)],
    output_field=IntegerField(),
)


@region_silo_endpoint
class OrganizationMonitorsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationMonitorPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve monitors for an organization
        `````````````````````````````````````

        :pparam string organization_slug: the slug of the organization
        :auth: required
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond([])

        queryset = (
            Monitor.objects.filter(
                organization_id=organization.id, project_id__in=filter_params["project_id"]
            )
            .annotate(status_order=DEFAULT_ORDERING_CASE)
            .exclude(
                status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
            )
        )
        query = request.GET.get("query")

        environments = None
        if "environment" in filter_params:
            environments = filter_params["environment_objects"]
            queryset = queryset.filter(monitorenvironment__environment__in=environments)

        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
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
                            type__in=map_value_to_constant(MonitorType, value)
                        )
                    except ValueError:
                        queryset = queryset.none()
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("status_order", "-last_checkin"),
            on_results=lambda x: serialize(
                x, request.user, MonitorSerializer(environments=environments)
            ),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
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
            slug=result.get("slug"),
            status=result["status"],
            type=result["type"],
            config=result["config"],
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=monitor.id,
            event=audit_log.get_event_id("MONITOR_ADD"),
            data=monitor.get_audit_log_data(),
        )

        project = result["project"]
        if not project.flags.has_cron_monitors:
            first_cron_monitor_created.send_robust(
                project=project, user=request.user, sender=Project
            )

        return self.respond(serialize(monitor, request.user), status=201)
