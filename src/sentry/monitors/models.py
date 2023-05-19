from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import jsonschema
import pytz
from croniter import croniter
from dateutil import rrule
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone

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
from sentry.locks import locks
from sentry.models import Environment
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.models import Project

SCHEDULE_INTERVAL_MAP = {
    "year": rrule.YEARLY,
    "month": rrule.MONTHLY,
    "week": rrule.WEEKLY,
    "day": rrule.DAILY,
    "hour": rrule.HOURLY,
    "minute": rrule.MINUTELY,
}

MONITOR_CONFIG = {
    "type": "object",
    "properties": {
        "checkin_margin": {"type": ["integer", "null"]},
        "max_runtime": {"type": ["integer", "null"]},
        "timezone": {"type": ["string", "null"]},
        "schedule_type": {"type": "integer"},
        "schedule": {"type": ["string", "array"]},
        "alert_rule_id": {"type": ["integer", "null"]},
    },
    # TODO(davidenwang): Old monitors may not have timezone or schedule_type, these should be added here once we've cleaned up old data
    "required": ["checkin_margin", "max_runtime", "schedule"],
    "additionalProperties": False,
}


class MonitorLimitsExceeded(Exception):
    pass


class MonitorEnvironmentLimitsExceeded(Exception):
    pass


def get_next_schedule(last_checkin, schedule_type, schedule):
    if schedule_type == ScheduleType.CRONTAB:
        itr = croniter(schedule, last_checkin)
        next_schedule = itr.get_next(datetime)
    elif schedule_type == ScheduleType.INTERVAL:
        interval, unit_name = schedule
        rule = rrule.rrule(
            freq=SCHEDULE_INTERVAL_MAP[unit_name], interval=interval, dtstart=last_checkin, count=2
        )
        if rule[0] > last_checkin:
            next_schedule = rule[0]
        else:
            next_schedule = rule[1]
    else:
        raise NotImplementedError("unknown schedule_type")

    # Ensure we clamp the expected time down to the minute, that is the level
    # of granularity we're able to support
    next_schedule = next_schedule.replace(second=0, microsecond=0)

    return next_schedule


def get_monitor_environment_context(monitor_environment):
    config = monitor_environment.monitor.config.copy()
    if "schedule_type" in config:
        config["schedule_type"] = monitor_environment.monitor.get_schedule_type_display()

    return {
        "id": str(monitor_environment.monitor.guid),
        "slug": monitor_environment.monitor.slug,
        "name": monitor_environment.monitor.name,
        "config": monitor_environment.monitor.config,
        "status": monitor_environment.get_status_display(),
        "type": monitor_environment.monitor.get_type_display(),
    }


