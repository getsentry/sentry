from django.db import router, transaction
from django.db.models import (
    Case,
    DateTimeField,
    Exists,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.teams import get_teams
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.db.models.query import in_iexact
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.monitors.models import (
    DEFAULT_STATUS_ORDER,
    MONITOR_ENVIRONMENT_ORDERING,
    Monitor,
    MonitorEnvironment,
    MonitorLimitsExceeded,
    MonitorStatus,
    MonitorType,
)
from sentry.monitors.serializers import (
    MonitorBulkEditResponse,
    MonitorSerializer,
    MonitorSerializerResponse,
)
from sentry.monitors.utils import create_issue_alert_rule, signal_monitor_created
from sentry.monitors.validators import MonitorBulkEditValidator, MonitorValidator
from sentry.search.utils import tokenize_query
from sentry.types.actor import Actor
from sentry.utils.outcomes import Outcome

from .base import OrganizationMonitorPermission


def map_value_to_constant(constant, value):
    value = value.upper()
    if value == "OK":
        value = "ACTIVE"
    if not hasattr(constant, value):
        raise ValueError(value)
    return getattr(constant, value)


def flip_sort_direction(sort_field: str) -> str:
    if sort_field[0] == "-":
        sort_field = sort_field[1:]
    else:
        sort_field = "-" + sort_field
    return sort_field


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        # TODO(davidenwang): After this is merged and good to go, make this public
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationMonitorPermission,)

    @extend_schema(
        operation_id="Retrieve Monitors for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            MonitorParams.OWNER,
        ],
        responses={
            200: inline_sentry_response_serializer("MonitorList", list[MonitorSerializerResponse]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Lists monitors, including nested monitor environments. May be filtered to a project or environment.
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond([])

        queryset = Monitor.objects.filter(
            organization_id=organization.id, project_id__in=filter_params["project_id"]
        ).exclude(
            status__in=[
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ]
        )
        query = request.GET.get("query")
        owners = request.GET.getlist("owner")
        is_asc = request.GET.get("asc", "1") == "1"
        sort = request.GET.get("sort", "status")

        environments = None
        if "environment" in filter_params:
            environments = filter_params["environment_objects"]
            environment_ids = [e.id for e in environments]
            # use a distinct() filter as queries spanning multiple tables can include duplicates
            if request.GET.get("includeNew"):
                queryset = queryset.filter(
                    Q(monitorenvironment__environment_id__in=environment_ids)
                    | Q(monitorenvironment=None)
                ).distinct()
            else:
                queryset = queryset.filter(
                    monitorenvironment__environment_id__in=environment_ids
                ).distinct()
        else:
            environments = list(Environment.objects.filter(organization_id=organization.id))

        # sort monitors by top monitor environment, then by latest check-in
        monitor_environments_query = MonitorEnvironment.objects.filter(
            monitor__id=OuterRef("id"), environment_id__in=[e.id for e in environments]
        )
        sort_fields = []

        if sort == "status":
            queryset = queryset.annotate(
                environment_status_ordering=Case(
                    # Sort DISABLED and is_muted monitors to the bottom of the list
                    When(status=ObjectStatus.DISABLED, then=Value(len(DEFAULT_STATUS_ORDER) + 1)),
                    When(is_muted=True, then=Value(len(DEFAULT_STATUS_ORDER))),
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
            sort_fields = ["environment_status_ordering", "-last_checkin_monitorenvironment"]
        elif sort == "name":
            sort_fields = ["name"]
        elif sort == "muted":
            queryset = queryset.annotate(
                muted_ordering=Case(
                    When(is_muted=True, then=Value(2)),
                    When(Exists(monitor_environments_query.filter(is_muted=True)), then=Value(1)),
                    default=0,
                ),
            )
            sort_fields = ["muted_ordering", "name"]

        if not is_asc:
            sort_fields = [flip_sort_direction(sort_field) for sort_field in sort_fields]

        if owners:
            owners = set(owners)

            # Remove special values from owners, this can't be parsed as an Actor
            include_myteams = "myteams" in owners
            owners.discard("myteams")
            include_unassigned = "unassigned" in owners
            owners.discard("unassigned")

            actors = [Actor.from_identifier(identifier) for identifier in owners]

            user_ids = [actor.id for actor in actors if actor.is_user]
            team_ids = [actor.id for actor in actors if actor.is_team]

            teams = get_teams(
                request,
                organization,
                teams=[*team_ids, *(["myteams"] if include_myteams else [])],
            )
            team_ids = [team.id for team in teams]

            owner_filter = Q(owner_user_id__in=user_ids) | Q(owner_team_id__in=team_ids)

            if include_unassigned:
                unassigned_filter = Q(owner_user_id=None) & Q(owner_team_id=None)
                queryset = queryset.filter(unassigned_filter | owner_filter)
            else:
                queryset = queryset.filter(owner_filter)

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
                            monitorenvironment__status__in=map_value_to_constant(
                                MonitorStatus, value
                            )
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
            order_by=sort_fields,
            on_results=lambda x: serialize(
                x, request.user, MonitorSerializer(environments=environments)
            ),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Create a Monitor",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=MonitorValidator,
        responses={
            201: MonitorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
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

        owner = result.get("owner")
        owner_user_id = None
        owner_team_id = None
        if owner and owner.is_user:
            owner_user_id = owner.id
        elif owner and owner.is_team:
            owner_team_id = owner.id

        try:
            monitor = Monitor.objects.create(
                project_id=result["project"].id,
                organization_id=organization.id,
                owner_user_id=owner_user_id,
                owner_team_id=owner_team_id,
                name=result["name"],
                slug=result.get("slug"),
                status=result["status"],
                type=result["type"],
                config=result["config"],
            )
        except MonitorLimitsExceeded as e:
            return self.respond({type(e).__name__: str(e)}, status=403)

        # Attempt to assign a seat for this monitor
        seat_outcome = quotas.backend.assign_monitor_seat(monitor)
        if seat_outcome != Outcome.ACCEPTED:
            monitor.update(status=ObjectStatus.DISABLED)

        project = result["project"]
        signal_monitor_created(project, request.user, False, monitor, request)

        validated_issue_alert_rule = result.get("alert_rule")
        if validated_issue_alert_rule:
            issue_alert_rule_id = create_issue_alert_rule(
                request, project, monitor, validated_issue_alert_rule
            )

            if issue_alert_rule_id:
                config = monitor.config
                config["alert_rule_id"] = issue_alert_rule_id
                monitor.update(config=config)

        return self.respond(serialize(monitor, request.user), status=201)

    @extend_schema(
        operation_id="Bulk Edit Monitors",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=MonitorBulkEditValidator,
        responses={
            200: inline_sentry_response_serializer(
                "MonitorBulkEditResponse", MonitorBulkEditResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization) -> Response:
        """
        Bulk edit the muted and disabled status of a list of monitors determined by slug
        """
        validator = MonitorBulkEditValidator(
            data=request.data,
            partial=True,
            context={
                "organization": organization,
                "access": request.access,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = dict(validator.validated_data)

        projects = self.get_projects(request, organization, include_all_accessible=True)
        project_ids = [project.id for project in projects]

        monitor_guids = result.pop("ids", [])
        monitors = Monitor.objects.filter(guid__in=monitor_guids, project_id__in=project_ids)

        status = result.get("status")
        # If enabling monitors, ensure we can assign all before moving forward
        if status == ObjectStatus.ACTIVE:
            assign_result = quotas.backend.check_assign_monitor_seats(monitors)
            if not assign_result.assignable:
                return self.respond(assign_result.reason, status=400)

        updated = []
        errored = []
        for monitor in monitors:
            with transaction.atomic(router.db_for_write(Monitor)):
                # Attempt to assign a monitor seat
                if status == ObjectStatus.ACTIVE:
                    outcome = quotas.backend.assign_monitor_seat(monitor)
                    if outcome != Outcome.ACCEPTED:
                        errored.append(monitor)
                        continue

                # Attempt to unassign the monitor seat
                if status == ObjectStatus.DISABLED:
                    quotas.backend.disable_monitor_seat(monitor)

                monitor.update(**result)
                updated.append(monitor)
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=monitor.get_audit_log_data(),
            )

        return self.respond(
            {
                "updated": serialize(list(updated), request.user),
                "errored": serialize(list(errored), request.user),
            },
        )
