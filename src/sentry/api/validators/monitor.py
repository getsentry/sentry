from __future__ import absolute_import

import six

from collections import OrderedDict
from croniter import croniter
from django.core.exceptions import ValidationError
from rest_framework import serializers

from sentry.models import MonitorStatus, MonitorType, ScheduleType
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.utils.compat import zip


SCHEDULE_TYPES = OrderedDict(
    [("crontab", ScheduleType.CRONTAB), ("interval", ScheduleType.INTERVAL)]
)

MONITOR_TYPES = OrderedDict([("cron_job", MonitorType.CRON_JOB)])

MONITOR_STATUSES = OrderedDict(
    [("active", MonitorStatus.ACTIVE), ("disabled", MonitorStatus.DISABLED)]
)

INTERVAL_NAMES = ("year", "month", "week", "day", "hour", "minute")

# XXX(dcramer): @reboot is not supported (as it cannot be)
NONSTANDARD_CRONTAB_SCHEDULES = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@hourly": "0 * * * *",
}


class ObjectField(serializers.Field):
    def to_internal_value(self, data):
        return data


class CronJobValidator(serializers.Serializer):
    schedule_type = serializers.ChoiceField(
        choices=zip(SCHEDULE_TYPES.keys(), SCHEDULE_TYPES.keys())
    )
    schedule = ObjectField()
    checkin_margin = EmptyIntegerField(required=False, default=None)
    max_runtime = EmptyIntegerField(required=False, default=None)

    def validate_schedule_type(self, value):
        if value:
            value = SCHEDULE_TYPES[value]
        return value

    def validate(self, attrs):
        if "schedule_type" in attrs:
            schedule_type = attrs["schedule_type"]
        else:
            schedule_type = self.instance["schedule_type"]

        value = attrs.get("schedule")
        if not value:
            return attrs

        if schedule_type == ScheduleType.INTERVAL:
            if not isinstance(value, list):
                raise ValidationError("Invalid value for schedule_type")
            if not isinstance(value[0], int):
                raise ValidationError("Invalid value for schedule unit count (index 0)")
            if value[1] not in INTERVAL_NAMES:
                raise ValidationError("Invalid value for schedule unit name (index 1)")
        elif schedule_type == ScheduleType.CRONTAB:
            if not isinstance(value, six.string_types):
                raise ValidationError("Invalid value for schedule_type")
            value = value.strip()
            if value.startswith("@"):
                try:
                    value = NONSTANDARD_CRONTAB_SCHEDULES[value]
                except KeyError:
                    raise ValidationError("Schedule was not parseable")
            if not croniter.is_valid(value):
                raise ValidationError("Schedule was not parseable")
            attrs["schedule"] = value
        return attrs


class MonitorValidator(serializers.Serializer):
    project = ProjectField()
    name = serializers.CharField()
    status = serializers.ChoiceField(
        choices=zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys()), default=u"active"
    )
    type = serializers.ChoiceField(choices=zip(MONITOR_TYPES.keys(), MONITOR_TYPES.keys()))
    config = ObjectField()

    def validate(self, attrs):
        attrs = super(MonitorValidator, self).validate(attrs)
        type = self.instance["type"] if self.instance else self.initial_data.get("type")
        if type in MONITOR_TYPES:
            type = MONITOR_TYPES[type]
        if type == MonitorType.CRON_JOB:
            validator = CronJobValidator(
                instance=self.instance.get("config", {}) if self.instance else {},
                data=attrs.get("config", {}),
                partial=self.partial,
            )
            validator.is_valid(raise_exception=True)
            attrs["config"] = validator.validated_data
        elif not type:
            return attrs
        else:
            raise NotImplementedError
        return attrs

    def validate_status(self, value):
        if value:
            value = MONITOR_STATUSES[value]
        return value

    def validate_type(self, value):
        if value:
            value = MONITOR_TYPES[value]
        return value

    def update(self, instance, validated_data):
        has_config = "config" in instance or "config" in validated_data
        if has_config:
            config = instance.get("config", {})
            config.update(validated_data.get("config", {}))
        instance.update(validated_data)
        if has_config:
            instance["config"] = config
        return instance

    def create(self, validated_data):
        return validated_data
