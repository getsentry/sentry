from croniter import croniter
from django.core.exceptions import ValidationError
from django.utils.timezone import pytz
from django.utils.translation import ugettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.monitors.models import CheckInStatus, Monitor, MonitorStatus, MonitorType, ScheduleType

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


class CronJobConfigValidator(serializers.Serializer):
    schedule_type = serializers.ChoiceField(
        choices=list(zip(SCHEDULE_TYPES.keys(), SCHEDULE_TYPES.keys())), required=False
    )
    """
    Currently supports "crontab" or "interval"
    """

    schedule = ObjectField()
    """
    Varies depending on the schedule_type. Is either a crontab string, or a 2
    element tuple for intervals (e.g. [1, 'day'])

    It is also possible to pass an object with the following formats

    >>> { "type": "interval", "value": 5, "unit": "day", }
    >>> { "type": "crontab", "value": "0 * * * *", }

    When using this format the `schedule_type` is not required
    """

    checkin_margin = EmptyIntegerField(required=False, allow_null=True, default=None)
    """
    How long (in minutes) after the expected checkin time will we wait until we
    consider the checkin to have been missed.
    """

    max_runtime = EmptyIntegerField(required=False, allow_null=True, default=None)
    """
    How long (in minutes) is the checkin allowed to run for in
    CheckInStatus.IN_PROGRESS before it is considered failed.
    """

    timezone = serializers.ChoiceField(choices=pytz.all_timezones, required=False)
    """
    tz database style timezone string
    """

    def validate_schedule_type(self, value):
        if value:
            value = SCHEDULE_TYPES[value]
        return value

    def validate(self, attrs):
        if "schedule_type" in attrs:
            schedule_type = attrs["schedule_type"]
        elif self.instance:
            schedule_type = self.instance.get("schedule_type")
        else:
            schedule_type = None

        schedule = attrs.get("schedule")
        if not schedule:
            return attrs

        # Translate alternative schedule type key
        if isinstance(schedule, dict) and schedule.get("type"):
            schedule_type = schedule.get("type")
            schedule_type = SCHEDULE_TYPES.get(schedule_type)

        if schedule_type is None:
            raise ValidationError("Missing or invalid schedule type")

        if schedule_type == ScheduleType.INTERVAL:
            # Translate alternative style schedule configuration
            if isinstance(schedule, dict):
                schedule = [schedule.get("value"), schedule.get("unit")]

            if not isinstance(schedule, list):
                raise ValidationError("Invalid schedule for for 'interval' type")
            if not isinstance(schedule[0], int):
                raise ValidationError("Invalid schedule for schedule unit count")
            if schedule[1] not in INTERVAL_NAMES:
                raise ValidationError("Invalid schedule for schedule unit name")
        elif schedule_type == ScheduleType.CRONTAB:
            # Translate alternative style schedule configuration
            if isinstance(schedule, dict):
                schedule = schedule.get("value")

            if not isinstance(schedule, str):
                raise ValidationError("Invalid schedule for 'crontab' type")
            schedule = schedule.strip()
            if schedule.startswith("@"):
                try:
                    schedule = NONSTANDARD_CRONTAB_SCHEDULES[schedule]
                except KeyError:
                    raise ValidationError("Schedule was not parseable")
            if not croniter.is_valid(schedule):
                raise ValidationError("Schedule was not parseable")
        attrs["schedule"] = schedule
        attrs["schedule_type"] = schedule_type
        return attrs


class MonitorValidator(serializers.Serializer):
    project = ProjectField(scope="project:read")
    name = serializers.CharField()
    slug = serializers.RegexField(
        r"^[a-zA-Z0-9_-]+$",
        max_length=50,
        required=False,
        error_messages={
            "invalid": _("Invalid monitor slug. Must match the pattern [a-zA-Z0-9_-]+")
        },
    )
    status = serializers.ChoiceField(
        choices=list(zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys())),
        default="active",
    )
    type = serializers.ChoiceField(choices=list(zip(MONITOR_TYPES.keys(), MONITOR_TYPES.keys())))
    config = ObjectField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        monitor_type = self.instance["type"] if self.instance else self.initial_data.get("type")

        if monitor_type in MONITOR_TYPES:
            monitor_type = MONITOR_TYPES[monitor_type]
        if monitor_type == MonitorType.CRON_JOB:
            validator = CronJobConfigValidator(
                instance=self.instance.get("config", {}) if self.instance else {},
                data=attrs.get("config", {}),
                partial=self.partial,
            )
            validator.is_valid(raise_exception=True)
            attrs["config"] = validator.validated_data
        elif not monitor_type:
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

    def validate_slug(self, value):
        # Ignore if slug is equal to current value
        if not value or (self.instance and value == self.instance.get("slug")):
            return value

        if Monitor.objects.filter(
            slug=value, organization_id=self.context["organization"].id
        ).exists():
            raise ValidationError(f'The slug "{value}" is already in use.')

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
    monitor_config = ObjectField(required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # Support specifying monitor configuration via a check-in
        #
        # NOTE: Most monitor attributes are contextual (project, slug, etc),
        #       the monitor config is passed in via this checkin serializer's
        #       monitor_config attribute.
        monitor_config = attrs.get("monitor_config")
        if monitor_config:
            project = self.context["project"]

            # Use context to complete the full monitor validator object
            monitor_validator = MonitorValidator(
                data={
                    "type": "cron_job",
                    "name": self.context["monitor_slug"],
                    "slug": self.context["monitor_slug"],
                    "project": project.slug,
                    "config": monitor_config,
                },
                context={
                    "organization": project.organization,
                    "access": self.context["request"].access,
                },
            )
            monitor_validator.is_valid(raise_exception=True)

            # Drop the `monitor_config` attribute favor in favor of the fully
            # validated monitor data
            attrs["monitor"] = monitor_validator.validated_data
            del attrs["monitor_config"]

        return attrs
