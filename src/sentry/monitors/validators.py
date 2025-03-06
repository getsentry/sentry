import re
from typing import Literal

import sentry_sdk
from cronsim import CronSimError
from django.core.exceptions import ValidationError
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from sentry import quotas
from sentry.api.fields.actor import ActorField
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.db.models.fields.slug import DEFAULT_SLUG_MAX_LENGTH
from sentry.monitors.constants import MAX_THRESHOLD, MAX_TIMEOUT
from sentry.monitors.models import CheckInStatus, Monitor, MonitorType, ScheduleType
from sentry.monitors.schedule import get_next_schedule, get_prev_schedule
from sentry.monitors.types import CrontabSchedule
from sentry.utils.dates import AVAILABLE_TIMEZONES

MONITOR_TYPES = {"cron_job": MonitorType.CRON_JOB}

MONITOR_STATUSES = {
    "active": ObjectStatus.ACTIVE,
    "disabled": ObjectStatus.DISABLED,
}

SCHEDULE_TYPES = {
    "crontab": ScheduleType.CRONTAB,
    "interval": ScheduleType.INTERVAL,
}

IntervalNames = Literal["year", "month", "week", "day", "hour", "minute"]

INTERVAL_NAMES = ("year", "month", "week", "day", "hour", "minute")

CRONTAB_WHITESPACE = re.compile(r"\s+")

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


class MonitorAlertRuleTargetValidator(serializers.Serializer):
    target_identifier = serializers.IntegerField(help_text="ID of target object")
    target_type = serializers.CharField(help_text="One of [Member, Team]")


class MonitorAlertRuleValidator(serializers.Serializer):
    environment = serializers.CharField(
        max_length=64, required=False, allow_null=True, help_text="Name of the environment"
    )
    targets = MonitorAlertRuleTargetValidator(
        many=True,
        help_text="Array of dictionaries with information of the user or team to be notified",
    )


class MissedMarginField(EmptyIntegerField):
    def to_internal_value(self, value):
        value = super().to_internal_value(value)

        # XXX(epurkhiser): As part of GH-56526 we changed the minimum value
        # allowed for the checkin_margin to 1 from 0. Some monitors may still
        # be upserting monitors with a 0 for the checkin_margin.
        #
        # In order to not break those checkins we will still allow a value of
        # 0, but we will transform it to 1.
        if value == 0:
            # Capture this as a sentry error so we can understand if we can
            # remove this code once very few people send upserts like this.
            sentry_sdk.capture_message("Cron Monitor recieved upsert with checkin_margin = 0")
            return 1
        return value


