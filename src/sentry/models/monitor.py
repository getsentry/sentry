from __future__ import absolute_import, print_function

import pytz
import six

from croniter import croniter
from datetime import datetime, timedelta
from dateutil import rrule
from django.db import models
from django.db.models import Q
from django.utils import timezone
from uuid import uuid4

from sentry.constants import ObjectStatus
from sentry.db.models import (
    Model,
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    UUIDField,
    sane_repr,
)

SCHEDULE_INTERVAL_MAP = {
    "year": rrule.YEARLY,
    "month": rrule.MONTHLY,
    "week": rrule.WEEKLY,
    "day": rrule.DAILY,
    "hour": rrule.HOURLY,
    "minute": rrule.MINUTELY,
}


def generate_secret():
    return uuid4().hex + uuid4().hex


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


class MonitorStatus(ObjectStatus):
    OK = 4
    ERROR = 5

    @classmethod
    def as_choices(cls):
        return (
            (cls.ACTIVE, "active"),
            (cls.DISABLED, "disabled"),
            (cls.PENDING_DELETION, "pending_deletion"),
            (cls.DELETION_IN_PROGRESS, "deletion_in_progress"),
            (cls.OK, "ok"),
            (cls.ERROR, "error"),
        )


class MonitorType(object):
    UNKNOWN = 0
    HEALTH_CHECK = 1
    HEARTBEAT = 2
    CRON_JOB = 3

    @classmethod
    def as_choices(cls):
        return (
            (cls.UNKNOWN, "unknown"),
            (cls.HEALTH_CHECK, "health_check"),
            (cls.HEARTBEAT, "heartbeat"),
            (cls.CRON_JOB, "cron_job"),
        )


class ScheduleType(object):
    UNKNOWN = 0
    CRONTAB = 1
    INTERVAL = 2

    @classmethod
    def as_choices(cls):
        return ((cls.UNKNOWN, "unknown"), (cls.CRONTAB, "crontab"), (cls.INTERVAL, "interval"))


class Monitor(Model):
    __core__ = True

    guid = UUIDField(unique=True, auto_add=True)
    organization_id = BoundedPositiveIntegerField(db_index=True)
    project_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=128)
    status = BoundedPositiveIntegerField(
        default=MonitorStatus.ACTIVE, choices=MonitorStatus.as_choices()
    )
    type = BoundedPositiveIntegerField(
        default=MonitorType.UNKNOWN, choices=MonitorType.as_choices()
    )
    config = EncryptedJsonField(default=dict)
    next_checkin = models.DateTimeField(null=True)
    last_checkin = models.DateTimeField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_monitor"
        index_together = (("type", "next_checkin"),)

    __repr__ = sane_repr("guid", "project_id", "name")

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

    def mark_failed(self, last_checkin=None):
        from sentry.coreapi import ClientApiHelper
        from sentry.event_manager import EventManager
        from sentry.models import Project
        from sentry.signals import monitor_failed

        if last_checkin is None:
            next_checkin_base = timezone.now()
            last_checkin = self.last_checkin or timezone.now()
        else:
            next_checkin_base = last_checkin

        affected = (
            type(self)
            .objects.filter(
                Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=self.id
            )
            .update(
                next_checkin=self.get_next_scheduled_checkin(next_checkin_base),
                status=MonitorStatus.ERROR,
                last_checkin=last_checkin,
            )
        )
        if not affected:
            return False

        event_manager = EventManager(
            {
                "logentry": {"message": "Monitor failure: %s" % (self.name,)},
                "contexts": {"monitor": {"id": six.text_type(self.guid)}},
            },
            project=Project(id=self.project_id),
        )
        event_manager.normalize()
        data = event_manager.get_data()
        helper = ClientApiHelper(project_id=self.project_id)
        helper.insert_data_to_database(data)
        monitor_failed.send(monitor=self, sender=type(self))
        return True
