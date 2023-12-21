from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, ClassVar, Dict, Optional, Sequence, Tuple, Union
from uuid import uuid4

import jsonschema
import pytz
from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver
from django.utils import timezone
from typing_extensions import Self

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    UUIDField,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.grouping.utils import hash_from_values
from sentry.locks import locks
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.constants import MAX_SLUG_LENGTH
from sentry.monitors.types import CrontabSchedule, IntervalSchedule
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.models.project import Project

MONITOR_CONFIG = {
    "type": "object",
    "properties": {
        "checkin_margin": {"type": ["integer", "null"]},
        "max_runtime": {"type": ["integer", "null"]},
        "timezone": {"type": ["string", "null"]},
        "schedule_type": {"type": "integer"},
        "schedule": {"type": ["string", "array"]},
        "alert_rule_id": {"type": ["integer", "null"]},
        "failure_issue_threshold": {"type": ["integer", "null"]},
        "recovery_threshold": {"type": ["integer", "null"]},
    },
    # TODO(davidenwang): Old monitors may not have timezone, it should be added
    # here once we've cleaned up old data
    "required": ["checkin_margin", "max_runtime", "schedule_type", "schedule"],
    "additionalProperties": False,
}


class MonitorLimitsExceeded(Exception):
    pass


class MonitorEnvironmentLimitsExceeded(Exception):
    pass


class MonitorEnvironmentValidationFailed(Exception):
    pass


class MonitorStatus:
    """
    The monitor status is an extension of the ObjectStatus constants. In this
    extension the "status" of a monitor (passing, failing, timed out, etc) is
    represented.

    [!!]: This is NOT used for the status of the Monitor model itself. That is
          a ObjectStatus.
    """

    ACTIVE = 0
    DISABLED = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3

    OK = 4
    ERROR = 5
    MISSED_CHECKIN = 6
    TIMEOUT = 7

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            # TODO: It is unlikely a MonitorEnvironment should ever be in the
            # 'active' state, since for a monitor environment to be created
            # some checkins must have been sent.
            (cls.ACTIVE, "active"),
            # The DISABLED state is denormalized off of the parent Monitor.
            (cls.DISABLED, "disabled"),
            # MonitorEnvironment's may be deleted
            (cls.PENDING_DELETION, "pending_deletion"),
            (cls.DELETION_IN_PROGRESS, "deletion_in_progress"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
            (cls.MISSED_CHECKIN, "missed_checkin"),
            (cls.TIMEOUT, "timeout"),
        )


class CheckInStatus:
    UNKNOWN = 0
    """No status was passed"""

    OK = 1
    """Checkin had no issues during execution"""

    ERROR = 2
    """Checkin failed or otherwise had some issues"""

    IN_PROGRESS = 3
    """Checkin is expected to complete"""

    MISSED = 4
    """Monitor did not check in on time"""

    TIMEOUT = 5
    """Checkin was left in-progress past max_runtime"""

    FINISHED_VALUES = (OK, ERROR, MISSED, TIMEOUT)
    """Terminal values used to indicate a monitor is finished running"""

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNKNOWN, "unknown"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
            (cls.IN_PROGRESS, "in_progress"),
            (cls.MISSED, "missed"),
            (cls.TIMEOUT, "timeout"),
        )


class MonitorType:
    # In the future we may have other types of monitors such as health check
    # monitors. But for now we just have CRON_JOB style monitors.
    UNKNOWN = 0
    CRON_JOB = 3

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNKNOWN, "unknown"),
            (cls.CRON_JOB, "cron_job"),
        )

    @classmethod
    def get_name(cls, value):
        return dict(cls.as_choices())[value]


class ScheduleType:
    UNKNOWN = 0
    CRONTAB = 1
    INTERVAL = 2

    @classmethod
    def as_choices(cls):
        return ((cls.CRONTAB, "crontab"), (cls.INTERVAL, "interval"))

    @classmethod
    def get_name(cls, value):
        return dict(cls.as_choices())[value]