class ConfigValidator(serializers.Serializer):
    schedule_type = serializers.ChoiceField(
        choices=list(zip(SCHEDULE_TYPES.keys(), SCHEDULE_TYPES.keys())),
        help_text='Currently supports "crontab" or "interval"',
        # The schedule_type IS required when the `type` is not part of the
        # `schedule` object field (see self.validate). We cannot mark it as
        # required here however since this field may be left out when using the
        # alternative schedule format.
        required=False,
    )

    schedule = ObjectField(
        help_text="Varies depending on the schedule_type. Is either a crontab string, or a 2 element tuple for intervals (e.g. [1, 'day'])",
    )
    """
    It is also possible to pass an object with the following formats

    >>> { "type": "interval", "value": 5, "unit": "day", }
    >>> { "type": "crontab", "value": "0 * * * *", }

    When using this format the `schedule_type` is not required
    """

    checkin_margin = MissedMarginField(
        required=False,
        allow_null=True,
        default=None,
        help_text="How long (in minutes) after the expected checkin time will we wait until we consider the checkin to have been missed.",
        min_value=1,
    )

    max_runtime = EmptyIntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="How long (in minutes) is the checkin allowed to run for in CheckInStatus.IN_PROGRESS before it is considered failed.",
        min_value=1,
        max_value=MAX_TIMEOUT,
    )

    timezone = serializers.ChoiceField(
        choices=sorted(AVAILABLE_TIMEZONES),
        required=False,
        allow_blank=True,
        help_text="tz database style timezone string",
    )

    failure_issue_threshold = EmptyIntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="How many consecutive missed or failed check-ins in a row before creating a new issue.",
        min_value=1,
        max_value=MAX_THRESHOLD,
    )

    recovery_threshold = EmptyIntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="How many successful check-ins in a row before resolving an issue.",
        min_value=1,
        max_value=MAX_THRESHOLD,
    )

    def bind(self, *args, **kwargs):
        super().bind(*args, **kwargs)
        # Inherit instance data when used as a nested serializer
        if self.parent.instance:
            self.instance = self.parent.instance.get("config")
        self.partial = self.parent.partial

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

        # Remove blank timezone values
        if attrs.get("timezone") == "":
            del attrs["timezone"]

        schedule = attrs.get("schedule")
        if not schedule:
            return attrs

        # Translate alternative schedule type key
        if isinstance(schedule, dict) and schedule.get("type"):
            schedule_type = schedule.get("type")
            schedule_type = SCHEDULE_TYPES.get(schedule_type)

        if schedule_type is None:
            raise ValidationError({"schedule_type": "Missing or invalid schedule type"})

        if schedule_type == ScheduleType.INTERVAL:
            # Translate alternative style schedule configuration
            if isinstance(schedule, dict):
                schedule = [schedule.get("value"), schedule.get("unit")]

            if not isinstance(schedule, list):
                raise ValidationError({"schedule": "Invalid schedule for for 'interval' type"})
            if not isinstance(schedule[0], int):
                raise ValidationError({"schedule": "Invalid schedule for schedule unit count"})
            if schedule[0] <= 0:
                raise ValidationError({"schedule": "Interval must be greater than zero"})
            if schedule[1] not in INTERVAL_NAMES:
                raise ValidationError({"schedule": "Invalid schedule for schedule unit name"})
        elif schedule_type == ScheduleType.CRONTAB:
            # Translate alternative style schedule configuration
            if isinstance(schedule, dict):
                schedule = schedule.get("value")

            if not isinstance(schedule, str):
                raise ValidationError({"schedule": "Invalid schedule for 'crontab' type"})

            # normalize whitespace
            schedule = re.sub(CRONTAB_WHITESPACE, " ", schedule).strip()

            if schedule.startswith("@"):
                try:
                    schedule = NONSTANDARD_CRONTAB_SCHEDULES[schedule]
                except KeyError:
                    raise ValidationError({"schedule": "Schedule was not parseable"})

            # Do not support 6 or 7 field crontabs
            if len(schedule.split()) > 5:
                raise ValidationError({"schedule": "Only 5 field crontab syntax is supported"})

            # Validate the expression and ensure we can traverse forward / back
            now = timezone.now()
            try:
                get_next_schedule(now, CrontabSchedule(schedule))
                get_prev_schedule(now, now, CrontabSchedule(schedule))
            except CronSimError:
                raise ValidationError({"schedule": "Schedule is invalid"})

            # Do not support 6 or 7 field crontabs
            if len(schedule.split()) > 5:
                raise ValidationError({"schedule": "Only 5 field crontab syntax is supported"})

        attrs["schedule"] = schedule
        attrs["schedule_type"] = schedule_type
        return attrs


