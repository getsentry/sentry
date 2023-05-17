from typing import List

from django.db.models import Case, DateTimeField, IntegerField, OuterRef, Q, Subquery, Value, When
from drf_spectacular.utils import extend_schema

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.db.models.query import in_iexact
from sentry.mediators import project_rules
from sentry.models import Environment, Organization, RuleActivity, RuleActivityType, RuleSource
from sentry.monitors.models import (
    Monitor,
    MonitorEnvironment,
    MonitorLimitsExceeded,
    MonitorStatus,
    MonitorType,
)
from sentry.monitors.serializers import MonitorSerializer, MonitorSerializerResponse
from sentry.monitors.utils import get_alert_rule, signal_first_monitor_created
from sentry.monitors.validators import MonitorValidator
from sentry.search.utils import tokenize_query

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
    MonitorStatus.TIMEOUT,
    MonitorStatus.MISSED_CHECKIN,
    MonitorStatus.OK,
    MonitorStatus.ACTIVE,
    MonitorStatus.DISABLED,
]

MONITOR_ENVIRONMENT_ORDERING = Case(
    *[When(status=s, then=Value(i)) for i, s in enumerate(DEFAULT_ORDERING)],
    output_field=IntegerField(),
)


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorsEndpoint(OrganizationEndpoint):
    public = {"GET", "POST"}
    permission_classes = (OrganizationMonitorPermission,)

    @extend_schema(
        operation_id="Retrieve monitors for an organization",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            GLOBAL_PARAMS.PROJECT,
            GLOBAL_PARAMS.ENVIRONMENT,
        ],
        responses={
            200: inline_sentry_response_serializer("MonitorList", List[MonitorSerializerResponse]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Lists monitors, including nested monitor enviroments. May be filtered to a project or environment.
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond([])

        queryset = Monitor.objects.filter(
            organization_id=organization.id, project_id__in=filter_params["project_id"]
        ).exclude(status__in=[ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS])
        query = request.GET.get("query")

        environments = None
        if "environment" in filter_params:
            environments = filter_params["environment_objects"]
            if request.GET.get("includeNew"):
                queryset = queryset.filter(
                    Q(monitorenvironment__environment__in=environments) | Q(monitorenvironment=None)
                )
            else:
                queryset = queryset.filter(monitorenvironment__environment__in=environments)
        else:
            environments = list(Environment.objects.filter(organization_id=organization.id))

        # sort monitors by top monitor environment, then by latest check-in
        monitor_environments_query = MonitorEnvironment.objects.filter(
            monitor__id=OuterRef("id"), environment__in=environments
        )

        queryset = queryset.annotate(
            environment_status_ordering=Case(
                When(status=MonitorStatus.DISABLED, then=Value(len(DEFAULT_ORDERING))),
                default=Subquery(
                    monitor_environments_query.annotate(
                        status_ordering=MONITOR_ENVIRONMENT_ORDERING
                    )
                    .order_by("status_ordering")
                    .values("status_ordering")[:1],
                    output_field=IntegerField(),
                ),
            )
        )

        queryset = queryset.annotate(
            last_checkin_monitorenvironment=Subquery(
                monitor_environments_query.order_by("-last_checkin").values("last_checkin")[:1],
                output_field=DateTimeField(),
            )
        )

        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value) | Q(id__iexact=value) | Q(slug__icontains=value)
                    )
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
            order_by=("environment_status_ordering", "-last_checkin_monitorenvironment"),
            on_results=lambda x: serialize(
                x, request.user, MonitorSerializer(environments=environments)
            ),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Create a monitor",
        parameters=[GLOBAL_PARAMS.ORG_SLUG],
        request=MonitorValidator,
        responses={
            201: inline_sentry_response_serializer("Monitor", MonitorSerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new monitor.
        """
        validator = MonitorValidator(
            data=request.data, context={"organization": organization, "access": request.access}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        try:
            monitor = Monitor.objects.create(
                project_id=result["project"].id,
                organization_id=organization.id,
                name=result["name"],
                slug=result.get("slug"),
                status=result["status"],
                type=result["type"],
                config=result["config"],
            )
        except MonitorLimitsExceeded as e:
            return self.respond({type(e).__name__: str(e)}, status=403)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=monitor.id,
            event=audit_log.get_event_id("MONITOR_ADD"),
            data=monitor.get_audit_log_data(),
        )

        project = result["project"]
        signal_first_monitor_created(project, request.user, False)

        validated_alert_rule = result.get("alert_rule")
        if validated_alert_rule:
            alert_rule_data = get_alert_rule(project, request.user, monitor, validated_alert_rule)
            serializer = RuleSerializer(
                context={"project": project, "organization": project.organization},
                data=alert_rule_data,
            )

            if serializer.is_valid():
                data = serializer.validated_data
                # combine filters and conditions into one conditions criteria for the rule object
                conditions = data.get("conditions", [])
                if "filters" in data:
                    conditions.extend(data["filters"])

                kwargs = {
                    "name": data["name"],
                    "environment": data.get("environment"),
                    "project": project,
                    "action_match": data["actionMatch"],
                    "filter_match": data.get("filterMatch"),
                    "conditions": conditions,
                    "actions": data.get("actions", []),
                    "frequency": data.get("frequency"),
                    "user_id": request.user.id,
                }

                rule = project_rules.Creator.run(request=request, **kwargs)
                rule.update(source=RuleSource.CRON_MONITOR)
                RuleActivity.objects.create(
                    rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
                )

                config = monitor.config
                config["alert_rule_id"] = rule.id
                monitor.update(config=config)

        return self.respond(serialize(monitor, request.user), status=201)
