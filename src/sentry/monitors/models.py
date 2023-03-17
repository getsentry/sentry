from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytz
from croniter import croniter
from dateutil import rrule
from django.db import models
from django.db.models import Q
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
from sentry.models import Environment, Project

SCHEDULE_INTERVAL_MAP = {
    "year": rrule.YEARLY,
    "month": rrule.MONTHLY,
    "week": rrule.WEEKLY,
    "day": rrule.DAILY,
    "hour": rrule.HOURLY,
    "minute": rrule.MINUTELY,
}


def get_next_schedule(base_datetime, schedule_type, schedule):
    if schedule_type == ScheduleType.CRONTAB:
        itr = croniter(schedule, base_datetime)
        next_schedule = itr.get_next(datetime)
    elif schedule_type == ScheduleType.INTERVAL:
        count, unit_name = schedule
        # count is the "number of units" and unit_name is the "unit name of interval"
        # which is inverse from what rrule calls them
        rule = rrule.rrule(
            freq=SCHEDULE_INTERVAL_MAP[unit_name], interval=count, dtstart=base_datetime, count=2
        )
        if rule[0] > base_datetime:
            next_schedule = rule[0]
        else:
            next_schedule = rule[1]
    else:
        raise NotImplementedError("unknown schedule_type")

    return next_schedule


def get_monitor_context(monitor):
    config = monitor.config.copy()
    if "schedule_type" in config:
        config["schedule_type"] = monitor.get_schedule_type_display()

    return {
        "id": str(monitor.guid),
        "slug": monitor.slug,
        "name": monitor.name,
        "config": monitor.config,
        "status": monitor.get_status_display(),
        "type": monitor.get_type_display(),
    }


class MonitorStatus(ObjectStatus):
    OK = 4
    ERROR = 5
    MISSED_CHECKIN = 6

    @classmethod
    def as_choices(cls):
        return (
            (cls.ACTIVE, "active"),
            (cls.DISABLED, "disabled"),
            (cls.PENDING_DELETION, "pending_deletion"),
            (cls.DELETION_IN_PROGRESS, "deletion_in_progress"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
            (cls.MISSED_CHECKIN, "missed_checkin"),
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

    FINISHED_VALUES = (OK, ERROR)
    """Sentient values used to indicate a monitor is finished running"""

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNKNOWN, "unknown"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
            (cls.IN_PROGRESS, "in_progress"),
            (cls.MISSED, "missed"),
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
        default=MonitorStatus.ACTIVE, choices=MonitorStatus.as_choices()
    )
    type = BoundedPositiveIntegerField(
        default=MonitorType.UNKNOWN,
        choices=[(k, str(v)) for k, v in MonitorType.as_choices()],
    )
    config = JSONField(default=dict)
    next_checkin = models.DateTimeField(null=True)
    last_checkin = models.DateTimeField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitor"
        index_together = (("type", "next_checkin"),)
        unique_together = (("organization_id", "slug"),)

    __repr__ = sane_repr("guid", "project_id", "name")

    def save(self, *args, **kwargs):
        # TODO(epurkhsier): This logic is to be removed when the `guid` field
        # is removed and a slug is required when creating monitors

        # NOTE: We ONLY set a slug while saving when creating a new monitor and
        # the slug has not been set. Otherwise existing monitors without slugs
        # would have their guids changed
        if self._state.adding is True and not self.slug:
            self.guid = uuid4()
            self.slug = str(self.guid)
        return super().save(*args, **kwargs)

    def get_schedule_type_display(self):
        return ScheduleType.get_name(self.config.get("schedule_type", ScheduleType.CRONTAB))

    def get_audit_log_data(self):
        return {"name": self.name, "type": self.type, "status": self.status, "config": self.config}

    def get_next_scheduled_checkin(self, last_checkin=None):
        if last_checkin is None:
            last_checkin = self.last_checkin
        tz = pytz.timezone(self.config.get("timezone") or "UTC")
        schedule_type = self.config.get("schedule_type", ScheduleType.CRONTAB)
        base_datetime = last_checkin.astimezone(tz)
        next_checkin = get_next_schedule(base_datetime, schedule_type, self.config["schedule"])
        return next_checkin + timedelta(minutes=int(self.config.get("checkin_margin") or 0))

    def mark_failed(self, last_checkin=None, reason=MonitorFailure.UNKNOWN):
        from sentry.coreapi import insert_data_to_database_legacy
        from sentry.event_manager import EventManager
        from sentry.models import Project
        from sentry.signals import monitor_failed

        if last_checkin is None:
            next_checkin_base = timezone.now()
            last_checkin = self.last_checkin or timezone.now()
        else:
            next_checkin_base = last_checkin

        new_status = MonitorStatus.ERROR
        if reason == MonitorFailure.MISSED_CHECKIN:
            new_status = MonitorStatus.MISSED_CHECKIN

        affected = (
            type(self)
            .objects.filter(
                Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=self.id
            )
            .update(
                next_checkin=self.get_next_scheduled_checkin(next_checkin_base),
                status=new_status,
                last_checkin=last_checkin,
            )
        )
        if not affected:
            return False

        event_manager = EventManager(
            {
                "logentry": {"message": f"Monitor failure: {self.name} ({reason})"},
                "contexts": {"monitor": get_monitor_context(self)},
                "fingerprint": ["monitor", str(self.guid), reason],
                "tags": {"monitor.id": str(self.guid)},
            },
            project=Project(id=self.project_id),
        )
        event_manager.normalize()
        data = event_manager.get_data()
        insert_data_to_database_legacy(data)
        monitor_failed.send(monitor=self, sender=type(self))
        return True

    def mark_ok(self, checkin: MonitorCheckIn, ts: datetime):
        params = {
            "last_checkin": ts,
            "next_checkin": self.get_next_scheduled_checkin(ts),
        }
        if checkin.status == CheckInStatus.OK and self.status != MonitorStatus.DISABLED:
            params["status"] = MonitorStatus.OK

        Monitor.objects.filter(id=self.id).exclude(last_checkin__gt=ts).update(**params)


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

        monitorenvironment_defaults = {
            "status": monitor.status,
            "next_checkin": monitor.next_checkin,
            "last_checkin": monitor.last_checkin,
        }

        return MonitorEnvironment.objects.get_or_create(
            monitor=monitor, environment=environment, defaults=monitorenvironment_defaults
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

    def mark_failed(self, last_checkin=None, reason=MonitorFailure.UNKNOWN):
        if last_checkin is None:
            next_checkin_base = timezone.now()
            last_checkin = self.last_checkin or timezone.now()
        else:
            next_checkin_base = last_checkin

        new_status = MonitorStatus.ERROR
        if reason == MonitorFailure.MISSED_CHECKIN:
            new_status = MonitorStatus.MISSED_CHECKIN

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

        return True

    def mark_ok(self, checkin: MonitorCheckIn, ts: datetime):
        params = {
            "last_checkin": ts,
            "next_checkin": self.monitor.get_next_scheduled_checkin(ts),
        }
        if checkin.status == CheckInStatus.OK and self.status != MonitorStatus.DISABLED:
            params["status"] = MonitorStatus.OK

        MonitorEnvironment.objects.filter(id=self.id).exclude(last_checkin__gt=ts).update(**params)
