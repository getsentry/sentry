from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models import Rule, RuleActivity, RuleActivityType, RuleStatus, ScheduledDeletion
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorStatus
from sentry.monitors.serializers import MonitorSerializer, MonitorSerializerResponse
from sentry.monitors.validators import MonitorValidator

from .base import MonitorEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorDetailsEndpoint(MonitorEndpoint):
    public = {"GET", "PUT", "DELETE"}

    @extend_schema(
        operation_id="Retrieve a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_SLUG,
            GLOBAL_PARAMS.ENVIRONMENT,
        ],
        responses={
            200: inline_sentry_response_serializer("Monitor", MonitorSerializerResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, organization, project, monitor) -> Response:
        """
        Retrieves details for a monitor.
        """

        environments = get_environments(request, organization)

        return self.respond(
            serialize(monitor, request.user, MonitorSerializer(environments=environments))
        )

    @extend_schema(
        operation_id="Update a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_SLUG,
        ],
        request=MonitorValidator,
        responses={
            200: inline_sentry_response_serializer("Monitor", MonitorSerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def put(self, request: Request, organization, project, monitor) -> Response:
        """
        Update a monitor.
        """
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
            context={"organization": organization, "access": request.access},
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
        if "config" in result:
            params["config"] = result["config"]
        if "project" in result and result["project"].id != monitor.project_id:
            raise ParameterValidationError("existing monitors may not be moved between projects")

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=monitor.get_audit_log_data(),
            )

        return self.respond(serialize(monitor, request.user))

    @extend_schema(
        operation_id="Delete a monitor or monitor environments",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_SLUG,
            GLOBAL_PARAMS.ENVIRONMENT,
        ],
        request=MonitorValidator,
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def delete(self, request: Request, organization, project, monitor) -> Response:
        """
        Delete a monitor or monitor environments.
        """
        environment_names = request.query_params.getlist("environment")
        with transaction.atomic():
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
                # TODO(rjo100): Make this more resilient to out of band modifications/deletions
                alert_rule_id = monitor_objects.first().config.get("alert_rule_id")
                if alert_rule_id:
                    rule = Rule.objects.filter(
                        project_id=monitor.project_id, id=alert_rule_id
                    ).first()
                    rule.update(status=RuleStatus.PENDING_DELETION)
                    RuleActivity.objects.create(
                        rule=rule, user_id=request.user.id, type=RuleActivityType.DELETED.value
                    )

            # create copy of queryset as update will remove objects
            monitor_objects_list = list(monitor_objects)
            if not monitor_objects or not monitor_objects.update(
                status=ObjectStatus.PENDING_DELETION
            ):
                return self.respond(status=404)

            for monitor_object in monitor_objects_list:
                schedule = ScheduledDeletion.schedule(monitor_object, days=0, actor=request.user)
                self.create_audit_entry(
                    request=request,
                    organization=project.organization,
                    target_object=monitor_object.id,
                    event=event,
                    data=monitor_object.get_audit_log_data(),
                    transaction_id=schedule.guid,
                )

        return self.respond(status=202)