@region_silo_only_model
class Monitor(Model):
    __relocation_scope__ = RelocationScope.Organization

    date_added = models.DateTimeField(default=timezone.now)
    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField(db_index=True)

    # TODO(epurkhiser): Muted is moving to its own boolean column, this should
    # become object status again
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )
    """
    Active status of the monitor. This is similar to most other ObjectStatus's
    within the app. Used to mark monitors as disabled and pending deletions
    """

    guid = UUIDField(unique=True, auto_add=True)
    """
    Globally unique identifier for the monitor. Mostly legacy, used in legacy
    API endpoints.
    """

    slug = models.SlugField()
    """
    Organization unique slug of the monitor. Used to identify the monitor in
    check-in payloads. The slug can be changed.
    """

    is_muted = models.BooleanField(default=False)
    """
    Monitor is operating normally but will not produce incidents or produce
    occurrences into the issues platform.
    """

    name = models.CharField(max_length=128)
    """
    Human readable name of the monitor. Used for display purposes.
    """

    type = BoundedPositiveIntegerField(
        default=MonitorType.UNKNOWN,
        choices=[(k, str(v)) for k, v in MonitorType.as_choices()],
    )
    """
    Type of monitor. Currently there are only CRON_JOB monitors.
    """

    config: models.Field[dict[str, Any], dict[str, Any]] = JSONField(default=dict)
    """
    Stores the monitor configuration. See MONITOR_CONFIG for the schema.
    """

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitor"
        unique_together = (("organization_id", "slug"),)

    __repr__ = sane_repr("guid", "project_id", "name")

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get(
                f"slug:monitor:{self.organization_id}", duration=5, name="monitor_slug"
            )
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(
                    self,
                    self.name,
                    organization_id=self.organization_id,
                    max_length=MAX_SLUG_LENGTH,
                )
        return super().save(*args, **kwargs)

    @property
    def schedule(self) -> Union[CrontabSchedule, IntervalSchedule]:
        schedule_type = self.config["schedule_type"]
        schedule = self.config["schedule"]

        if schedule_type == ScheduleType.CRONTAB:
            return CrontabSchedule(crontab=schedule)
        if schedule_type == ScheduleType.INTERVAL:
            return IntervalSchedule(interval=schedule[0], unit=schedule[1])

        raise NotImplementedError("unknown schedule_type")

    @property
    def timezone(self):
        return pytz.timezone(self.config.get("timezone") or "UTC")

    def get_schedule_type_display(self):
        return ScheduleType.get_name(self.config["schedule_type"])

    def get_audit_log_data(self):
        return {"name": self.name, "type": self.type, "status": self.status, "config": self.config}

    def get_next_expected_checkin(self, last_checkin: datetime) -> datetime:
        """
        Computes the next expected checkin time given the most recent checkin time
        """
        from sentry.monitors.schedule import get_next_schedule

        return get_next_schedule(last_checkin.astimezone(self.timezone), self.schedule)

    def get_next_expected_checkin_latest(self, last_checkin: datetime) -> datetime:
        """
        Computes the latest time we will expect the next checkin at given the
        most recent checkin time. This is determined by the user-configured
        margin.
        """
        from sentry.monitors.utils import get_checkin_margin

        next_checkin = self.get_next_expected_checkin(last_checkin)
        return next_checkin + get_checkin_margin(self.config.get("checkin_margin"))

    def update_config(self, config_payload, validated_config):
        monitor_config = self.config
        keys = set(config_payload.keys())

        # Always update schedule and schedule_type
        keys.update({"schedule", "schedule_type"})
        # Otherwise, only update keys that were specified in the payload
        for key in keys:
            if key in validated_config:
                monitor_config[key] = validated_config[key]
        self.save()

    def get_validated_config(self):
        try:
            jsonschema.validate(self.config, MONITOR_CONFIG)
            return self.config
        except jsonschema.ValidationError:
            logging.exception("Monitor: %s invalid config: %s", self.id, self.config)

    def get_alert_rule(self):
        alert_rule_id = self.config.get("alert_rule_id")
        if alert_rule_id:
            alert_rule = Rule.objects.filter(
                project_id=self.project_id,
                id=alert_rule_id,
                source=RuleSource.CRON_MONITOR,
                status=ObjectStatus.ACTIVE,
            ).first()
            if alert_rule:
                return alert_rule

            # If alert_rule_id is stale, clear it from the config
            clean_config = self.config.copy()
            clean_config.pop("alert_rule_id", None)
            self.update(config=clean_config)

        return None

    def get_alert_rule_data(self):
        alert_rule = self.get_alert_rule()
        if alert_rule:
            data = alert_rule.data
            alert_rule_data: Dict[str, Optional[Any]] = dict()

            # Build up alert target data
            targets = []
            for action in data.get("actions", []):
                # Only include email alerts for now
                if action.get("id") == "sentry.mail.actions.NotifyEmailAction":
                    targets.append(
                        {
                            "targetIdentifier": action.get("targetIdentifier"),
                            "targetType": action.get("targetType"),
                        }
                    )
            alert_rule_data["targets"] = targets

            environment, alert_rule_environment_id = None, alert_rule.environment_id
            if alert_rule_environment_id:
                try:
                    environment = Environment.objects.get(id=alert_rule_environment_id).name
                except Environment.DoesNotExist:
                    pass

            alert_rule_data["environment"] = environment

            return alert_rule_data

        return None

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> Optional[int]:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Generate a new UUID.
        self.guid = uuid4()
        return old_pk


