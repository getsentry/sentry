import re
from typing import Any, Literal

import jsonschema
import sentry_sdk
from cronsim import CronSimError
from django.core.exceptions import ValidationError
from django.db.models import F
from django.db.models.functions import TruncMinute
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from rest_framework.fields import empty

from sentry import audit_log, quotas
from sentry.api.fields.actor import ActorField
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.constants import DataCategory, ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.db.models.fields.slug import DEFAULT_SLUG_MAX_LENGTH
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.models.project import Project
from sentry.monitors.constants import MAX_MARGIN, MAX_THRESHOLD, MAX_TIMEOUT
from sentry.monitors.logic.monitor_environment import update_monitor_environment
from sentry.monitors.models import (
    MONITOR_CONFIG,
    CheckInStatus,
    CronMonitorDataSourceHandler,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorLimitsExceeded,
    ScheduleType,
    check_organization_monitor_limit,
    get_cron_monitor,
)
from sentry.monitors.schedule import get_next_schedule, get_prev_schedule
from sentry.monitors.types import CrontabSchedule, slugify_monitor_slug
from sentry.monitors.utils import (
    create_issue_alert_rule,
    ensure_cron_detector,
    get_checkin_margin,
    get_max_runtime,
    signal_monitor_created,
    update_issue_alert_rule,
)
from sentry.utils.audit import create_audit_entry
from sentry.utils.dates import AVAILABLE_TIMEZONES
from sentry.utils.outcomes import Outcome
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataSourceValidator,
    BaseDetectorTypeValidator,
)
from sentry.workflow_engine.models import Detector

MONITOR_STATUSES = {
    "active": ObjectStatus.ACTIVE,
    "disabled": ObjectStatus.DISABLED,
}
MONITOR_STATUSES_REVERSE = {val: key for key, val in MONITOR_STATUSES.items()}

SCHEDULE_TYPES = {
    "crontab": ScheduleType.CRONTAB,
    "interval": ScheduleType.INTERVAL,
}
SCHEDULE_TYPES_REVERSE = {val: key for key, val in SCHEDULE_TYPES.items()}

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


