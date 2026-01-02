from __future__ import annotations

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils.crypto import get_random_string
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, quotas
from sentry.api.base import BaseEndpointMixin
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.constants import DataCategory, ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorStatus
from sentry.monitors.serializers import MonitorSerializer
from sentry.monitors.utils import ensure_cron_detector_deletion
from sentry.monitors.validators import MonitorValidator
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.db import atomic_transaction
from sentry.workflow_engine.models import Detector


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
        validator = MonitorValidator(
            data=request.data,
            partial=True,
            instance=monitor,
            context={
                "organization": project.organization,
                "access": request.access,
                "request": request,
                "monitor": monitor,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        try:
            updated_monitor = validator.save()
        except serializers.ValidationError as e:
            return self.respond(e.detail, status=400)

        return self.respond(serialize(updated_monitor, request.user))

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
                    quotas.backend.disable_seat(DataCategory.MONITOR_SEAT, monitor)
                    quotas.backend.update_monitor_slug(monitor.slug, new_slug, monitor.project_id)
                    monitor_object.update(slug=new_slug)

        with (
            in_test_hide_transaction_boundary(),
            atomic_transaction(
                [
                    router.db_for_write(Rule),
                    router.db_for_write(Monitor),
                    router.db_for_write(Detector),
                ]
            ),
        ):
            for monitor_object in monitor_objects_list:
                if isinstance(monitor_object, Monitor):
                    ensure_cron_detector_deletion(monitor_object)
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