@receiver(pre_save, sender=Monitor)
def check_organization_monitor_limits(sender, instance, **kwargs):
    if (
        instance.pk is None
        and sender.objects.filter(organization_id=instance.organization_id).count()
        == settings.MAX_MONITORS_PER_ORG
    ):
        raise MonitorLimitsExceeded(
            f"You may not exceed {settings.MAX_MONITORS_PER_ORG} monitors per organization"
        )


@region_silo_only_model
class MonitorCheckIn(Model):
    __relocation_scope__ = RelocationScope.Excluded

    guid = UUIDField(unique=True, auto_add=True)
    project_id = BoundedBigIntegerField(db_index=True)
    monitor = FlexibleForeignKey("sentry.Monitor")
    monitor_environment = FlexibleForeignKey("sentry.MonitorEnvironment", null=True)
    location = FlexibleForeignKey("sentry.MonitorLocation", null=True)
    """
    XXX(epurkhiser): Currently unused
    """
    status = BoundedPositiveIntegerField(
        default=CheckInStatus.UNKNOWN,
        choices=CheckInStatus.as_choices(),
        db_index=True,
    )
    """
    The status of the check-in
    """

    duration = BoundedPositiveIntegerField(null=True)
    """
    The total number in milliseconds that the check-in took to execute. This is
    generally computed from the difference between the opening and closing
    check-in.
    """

    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    """
    Represents the time the checkin was made. This CAN BE back-dated in some
    cases, and does not necessarily represent the insertion time of the row in
    the database.
    """

    date_updated = models.DateTimeField(default=timezone.now)
    """
    Currently only updated when a in_progress check-in is sent with this
    check-in's guid. Can be used to extend the lifetime of a check-in so that
    it does not time out.
    """

    expected_time = models.DateTimeField(null=True)
    """
    Holds the exact time we expected to receive this check-in
    """

    timeout_at = models.DateTimeField(null=True)
    """
    Holds the exact time when a check-in would be considered to have timed out.
    This is computed as the sum of date_updated and the user configured
    max_runtime.
    """

    monitor_config = JSONField(null=True)
    """
    A snapshot of the monitor configuration at the time of the check-in.
    """

    trace_id = UUIDField(null=True)
    """
    Trace ID associated during this check-in. Useful to find associated events
    that occurred during the check-in.
    """

    attachment_id = BoundedBigIntegerField(null=True)
    config = JSONField(default=dict)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorcheckin"
        indexes = [
            # used for endpoints for monitor stats + list check-ins
            models.Index(fields=["monitor", "date_added", "status"]),
            # used for latest in monitor consumer
            models.Index(fields=["monitor", "status", "date_added"]),
            # used for has_newer_result + thresholds
            models.Index(fields=["monitor_environment", "date_added", "status"]),
            # used for latest on api endpoints
            models.Index(fields=["monitor_environment", "status", "date_added"]),
            # used for timeout task
            models.Index(fields=["status", "timeout_at"]),
            # used for check-in list
            models.Index(fields=["trace_id"]),
        ]

    __repr__ = sane_repr("guid", "project_id", "status")

    def save(self, *args, **kwargs):
        if not self.date_added:
            self.date_added = timezone.now()
        if not self.date_updated:
            self.date_updated = self.date_added
        return super().save(*args, **kwargs)

    # XXX(dcramer): BaseModel is trying to automatically set date_updated which is not
    # what we want to happen, so kill it here
    def _update_timestamps(self):
        pass


def delete_file_for_monitorcheckin(instance: MonitorCheckIn, **kwargs):
    if file_id := instance.attachment_id:
        from sentry.models.files import File

        File.objects.filter(id=file_id).delete()


post_delete.connect(delete_file_for_monitorcheckin, sender=MonitorCheckIn)


@region_silo_only_model
class MonitorLocation(Model):
    __relocation_scope__ = RelocationScope.Excluded

    guid = UUIDField(unique=True, auto_add=True)
    name = models.CharField(max_length=128)
    date_added = models.DateTimeField(default=timezone.now)
    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorlocation"

    __repr__ = sane_repr("guid", "name")