@extend_schema_field(OpenApiTypes.ANY)
class ScheduleField(ObjectField):
    """
    DRF's default Field.get_value() doesn't handle QueryDict
    multi-values for interval schedules.

    For example, we want the following query params:
      ?schedule=1&schedule=hour
    to be interpreted as:
      [1, "hour"]
    """

    def get_value(self, dictionary: Any) -> Any:
        if hasattr(dictionary, "getlist"):
            values = dictionary.getlist(self.field_name)
            if not values:
                return empty
            if len(values) == 1:
                return values[0]

            count: Any = values[0]
            try:
                count = int(values[0])
            except (TypeError, ValueError):
                # We let the validator surface a consistent error message.
                pass

            return [count, values[1]]

        return super().get_value(dictionary)


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

    schedule = ScheduleField(
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
        max_value=MAX_MARGIN,
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
            self.instance = self.parent.instance.config
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
            schedule_type = SCHEDULE_TYPES.get(schedule["type"])

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
    config = ConfigValidator(help_text="The configuration for the monitor.")
    alert_rule = MonitorAlertRuleValidator(required=False)

    def validate(self, attrs):
        # When creating a new monitor, check if we would exceed the organization limit
        if not self.instance:
            organization = self.context["organization"]
            try:
                check_organization_monitor_limit(organization.id)
            except MonitorLimitsExceeded as e:
                raise serializers.ValidationError(str(e))
        return attrs

    def validate_status(self, value):
        status = MONITOR_STATUSES.get(value, value)
        monitor = self.context.get("monitor")

        # Activating a monitor may only be done if the monitor may be assigned
        # a seat, otherwise fail with the reason it cannot.
        #
        # XXX: This check will ONLY be performed when a monitor is provided via
        #      context. It is the caller's responsibility to ensure that a
        #      monitor is provided in context for this to be validated.
        if status == ObjectStatus.ACTIVE and monitor:
            result = quotas.backend.check_assign_seat(DataCategory.MONITOR_SEAT, monitor)
            if not result.assignable:
                raise ValidationError(result.reason)

        return status

    def validate_slug(self, value):
        if not value:
            return value

        value = slugify_monitor_slug(value)
        # Ignore if slug is equal to current value
        if self.instance and value == self.instance.slug:
            return value

        if Monitor.objects.filter(
            slug=value, organization_id=self.context["organization"].id
        ).exists():
            raise ValidationError(f'The slug "{value}" is already in use.')
        return value

    def create(self, validated_data):
        project = validated_data.get("project", self.context.get("project"))
        organization = self.context["organization"]

        owner = validated_data.get("owner")
        owner_user_id = None
        owner_team_id = None
        if owner and owner.is_user:
            owner_user_id = owner.id
        elif owner and owner.is_team:
            owner_team_id = owner.id

        monitor = Monitor.objects.create(
            project_id=project.id if project else self.context["project"].id,
            organization_id=organization.id,
            owner_user_id=owner_user_id,
            owner_team_id=owner_team_id,
            name=validated_data["name"],
            slug=validated_data.get("slug"),
            status=validated_data["status"],
            config=validated_data["config"],
        )

        # When called from the new detector flow, skip detector and quota operations
        # since they're handled at a higher level by the detector validator
        from_detector_flow = self.context.get("from_detector_flow", False)

        if not from_detector_flow:
            detector = ensure_cron_detector(monitor)
            assert detector

            # Attempt to assign a seat for this monitor
            seat_outcome = quotas.backend.assign_seat(DataCategory.MONITOR_SEAT, monitor)
            if seat_outcome != Outcome.ACCEPTED:
                detector.update(enabled=False)
                monitor.update(status=ObjectStatus.DISABLED)

        request = self.context["request"]
        signal_monitor_created(project, request.user, False, monitor, request)
        validated_issue_alert_rule = validated_data.get("alert_rule")
        if validated_issue_alert_rule:
            issue_alert_rule_id = create_issue_alert_rule(
                request, project, monitor, validated_issue_alert_rule
            )

            if issue_alert_rule_id:
                config = monitor.config
                config["alert_rule_id"] = issue_alert_rule_id
                monitor.update(config=config)
        return monitor

    def update(self, instance, validated_data):
        """
        Update an existing Monitor instance.
        """
        if "project" in validated_data and validated_data["project"].id != instance.project_id:
            raise serializers.ValidationError(
                {"detail": {"message": "existing monitors may not be moved between projects"}}
            )

        existing_config = instance.config.copy()
        existing_margin = existing_config.get("checkin_margin")
        existing_max_runtime = existing_config.get("max_runtime")
        existing_schedule_type = existing_config.get("schedule_type")
        existing_schedule = existing_config.get("schedule")
        existing_slug = instance.slug

        params: dict[str, Any] = {}
        if "owner" in validated_data:
            owner = validated_data["owner"]
            params["owner_user_id"] = None
            params["owner_team_id"] = None
            if owner and owner.is_user:
                params["owner_user_id"] = owner.id
            elif owner and owner.is_team:
                params["owner_team_id"] = owner.id

        if "name" in validated_data:
            params["name"] = validated_data["name"]
        if "slug" in validated_data:
            params["slug"] = validated_data["slug"]
        if "status" in validated_data:
            params["status"] = validated_data["status"]
        if "is_muted" in validated_data:
            params["is_muted"] = validated_data["is_muted"]
        if "config" in validated_data:
            merged_config = instance.config.copy()
            merged_config.update(validated_data["config"])

            try:
                jsonschema.validate(merged_config, MONITOR_CONFIG)
            except jsonschema.ValidationError as e:
                raise serializers.ValidationError({"config": f"Invalid config: {e.message}"})

            params["config"] = merged_config

        if "status" in params:
            # Attempt to assign a monitor seat
            if params["status"] == ObjectStatus.ACTIVE and instance.status != ObjectStatus.ACTIVE:
                outcome = quotas.backend.assign_seat(DataCategory.MONITOR_SEAT, instance)
                # The MonitorValidator checks if a seat assignment is available.
                # This protects against a race condition
                if outcome != Outcome.ACCEPTED:
                    raise serializers.ValidationError(
                        {"status": "Failed to enable monitor due to quota limits"}
                    )

            # Attempt to unassign the monitor seat
            if (
                params["status"] == ObjectStatus.DISABLED
                and instance.status != ObjectStatus.DISABLED
            ):
                quotas.backend.disable_seat(DataCategory.MONITOR_SEAT, instance)

        # Forward propagate is_muted to all monitor environments when changed
        is_muted = params.pop("is_muted", None)
        if is_muted is not None:
            MonitorEnvironment.objects.filter(monitor_id=instance.id).update(is_muted=is_muted)

        if params:
            instance.update(**params)
            create_audit_entry(
                request=self.context["request"],
                organization_id=instance.organization_id,
                target_object=instance.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=instance.get_audit_log_data(),
            )

        # Update monitor slug in billing
        if "slug" in params:
            quotas.backend.update_monitor_slug(existing_slug, params["slug"], instance.project_id)

        if "config" in validated_data:
            # Use the merged config from the instance (not the partial config from the request)
            # to avoid false positives when comparing against existing values
            updated_config = instance.config
            checkin_margin = updated_config.get("checkin_margin")
            if checkin_margin != existing_margin:
                MonitorEnvironment.objects.filter(monitor_id=instance.id).update(
                    next_checkin_latest=F("next_checkin") + get_checkin_margin(checkin_margin)
                )

            max_runtime = updated_config.get("max_runtime")
            if max_runtime != existing_max_runtime:
                MonitorCheckIn.objects.filter(
                    monitor_id=instance.id, status=CheckInStatus.IN_PROGRESS
                ).update(timeout_at=TruncMinute(F("date_added")) + get_max_runtime(max_runtime))

            # If the schedule changed, recompute next_checkin and next_checkin_latest for all environments
            schedule_type = updated_config.get("schedule_type")
            schedule = updated_config.get("schedule")
            if schedule_type != existing_schedule_type or schedule != existing_schedule:
                now = timezone.now()
                for monitor_env in MonitorEnvironment.objects.filter(monitor_id=instance.id):
                    # Use last_checkin if available, otherwise use current time
                    last_checkin = monitor_env.last_checkin or now
                    update_monitor_environment(monitor_env, last_checkin, now)

        # Update alert rule after in case slug or name changed
        if "alert_rule" in validated_data:
            alert_rule_data = validated_data["alert_rule"]
            request = self.context.get("request")
            if not request:
                return instance

            project = Project.objects.get(id=instance.project_id)

            # Check to see if rule exists
            issue_alert_rule = instance.get_issue_alert_rule()
            # If rule exists, update as necessary
            if issue_alert_rule:
                issue_alert_rule_id = update_issue_alert_rule(
                    request, project, instance, issue_alert_rule, alert_rule_data
                )
            # If rule does not exist, create
            else:
                # Type assertion for mypy - create_issue_alert_rule expects AuthenticatedHttpRequest
                # but in tests we might have a regular Request object
                issue_alert_rule_id = create_issue_alert_rule(
                    request, project, instance, alert_rule_data
                )

            if issue_alert_rule_id:
                # If config is not sent, use existing config to update alert_rule_id
                instance.config["alert_rule_id"] = issue_alert_rule_id
                instance.update(config=instance.config)

        return instance


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
    contexts = ContextsValidator(required=False, allow_null=True)


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


class MonitorDataSourceValidator(BaseDataSourceValidator[Monitor]):
    """
    Data source validator for cron monitors.

    This handles creating/updating the Monitor when a detector is created/updated.
    """

    name = serializers.CharField(
        max_length=128, required=False, help_text="Name of the monitor. Used for notifications."
    )
    slug = serializers.SlugField(
        max_length=50,
        required=False,
        help_text="Uniquely identifies your monitor within your organization.",
    )
    status = serializers.CharField(required=False)
    owner = serializers.CharField(required=False, allow_null=True)
    is_muted = serializers.BooleanField(required=False)
    config = serializers.JSONField(required=True)

    class Meta:
        model = Monitor
        fields = ["name", "slug", "status", "owner", "is_muted", "config"]

    def validate_status(self, value):
        if isinstance(value, str) and value.isdigit():
            return MONITOR_STATUSES_REVERSE[int(value)]
        return value

    def validate_config(self, value):
        if value and "schedule_type" in value:
            schedule_type = value["schedule_type"]
            if isinstance(schedule_type, int):
                value["schedule_type"] = SCHEDULE_TYPES_REVERSE[int(schedule_type)]
        return value

    @property
    def data_source_type_handler(self) -> type[CronMonitorDataSourceHandler]:
        return CronMonitorDataSourceHandler

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs.get("name") and not attrs.get("slug"):
            raise serializers.ValidationError("Either name or slug must be provided")

        if not attrs.get("name") and attrs.get("slug"):
            attrs["name"] = attrs["slug"]

        if attrs.get("name") and not attrs.get("slug") and not self.instance:
            attrs["slug"] = slugify_monitor_slug(attrs["name"])

        monitor_data = attrs.copy()

        if "is_muted" in monitor_data:
            monitor_data["isMuted"] = monitor_data.pop("is_muted")

        monitor_data["project"] = self.context["project"].slug

        monitor_instance = None
        if self.instance:
            monitor_instance = self.instance

        monitor_validator = MonitorValidator(
            data=monitor_data,
            context={**self.context, "from_detector_flow": True},
            instance=monitor_instance,
            partial=self.partial,
        )

        if not monitor_validator.is_valid():
            raise serializers.ValidationError(monitor_validator.errors)

        attrs["_monitor_validator"] = monitor_validator

        validated = monitor_validator.validated_data
        if "name" in validated:
            attrs["name"] = validated["name"]
        if "slug" in validated:
            attrs["slug"] = validated["slug"]
        if "config" in validated:
            attrs["config"] = validated["config"]
        if "status" in validated:
            attrs["status"] = validated["status"]
        if "owner" in validated:
            attrs["owner"] = validated["owner"]
        if "is_muted" in validated:
            attrs["is_muted"] = validated["is_muted"]

        return super().validate(attrs)

    def create_source(self, validated_data: dict[str, Any]) -> Monitor:
        """Create the Monitor using MonitorValidator."""
        monitor_validator = validated_data.pop("_monitor_validator")
        with in_test_hide_transaction_boundary():
            return monitor_validator.create(monitor_validator.validated_data)

    def update(self, instance: Monitor, validated_data: dict[str, Any]) -> Monitor:
        monitor_validator = validated_data.pop("_monitor_validator")
        with in_test_hide_transaction_boundary():
            return monitor_validator.update(instance, monitor_validator.validated_data)


class MonitorDataSourceListField(serializers.ListField):
    """
    Custom ListField that properly binds the Monitor instance to child validators.

    When updating a detector, we need to ensure the MonitorDataSourceValidator
    knows about the existing Monitor so slug validation works correctly.
    """

    def to_internal_value(self, data):
        # If we're updating (parent has instance), bind the Monitor instance to child validator
        if hasattr(self.parent, "instance") and self.parent.instance:
            detector = self.parent.instance
            monitor = get_cron_monitor(detector)

            # Bind the monitor instance so slug validation recognizes this as an update
            # Type ignore: self.child is typed as Field but is actually MonitorDataSourceValidator
            self.child.instance = monitor  # type: ignore[attr-defined]
            self.child.partial = self.parent.partial  # type: ignore[attr-defined]

        return super().to_internal_value(data)


class MonitorIncidentDetectorValidator(BaseDetectorTypeValidator):
    """
    Validator for monitor incident detection configuration.

    This is a lightweight validator that delegates Monitor creation/update to the
    data_source field (MonitorDataSourceValidator).
    """

    enforce_single_datasource = True
    data_sources = MonitorDataSourceListField(child=MonitorDataSourceValidator(), required=False)

    def validate_enabled(self, value: bool) -> bool:
        """
        Validate that enabling a detector is allowed based on seat availability.
        """
        detector = self.instance
        if detector and value and not detector.enabled:
            monitor = get_cron_monitor(detector)
            result = quotas.backend.check_assign_seat(DataCategory.MONITOR_SEAT, monitor)
            if not result.assignable:
                raise serializers.ValidationError(result.reason)
        return value

    def create(self, validated_data):
        detector = super().create(validated_data)

        with in_test_hide_transaction_boundary():
            monitor = get_cron_monitor(detector)

        # Try to assign a seat for the monitor
        seat_outcome = quotas.backend.assign_seat(DataCategory.MONITOR_SEAT, monitor)
        if seat_outcome != Outcome.ACCEPTED:
            detector.update(enabled=False)
            monitor.update(status=ObjectStatus.DISABLED)

        return detector

    def update(self, instance: Detector, validated_data: dict[str, Any]) -> Detector:
        was_enabled = instance.enabled
        enabled = validated_data.get("enabled", was_enabled)

        # Handle enable/disable seat operations
        if was_enabled != enabled:
            monitor = get_cron_monitor(instance)

            if enabled:
                seat_outcome = quotas.backend.assign_seat(DataCategory.MONITOR_SEAT, monitor)
                # We should have already validated that a seat was available in
                # validate_enabled, avoid races by failing here if we can't
                # accept the seat
                if seat_outcome != Outcome.ACCEPTED:
                    raise serializers.ValidationError("Failed to update monitor")
                monitor.update(status=ObjectStatus.ACTIVE)
            else:
                quotas.backend.disable_seat(DataCategory.MONITOR_SEAT, monitor)
                monitor.update(status=ObjectStatus.DISABLED)

        super().update(instance, validated_data)

        data_source_data = None
        if "data_sources" in validated_data:
            data_source_data = validated_data.pop("data_sources")[0]

        if data_source_data is not None:
            monitor = get_cron_monitor(instance)

            monitor_validator = MonitorDataSourceValidator(
                instance=monitor,
                data=data_source_data,
                context=self.context,
                partial=True,
            )

            if monitor_validator.is_valid(raise_exception=True):
                with in_test_hide_transaction_boundary():
                    monitor_validator.save()

        return instance

    def delete(self) -> None:
        assert self.instance is not None
        monitor = get_cron_monitor(self.instance)

        # Remove the seat immediately
        quotas.backend.remove_seat(DataCategory.MONITOR_SEAT, monitor)

        super().delete()