class MonitorStatus:
    """
    The monitor status is an extension of the ObjectStatus constants. In this
    extension the "status" of a monitor (passing, failing, timed out, etc) is
    represented.

    [!!]: This is NOT used for the status of the Monitor model itself. That is
          simply an ObjectStatus.
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
    def as_choices(cls):
        return (
            # TODO: It is unlikely a MonitorEnvironment should ever be in the
            # 'active' state, since for a monitor environmnent to be created
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
    # monitors. But for now we just have CRON_JOB style moniotors.
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


class MonitorFailure:
    UNKNOWN = "unknown"
    MISSED_CHECKIN = "missed_checkin"
    DURATION = "duration"


class ScheduleType:
    UNKNOWN = 0
    CRONTAB = 1
    INTERVAL = 2

    @classmethod
    def as_choices(cls):
        return ((cls.UNKNOWN, "unknown"), (cls.CRONTAB, "crontab"), (cls.INTERVAL, "interval"))

    @classmethod
    def get_name(cls, value):
        return dict(cls.as_choices())[value]


@region_silo_only_model
class Monitor(Model):
    __include_in_export__ = True

    guid = UUIDField(unique=True, auto_add=True)
    slug = models.SlugField()
    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField(db_index=True)
    name = models.CharField(max_length=128)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )
    type = BoundedPositiveIntegerField(
        default=MonitorType.UNKNOWN,
        choices=[(k, str(v)) for k, v in MonitorType.as_choices()],
    )
    config = JSONField(default=dict)
    date_added = models.DateTimeField(default=timezone.now)

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
                    max_length=50,
                )
        return super().save(*args, **kwargs)

    def get_schedule_type_display(self):
        return ScheduleType.get_name(self.config.get("schedule_type", ScheduleType.CRONTAB))

    def get_audit_log_data(self):
        return {"name": self.name, "type": self.type, "status": self.status, "config": self.config}

    def get_next_scheduled_checkin_without_margin(self, last_checkin):
        tz = pytz.timezone(self.config.get("timezone") or "UTC")
        schedule_type = self.config.get("schedule_type", ScheduleType.CRONTAB)
        next_checkin = get_next_schedule(
            last_checkin.astimezone(tz), schedule_type, self.config["schedule"]
        )
        return next_checkin

    def get_next_scheduled_checkin(self, last_checkin):
        next_checkin = self.get_next_scheduled_checkin_without_margin(last_checkin)
        return next_checkin + timedelta(minutes=int(self.config.get("checkin_margin") or 0))

    def update_config(self, config_payload, validated_config):
        monitor_config = self.config
        # Only update keys that were specified in the payload
        for key in config_payload.keys():
            if key in validated_config:
                monitor_config[key] = validated_config[key]
        self.save()

    def get_validated_config(self):
        try:
            jsonschema.validate(self.config, MONITOR_CONFIG)
            return self.config
        except jsonschema.ValidationError:
            logging.error(f"Monitor: {self.id} invalid config: {self.config}")

        return None


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
    __include_in_export__ = False

    guid = UUIDField(unique=True, auto_add=True)
    project_id = BoundedBigIntegerField(db_index=True)
    monitor = FlexibleForeignKey("sentry.Monitor")
    monitor_environment = FlexibleForeignKey("sentry.MonitorEnvironment", null=True)
    location = FlexibleForeignKey("sentry.MonitorLocation", null=True)
    status = BoundedPositiveIntegerField(
        default=CheckInStatus.UNKNOWN, choices=CheckInStatus.as_choices(), db_index=True
    )
    config = JSONField(default=dict)
    duration = BoundedPositiveIntegerField(null=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)
    attachment_id = BoundedBigIntegerField(null=True)
    # Holds the time we expected to receive this check-in without factoring in margin
    expected_time = models.DateTimeField(null=True)
    monitor_config = JSONField(null=True)

    objects = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorcheckin"
        indexes = [
            models.Index(fields=["monitor", "date_added", "status"]),
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


@region_silo_only_model
class MonitorLocation(Model):
    __include_in_export__ = True

    guid = UUIDField(unique=True, auto_add=True)
    name = models.CharField(max_length=128)
    date_added = models.DateTimeField(default=timezone.now)
    objects = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorlocation"

    __repr__ = sane_repr("guid", "name")


class MonitorEnvironmentManager(BaseManager):
    """
    A manager that consolidates logic for monitor enviroment updates
    """

    def ensure_environment(
        self, project: Project, monitor: Monitor, environment_name: str | None
    ) -> MonitorEnvironment:
        if not environment_name:
            environment_name = "production"

        # TODO: assume these objects exist once backfill is completed
        environment = Environment.get_or_create(project=project, name=environment_name)

        return MonitorEnvironment.objects.get_or_create(
            monitor=monitor, environment=environment, defaults={"status": MonitorStatus.ACTIVE}
        )[0]


@region_silo_only_model
class MonitorEnvironment(Model):
    __include_in_export__ = True

    monitor = FlexibleForeignKey("sentry.Monitor")
    environment = FlexibleForeignKey("sentry.Environment")
    status = BoundedPositiveIntegerField(
        default=MonitorStatus.ACTIVE, choices=MonitorStatus.as_choices()
    )
    next_checkin = models.DateTimeField(null=True)
    last_checkin = models.DateTimeField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    objects = MonitorEnvironmentManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitorenvironment"
        unique_together = (("monitor", "environment"),)

    __repr__ = sane_repr("monitor_id", "environment_id")

    def get_audit_log_data(self):
        return {"name": self.environment.name, "status": self.status, "monitor": self.monitor.name}

    def mark_failed(self, last_checkin=None, reason=MonitorFailure.UNKNOWN):
        from sentry.coreapi import insert_data_to_database_legacy
        from sentry.event_manager import EventManager
        from sentry.models import Project
        from sentry.signals import monitor_environment_failed

        if last_checkin is None:
            next_checkin_base = timezone.now()
            last_checkin = self.last_checkin or timezone.now()
        else:
            next_checkin_base = last_checkin

        new_status = MonitorStatus.ERROR
        if reason == MonitorFailure.MISSED_CHECKIN:
            new_status = MonitorStatus.MISSED_CHECKIN
        elif reason == MonitorFailure.DURATION:
            new_status = MonitorStatus.TIMEOUT

        affected = (
            type(self)
            .objects.filter(
                Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=self.id
            )
            .update(
                next_checkin=self.monitor.get_next_scheduled_checkin(next_checkin_base),
                status=new_status,
                last_checkin=last_checkin,
            )
        )
        if not affected:
            return False

        event_manager = EventManager(
            {
                "logentry": {"message": f"Monitor failure: {self.monitor.name} ({reason})"},
                "contexts": {"monitor": get_monitor_environment_context(self)},
                "fingerprint": ["monitor", str(self.monitor.guid), reason],
                "environment": self.environment.name,
                # TODO: Both of these values should be get transformed from context to tags
                # We should understand why that is not happening and remove these when it correctly is
                "tags": {"monitor.id": str(self.monitor.guid), "monitor.slug": self.monitor.slug},
            },
            project=Project(id=self.monitor.project_id),
        )
        event_manager.normalize()
        data = event_manager.get_data()
        insert_data_to_database_legacy(data)
        monitor_environment_failed.send(monitor_environment=self, sender=type(self))
        return True

    def mark_ok(self, checkin: MonitorCheckIn, ts: datetime):
        params = {
            "last_checkin": ts,
            "next_checkin": self.monitor.get_next_scheduled_checkin(ts),
        }
        if checkin.status == CheckInStatus.OK and self.monitor.status != ObjectStatus.DISABLED:
            params["status"] = MonitorStatus.OK

        MonitorEnvironment.objects.filter(id=self.id).exclude(last_checkin__gt=ts).update(**params)


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