class MonitorEnvironmentManager(BaseManager["MonitorEnvironment"]):
    """
    A manager that consolidates logic for monitor environment updates
    """

    def ensure_environment(
        self, project: Project, monitor: Monitor, environment_name: str | None
    ) -> MonitorEnvironment:
        if not environment_name:
            environment_name = "production"

        if not Environment.is_valid_name(environment_name):
            raise MonitorEnvironmentValidationFailed("Environment name too long")

        # TODO: assume these objects exist once backfill is completed
        environment = Environment.get_or_create(project=project, name=environment_name)

        return MonitorEnvironment.objects.get_or_create(
            monitor=monitor, environment=environment, defaults={"status": MonitorStatus.ACTIVE}
        )[0]


@region_silo_only_model
class MonitorEnvironment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    monitor = FlexibleForeignKey("sentry.Monitor")
    environment = FlexibleForeignKey("sentry.Environment")
    date_added = models.DateTimeField(default=timezone.now)

    status = BoundedPositiveIntegerField(
        default=MonitorStatus.ACTIVE,
        choices=MonitorStatus.as_choices(),
    )
    """
    The MonitorStatus of the monitor. This is denormalized from the check-ins
    list, since it would be possible to determine this by looking at recent
    check-ins. It is denormalized for simplicity.
    """

    is_muted = models.BooleanField(default=False)
    """
    Monitor environment is operating normally but will not produce incidents or produce
    occurrences into the issues platform.
    """

    next_checkin = models.DateTimeField(null=True)
    """
    The expected time that the next-checkin will occur
    """

    next_checkin_latest = models.DateTimeField(null=True)
    """
    The latest expected time that the next-checkin can occur without generating
    a missed check-in. This is computed using the user-configured margin for
    the monitor.
    """

    last_checkin = models.DateTimeField(null=True)
    """
    date_added time of the most recent user-check in. This does not include
    auto-generated missed check-ins.
    """

    last_state_change = models.DateTimeField(null=True)
    """
    The last time that the monitor changed state. Used for issue fingerprinting.
    """

    objects: ClassVar[MonitorEnvironmentManager] = MonitorEnvironmentManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorenvironment"
        unique_together = (("monitor", "environment"),)
        indexes = [
            models.Index(fields=["status", "next_checkin_latest"]),
        ]

    __repr__ = sane_repr("monitor_id", "environment_id")

    def get_audit_log_data(self):
        return {"name": self.environment.name, "status": self.status, "monitor": self.monitor.name}

    def get_last_successful_checkin(self):
        return (
            MonitorCheckIn.objects.filter(monitor_environment=self, status=CheckInStatus.OK)
            .order_by("-date_added")
            .first()
        )

    @property
    def incident_grouphash(self):
        # TODO(rjo100): Check to see if there's an active incident
        # if not, use last_state_change as fallback
        active_incident = (
            MonitorIncident.objects.filter(
                monitor_environment_id=self.id, resolving_checkin__isnull=True
            )
            .order_by("-date_added")
            .first()
        )
        if active_incident:
            return active_incident.grouphash

        # XXX(rjo100): While we migrate monitor issues to using the
        # Incident stored grouphash we still may have some active issues
        # that are using the old hashes. We can remove this in the
        # future once all existing issues are resolved.
        return hash_from_values(
            [
                "monitor",
                str(self.monitor.guid),
                self.environment.name,
                str(self.last_state_change),
            ]
        )


@receiver(pre_save, sender=MonitorEnvironment)
def check_monitor_environment_limits(sender, instance, **kwargs):
    if (
        instance.pk is None
        and sender.objects.filter(monitor=instance.monitor).count()
        == settings.MAX_ENVIRONMENTS_PER_MONITOR
    ):
        raise MonitorEnvironmentLimitsExceeded(
            f"You may not exceed {settings.MAX_ENVIRONMENTS_PER_MONITOR} environments per monitor"
        )


@region_silo_only_model
class MonitorIncident(Model):
    __relocation_scope__ = RelocationScope.Excluded

    monitor = FlexibleForeignKey("sentry.Monitor")
    monitor_environment = FlexibleForeignKey("sentry.MonitorEnvironment")
    starting_checkin = FlexibleForeignKey(
        "sentry.MonitorCheckIn", null=True, related_name="created_incidents"
    )
    starting_timestamp = models.DateTimeField(null=True)
    """
    This represents the first failed check-in that we receive
    """

    resolving_checkin = FlexibleForeignKey(
        "sentry.MonitorCheckIn", null=True, related_name="resolved_incidents"
    )
    resolving_timestamp = models.DateTimeField(null=True)
    """
    This represents the final OK check-in that we receive
    """

    grouphash = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorincident"
