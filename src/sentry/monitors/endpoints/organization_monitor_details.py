from __future__ import annotations

from django.db import router, transaction
from django.db.models import F
from django.db.models.functions import TruncMinute
from django.utils.crypto import get_random_string
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.monitors.endpoints.base import MonitorEndpoint
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
)
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.utils import (
    create_alert_rule,
    get_checkin_margin,
    get_max_runtime,
    update_alert_rule,
)
from sentry.monitors.validators import MonitorValidator
from sentry.utils.outcomes import Outcome


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorDetailsEndpoint(MonitorEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve a Monitor",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            GlobalParams.ENVIRONMENT,
        ],
        responses={
            200: MonitorSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization, project, monitor) -> Response:
        """
        Retrieves details for a monitor.
        """

        environments = get_environments(request, organization)
        expand = request.GET.getlist("expand", [])

        return self.respond(
            serialize(
                monitor, request.user, MonitorSerializer(environments=environments, expand=expand)
            )
        )

    @extend_schema(
        operation_id="Update a Monitor",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
        ],
        request=MonitorValidator,
        responses={
            200: MonitorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization, project, monitor) -> Response:
        """
        Update a monitor.
        """
        # set existing values as validator will overwrite
        existing_config = monitor.config
        existing_margin = existing_config.get("checkin_margin")
        existing_max_runtime = existing_config.get("max_runtime")

        validator = MonitorValidator(
            data=request.data,
            partial=True,
            instance={
                "name": monitor.name,
                "slug": monitor.slug,
                "status": monitor.status,
                "type": monitor.type,
                "config": monitor.config,
                "project": project,
            },
            context={
                "organization": organization,
                "access": request.access,
                "monitor": monitor,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.save()

        params = {}
        if "name" in result:
            params["name"] = result["name"]
        if "slug" in result:
            params["slug"] = result["slug"]
        if "status" in result:
            params["status"] = result["status"]
        if "is_muted" in result:
            params["is_muted"] = result["is_muted"]
        if "config" in result:
            params["config"] = result["config"]

            # update timeouts + expected next check-in, as appropriate
            checkin_margin = result["config"].get("checkin_margin")
            if checkin_margin != existing_margin:
                MonitorEnvironment.objects.filter(monitor_id=monitor.id).update(
                    next_checkin_latest=F("next_checkin") + get_checkin_margin(checkin_margin)
                )

            max_runtime = result["config"].get("max_runtime")
            if max_runtime != existing_max_runtime:
                MonitorCheckIn.objects.filter(
                    monitor_id=monitor.id, status=CheckInStatus.IN_PROGRESS
                ).update(timeout_at=TruncMinute(F("date_added")) + get_max_runtime(max_runtime))

        if "project" in result and result["project"].id != monitor.project_id:
            raise ParameterValidationError("existing monitors may not be moved between projects")

        # Update monitor slug
        if "slug" in result:
            quotas.backend.update_monitor_slug(monitor.slug, params["slug"], monitor.project_id)

        # Attempt to assign a monitor seat
        if params["status"] == ObjectStatus.ACTIVE:
            outcome = quotas.backend.assign_monitor_seat(monitor)
            # The MonitorValidator checks if a seat assignment is availble.
            # This protects against a race condition
            if outcome != Outcome.ACCEPTED:
                raise ParameterValidationError("Failed to enable monitor, please try again")

        # Attempt to unassign the monitor seat
        if params["status"] == ObjectStatus.DISABLED:
            quotas.backend.disable_monitor_seat(monitor)

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=monitor.get_audit_log_data(),
            )

        # Update alert rule after in case slug or name changed
        if "alert_rule" in result:
            # Check to see if rule exists
            alert_rule = monitor.get_alert_rule()
            # If rule exists, update as necessary
            if alert_rule:
                alert_rule_id = update_alert_rule(
                    request, project, monitor, alert_rule, result["alert_rule"]
                )
            # If rule does not exist, create
            else:
                alert_rule_id = create_alert_rule(request, project, monitor, result["alert_rule"])

            if alert_rule_id:
                # If config is not sent, use existing config to update alert_rule_id
                if "config" not in params:
                    params["config"] = monitor.config

                params["config"]["alert_rule_id"] = alert_rule_id
                monitor.update(**params)

        return self.respond(serialize(monitor, request.user))

    @extend_schema(
        operation_id="Delete a Monitor or Monitor Environments",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            GlobalParams.ENVIRONMENT,
        ],
        request=MonitorValidator,
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, project, monitor) -> Response:
        """
        Delete a monitor or monitor environments.
        """
        environment_names = request.query_params.getlist("environment")
        with transaction.atomic(router.db_for_write(MonitorEnvironment)):
            if environment_names:
                monitor_objects = (
                    MonitorEnvironment.objects.filter(
                        environment__name__in=environment_names, monitor__id=monitor.id
                    )
                    .exclude(
                        monitor__status__in=[
                            ObjectStatus.PENDING_DELETION,
                            ObjectStatus.DELETION_IN_PROGRESS,
                        ]
                    )
                    .exclude(
                        status__in=[
                            MonitorStatus.PENDING_DELETION,
                            MonitorStatus.DELETION_IN_PROGRESS,
                        ]
                    )
                )
                event = audit_log.get_event_id("MONITOR_ENVIRONMENT_REMOVE")
            else:
                monitor_objects = Monitor.objects.filter(id=monitor.id).exclude(
                    status__in=[
                        ObjectStatus.PENDING_DELETION,
                        ObjectStatus.DELETION_IN_PROGRESS,
                    ]
                )
                event = audit_log.get_event_id("MONITOR_REMOVE")

                # Mark rule for deletion if present and monitor is being deleted
                monitor = monitor_objects.first()
                alert_rule_id = monitor.config.get("alert_rule_id") if monitor else None
                if alert_rule_id:
                    rule = (
                        Rule.objects.filter(
                            project_id=monitor.project_id,
                            id=alert_rule_id,
                        )
                        .exclude(
                            status__in=[
                                ObjectStatus.PENDING_DELETION,
                                ObjectStatus.DELETION_IN_PROGRESS,
                            ]
                        )
                        .first()
                    )
                    if rule:
                        rule.update(status=ObjectStatus.PENDING_DELETION)
                        RuleActivity.objects.create(
                            rule=rule, user_id=request.user.id, type=RuleActivityType.DELETED.value
                        )
                        scheduled_rule = RegionScheduledDeletion.schedule(
                            rule, days=0, actor=request.user
                        )
                        self.create_audit_entry(
                            request=request,
                            organization=project.organization,
                            target_object=rule.id,
                            event=audit_log.get_event_id("RULE_REMOVE"),
                            data=rule.get_audit_log_data(),
                            transaction_id=scheduled_rule,
                        )

            # create copy of queryset as update will remove objects
            monitor_objects_list = list(monitor_objects)
            if not monitor_objects or not monitor_objects.update(
                status=ObjectStatus.PENDING_DELETION
            ):
                return self.respond(status=404)

            for monitor_object in monitor_objects_list:
                # randomize slug on monitor deletion to prevent re-creation side effects
                if isinstance(monitor_object, Monitor):
                    monitor_object.update(slug=get_random_string(length=24))

                schedule = RegionScheduledDeletion.schedule(
                    monitor_object, days=0, actor=request.user
                )
                self.create_audit_entry(
                    request=request,
                    organization=project.organization,
                    target_object=monitor_object.id,
                    event=event,
                    data=monitor_object.get_audit_log_data(),
                    transaction_id=schedule.guid,
                )

        return self.respond(status=202)