@extend_schema_serializer(exclude_fields=["alert_rule"])
class MonitorValidator(CamelSnakeSerializer):
    project = ProjectField(
        scope="project:read",
        required=True,
        help_text="The project slug to associate the monitor to.",
    )
    name = serializers.CharField(
        max_length=128,
        help_text="Name of the monitor. Used for notifications. If not set the slug will be derived from your monitor name.",
    )
    slug = SentrySerializerSlugField(
        max_length=DEFAULT_SLUG_MAX_LENGTH,
        required=False,
        help_text="Uniquely identifies your monitor within your organization. Changing this slug will require updates to any instrumented check-in calls.",
    )
    status = serializers.ChoiceField(
        choices=list(zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys())),
        default="active",
        help_text="Status of the monitor. Disabled monitors will not accept events and will not count towards the monitor quota.",
    )
    owner = ActorField(
        required=False,
        allow_null=True,
        help_text="The ID of the team or user that owns the monitor. (eg. user:51 or team:6)",
    )
    is_muted = serializers.BooleanField(
        required=False,
        help_text="Disable creation of monitor incidents",
    )
    type = serializers.ChoiceField(
        choices=list(zip(MONITOR_TYPES.keys(), MONITOR_TYPES.keys())),
        required=False,
        default="cron_job",
    )
    config = ConfigValidator(help_text="The configuration for the monitor.")
    alert_rule = MonitorAlertRuleValidator(required=False)

    def validate_status(self, value):
        status = MONITOR_STATUSES.get(value, value)
        monitor = self.context.get("monitor")

        # Activating a monitor may only be done if the monitor may be assigned
        # a seat, otherwise fail with the reason it cannot.
        #
        # XXX: This check will ONLY be performed when a monitor is provided via
        #      context. It is the callers responsabiliy to ensure that a
        #      monitor is provided in context for this to be validated.
        if status == ObjectStatus.ACTIVE and monitor:
            result = quotas.backend.check_assign_monitor_seat(monitor)
            if not result.assignable:
                raise ValidationError(result.reason)

        return status

    def validate_type(self, value):
        return MONITOR_TYPES.get(value, value)

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


class TraceContextValidator(serializers.Serializer):
    trace_id = serializers.UUIDField(format="hex")


class ContextsValidator(serializers.Serializer):
    trace = TraceContextValidator(required=False)


@extend_schema_serializer(exclude_fields=["monitor_config", "contexts"])
class MonitorCheckInValidator(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ("ok", CheckInStatus.OK),
            ("error", CheckInStatus.ERROR),
            ("in_progress", CheckInStatus.IN_PROGRESS),
        ),
        help_text="The status of the job run.",
    )
    duration = EmptyIntegerField(
        required=False,
        allow_null=True,
        max_value=BoundedPositiveIntegerField.MAX_VALUE,
        min_value=0,
        help_text="Duration of the job run, in milliseconds.",
    )
    environment = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Name of the environment.",
    )
    monitor_config = ConfigValidator(required=False)
    contexts = ContextsValidator(required=False, allow_null=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # Support specifying monitor configuration via a check-in
        #
        # NOTE: Most monitor attributes are contextual (project, slug, etc),
        #       the monitor config is passed in via this checkin serializer's
        #       monitor_config attribute.
        #
        # NOTE: We have already validated the monitor_config in the
        #       ConfigValidator field, to keep things simple, we'll just stick
        #       the initial_data back into the monitor validator
        monitor_config = self.initial_data.get("monitor_config")
        if monitor_config:
            project = self.context["project"]
            instance = {}
            monitor = self.context.get("monitor", None)
            if monitor:
                instance = {
                    "name": monitor.name,
                    "slug": monitor.slug,
                    "status": monitor.status,
                    "type": monitor.type,
                    "config": monitor.config,
                    "project": project,
                }

            # Use context to complete the full monitor validator object
            monitor_validator = MonitorValidator(
                data={
                    "type": "cron_job",
                    "name": self.context["monitor_slug"],
                    "slug": self.context["monitor_slug"],
                    "project": project.slug,
                    "config": monitor_config,
                },
                instance=instance,
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


class MonitorBulkEditValidator(MonitorValidator):
    ids = serializers.ListField(
        child=serializers.UUIDField(format="hex"),
        required=True,
    )

    def validate_ids(self, value):
        if Monitor.objects.filter(
            guid__in=value, organization_id=self.context["organization"].id
        ).count() != len(value):
            raise ValidationError("Not all ids are valid for this organization.")
        return value
