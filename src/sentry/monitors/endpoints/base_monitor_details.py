from __future__ import annotations

from django.db import router, transaction
from django.db.models import F, QuerySet
from django.db.models.functions import TruncMinute
from django.utils.crypto import get_random_string
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, quotas
from sentry.api.base import BaseEndpointMixin
from sentry.api.exceptions import ParameterValidationError
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
)
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.utils import (
    create_issue_alert_rule,
    get_checkin_margin,
    get_max_runtime,
    update_issue_alert_rule,
)
from sentry.monitors.validators import MonitorValidator
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.outcomes import Outcome


class MonitorDetailsMixin(BaseEndpointMixin):
    def get_monitor(self, request: Request, project: Project, monitor: Monitor) -> Response:
        """
        Retrieves details for a monitor.
        """

        environments = get_environments(request, project.organization)
        expand = request.GET.getlist("expand", [])

        return self.respond(
            serialize(
                monitor, request.user, MonitorSerializer(environments=environments, expand=expand)
            )
        )

    def update_monitor(
        self, request: AuthenticatedHttpRequest, project: Project, monitor: Monitor
    ) -> Response:
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
                "organization": project.organization,
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
        if "owner" in result:
            owner = result["owner"]
            params["owner_user_id"] = None
            params["owner_team_id"] = None
            if owner and owner.is_user:
                params["owner_user_id"] = owner.id
            elif owner and owner.is_team:
                params["owner_team_id"] = owner.id
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

        # Attempt to assign a monitor seat
        if params["status"] == ObjectStatus.ACTIVE and monitor.status != ObjectStatus.ACTIVE:
            outcome = quotas.backend.assign_monitor_seat(monitor)
            # The MonitorValidator checks if a seat assignment is available.
            # This protects against a race condition
            if outcome != Outcome.ACCEPTED:
                raise ParameterValidationError("Failed to enable monitor, please try again")

        # Attempt to unassign the monitor seat
        if params["status"] == ObjectStatus.DISABLED and (
            monitor.status != ObjectStatus.DISABLED or result.get("is_muted")
        ):
            quotas.backend.disable_monitor_seat(monitor)

        # Update monitor slug in billing
        if "slug" in result:
            quotas.backend.update_monitor_slug(monitor.slug, params["slug"], monitor.project_id)

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=monitor.get_audit_log_data(),
            )

        # Update alert rule after in case slug or name changed
        if "alert_rule" in result:
            # Check to see if rule exists
            issue_alert_rule = monitor.get_issue_alert_rule()
            # If rule exists, update as necessary
            if issue_alert_rule:
                issue_alert_rule_id = update_issue_alert_rule(
                    request, project, monitor, issue_alert_rule, result["alert_rule"]
                )
            # If rule does not exist, create
            else:
                issue_alert_rule_id = create_issue_alert_rule(
                    request, project, monitor, result["alert_rule"]
                )

            if issue_alert_rule_id:
                # If config is not sent, use existing config to update alert_rule_id
                if "config" not in params:
                    params["config"] = monitor.config

                params["config"]["alert_rule_id"] = issue_alert_rule_id
                monitor.update(**params)

        return self.respond(serialize(monitor, request.user))

    def delete_monitor(self, request: Request, project: Project, monitor: Monitor) -> Response:
        """
        Delete a monitor or monitor environments.
        """
        environment_names = request.query_params.getlist("environment")
        env_ids = None
        if environment_names:
            env_ids = list(
                Environment.objects.filter(
                    organization_id=project.organization_id, name__in=environment_names
                ).values_list("id", flat=True)
            )
        with transaction.atomic(router.db_for_write(MonitorEnvironment)):
            monitor_objects: QuerySet[MonitorEnvironment] | QuerySet[Monitor]
            if env_ids:
                monitor_objects = (
                    MonitorEnvironment.objects.filter(
                        environment_id__in=env_ids, monitor_id=monitor.id
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
                    .select_related("monitor")
                )
                event = audit_log.get_event_id("MONITOR_ENVIRONMENT_REMOVE")
                issue_alert_rule_id = None
            else:
                monitor_objects = monitor_monitor_objects = Monitor.objects.filter(
                    id=monitor.id
                ).exclude(
                    status__in=[
                        ObjectStatus.PENDING_DELETION,
                        ObjectStatus.DELETION_IN_PROGRESS,
                    ]
                )
                event = audit_log.get_event_id("MONITOR_REMOVE")

                # Mark rule for deletion if present and monitor is being deleted
                first_monitor = monitor_monitor_objects.first()
                issue_alert_rule_id = (
                    first_monitor.config.get("alert_rule_id") if first_monitor else None
                )

            # create copy of queryset as update will remove objects
            monitor_objects_list: list[MonitorEnvironment | Monitor] = list(monitor_objects)
            if not monitor_objects or not monitor_objects.update(
                status=ObjectStatus.PENDING_DELETION
            ):
                return self.respond(status=404)

            for monitor_object in monitor_objects_list:
                # randomize slug on monitor deletion to prevent re-creation side effects
                if isinstance(monitor_object, Monitor):
                    new_slug = get_random_string(length=24)
                    # we disable the monitor seat so that it can be re-used for another monitor
                    quotas.backend.disable_monitor_seat(monitor=monitor)
                    quotas.backend.update_monitor_slug(monitor.slug, new_slug, monitor.project_id)
                    monitor_object.update(slug=new_slug)

        with transaction.atomic(router.db_for_write(Rule)):
            for monitor_object in monitor_objects_list:
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
            # Mark rule for deletion if present and monitor is being deleted
            if issue_alert_rule_id:
                rule = (
                    Rule.objects.filter(
                        project_id=monitor.project_id,
                        id=issue_alert_rule_id,
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

        return self.respond(status=202)
