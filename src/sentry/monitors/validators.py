from croniter import croniter
from django.core.exceptions import ValidationError
from django.utils.timezone import pytz
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.monitors.models import CheckInStatus, MonitorStatus, MonitorType, ScheduleType

MONITOR_TYPES = {"cron_job": MonitorType.CRON_JOB}

MONITOR_STATUSES = {
    "active": MonitorStatus.ACTIVE,
    "disabled": MonitorStatus.DISABLED,
}

SCHEDULE_TYPES = {
    "crontab": ScheduleType.CRONTAB,
    "interval": ScheduleType.INTERVAL,
}

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


@extend_schema_field(OpenApiTypes.ANY)
class ObjectField(serializers.Field):
    def to_internal_value(self, data):
        return data


class CronJobValidator(serializers.Serializer):
    schedule_type = serializers.ChoiceField(
        choices=list(zip(SCHEDULE_TYPES.keys(), SCHEDULE_TYPES.keys()))
    )
    schedule = ObjectField()
    checkin_margin = EmptyIntegerField(required=False, allow_null=True, default=None)
    max_runtime = EmptyIntegerField(required=False, allow_null=True, default=None)
    timezone = serializers.ChoiceField(choices=pytz.all_timezones, required=False)

    def validate_schedule_type(self, value):
        if value:
            value = SCHEDULE_TYPES[value]
        return value

    def validate(self, attrs):
        if "schedule_type" in attrs:
            schedule_type = attrs["schedule_type"]
        else:
            schedule_type = self.instance["schedule_type"]

        schedule = attrs.get("schedule")
        if not schedule:
            return attrs

        if schedule_type == ScheduleType.INTERVAL:
            if not isinstance(schedule, list):
                raise ValidationError("Invalid schedule for schedule_type")
            if not isinstance(schedule[0], int):
                raise ValidationError("Invalid schedule for schedule unit count (index 0)")
            if schedule[1] not in INTERVAL_NAMES:
                raise ValidationError("Invalid schedule for schedule unit name (index 1)")
        elif schedule_type == ScheduleType.CRONTAB:
            if not isinstance(schedule, str):
                raise ValidationError("Invalid schedule for schedule_type")
            schedule = schedule.strip()
            if schedule.startswith("@"):
                try:
                    schedule = NONSTANDARD_CRONTAB_SCHEDULES[schedule]
                except KeyError:
                    raise ValidationError("Schedule was not parseable")
            if not croniter.is_valid(schedule):
                raise ValidationError("Schedule was not parseable")
            attrs["schedule"] = schedule
        return attrs


class MonitorValidator(serializers.Serializer):
    project = ProjectField(scope="project:read")
    name = serializers.CharField()
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50, required=False)
    status = serializers.ChoiceField(
        choices=list(zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys())), default="active"
    )
    type = serializers.ChoiceField(choices=list(zip(MONITOR_TYPES.keys(), MONITOR_TYPES.keys())))
    config = ObjectField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
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
        config = instance.get("config", {})
        config.update(validated_data.get("config", {}))
        instance.update(validated_data)
        if "config" in instance or "config" in validated_data:
            instance["config"] = config
        return instance

    def create(self, validated_data):
        return validated_data


class MonitorCheckInValidator(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ("ok", CheckInStatus.OK),
            ("error", CheckInStatus.ERROR),
            ("in_progress", CheckInStatus.IN_PROGRESS),
        )
    )
    duration = EmptyIntegerField(required=False, allow_null=True)
    environment = serializers.CharField(required=False, allow_null=True)
