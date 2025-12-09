import uuid
from collections.abc import Sequence
from typing import Any, override

import jsonschema
from django.db import router
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.fields import URLField

from sentry import audit_log, quotas
from sentry.api.fields import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import DataCategory, ObjectStatus
from sentry.models.environment import Environment
from sentry.uptime.models import (
    UptimeRegionScheduleMode,
    UptimeSubscription,
    UptimeSubscriptionDataSourceHandler,
    get_audit_log_data,
    get_uptime_subscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    MAX_MANUAL_SUBSCRIPTIONS_PER_ORG,
    MaxManualUptimeSubscriptionsReached,
    MaxUrlsForDomainReachedException,
    UptimeMonitorNoSeatAvailable,
    check_uptime_subscription_limit,
    check_url_limits,
    create_uptime_detector,
    create_uptime_subscription,
    delete_uptime_subscription,
    disable_uptime_detector,
    enable_uptime_detector,
    remove_uptime_seat,
    update_uptime_detector,
    update_uptime_subscription,
)
from sentry.uptime.types import CheckConfig, UptimeMonitorMode
from sentry.utils.audit import create_audit_entry
from sentry.utils.db import atomic_transaction
from sentry.utils.not_set import NOT_SET
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataSourceValidator,
    BaseDetectorTypeValidator,
)
from sentry.workflow_engine.models import Detector

"""
The bounding upper limit on how many uptime Detectors's can exist for a single
domain + suffix.

This takes into account subdomains by including them in the count. For example,
for the domain `sentry.io` both the hosts `subdomain-one.sentry.io` and
`subdomain-2.sentry.io` will both count towards the limit

Importantly domains like `vercel.dev` are considered TLDs as defined by the
public suffix list (PSL). See `extract_domain_parts` fo more details
"""
MAX_REQUEST_SIZE_BYTES = 1000

from sentry.uptime.types import DEFAULT_DOWNTIME_THRESHOLD, DEFAULT_RECOVERY_THRESHOLD

MONITOR_STATUSES = {
    "active": ObjectStatus.ACTIVE,
    "disabled": ObjectStatus.DISABLED,
}

HEADERS_LIST_SCHEMA = {
    "type": "array",
    "items": {
        "type": "array",
        "prefixItems": [
            {"type": "string"},
            {"type": "string"},
        ],
    },
}


def compute_http_request_size(
    method: str, url: str, headers: Sequence[tuple[str, str]], body: str | None
):
    request_line_size = len(f"{method} {url} HTTP/1.1\r\n")
    headers_size = sum(
        len(key) + len(value.encode("utf-8")) + len("\r\n") for key, value in headers
    )
    body_size = 0
    if body is not None:
        body_size = len(body.encode("utf-8")) + len("\r\n")
    return request_line_size + headers_size + body_size


def _validate_url(url):
    try:
        check_url_limits(url)
    except MaxUrlsForDomainReachedException as e:
        raise serializers.ValidationError(
            f"The domain *.{e.domain}.{e.suffix} has already been used in {e.max_urls} uptime monitoring alerts, "
            "which is the limit. You cannot create any additional alerts for this domain."
        )
    return url


def _validate_headers(headers):
    try:
        jsonschema.validate(headers, HEADERS_LIST_SCHEMA)
        return headers
    except jsonschema.ValidationError:
        raise serializers.ValidationError("Expected array of header tuples.")


def _validate_monitor_status(value):
    return MONITOR_STATUSES.get(value, ObjectStatus.ACTIVE)


def _validate_mode(mode, request_context):
    if not is_active_superuser(request_context):
        raise serializers.ValidationError("Only superusers can modify `mode`")
    try:
        return UptimeMonitorMode(mode)
    except ValueError:
        raise serializers.ValidationError(
            "Invalid mode, valid values are %s" % [item.value for item in UptimeMonitorMode]
        )


def _validate_request_size(method, url, headers, body):
    request_size = compute_http_request_size(
        method,
        url,
        headers,
        body,
    )
    if request_size > MAX_REQUEST_SIZE_BYTES:
        raise serializers.ValidationError(
            f"Request is too large, max size is {MAX_REQUEST_SIZE_BYTES} bytes"
        )


url = URLField(required=True, max_length=255)
timeout_ms = serializers.IntegerField(
    required=True,
    min_value=1000,
    max_value=60_000,
    help_text="The number of milliseconds the request will wait for a response before timing-out.",
)
method = serializers.ChoiceField(
    required=False,
    choices=UptimeSubscription.SupportedHTTPMethods.choices,
    help_text="The HTTP method used to make the check request.",
)
headers = serializers.JSONField(
    required=False,
    help_text="Additional headers to send with the check request.",
)
body = serializers.CharField(
    required=False,
    allow_null=True,
    allow_blank=True,
    help_text="The body to send with the check request.",
)
assertion = serializers.JSONField(
    required=False,
    help_text="The body to send with the check request.",
)


@extend_schema_serializer()
class UptimeTestValidator(CamelSnakeSerializer):
    url = url
    method = method
    headers = headers
    body = body
    assertion = assertion
    timeout_ms = timeout_ms
    region = serializers.CharField(
        required=True,
        allow_null=False,
        allow_blank=False,
        help_text="The region slug in which to run the assert.",
    )

    def validate(self, attrs):
        headers = []
        method = "GET"
        body = None
        url = ""

        _validate_request_size(
            attrs.get("method", method),
            attrs.get("url", url),
            attrs.get("headers", headers),
            attrs.get("body", body),
        )

        return attrs

    def validate_url(self, url):
        return _validate_url(url)

    def validate_headers(self, headers):
        return _validate_headers(headers)

    def create(self, validated_data):
        config: CheckConfig = {
            "subscription_id": uuid.uuid4().hex,
            "url": validated_data["url"],
            "interval_seconds": 3600,
            "timeout_ms": validated_data["timeout_ms"],
            "trace_sampling": False,
            # We're only going to run in the one specified region.
            "active_regions": [validated_data["region"]],
            "region_schedule_mode": UptimeRegionScheduleMode.ROUND_ROBIN.value,
        }

        if "method" in validated_data:
            config["request_method"] = validated_data["method"]
        if "headers" in validated_data:
            config["request_headers"] = validated_data["headers"]
        if "body" in validated_data:
            config["request_body"] = validated_data["body"]
        if "assertion" in validated_data:
            config["assertion"] = validated_data["assertion"]

        return config


@extend_schema_serializer()
class UptimeMonitorValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        required=True,
        max_length=128,
        help_text="Name of the uptime monitor.",
    )
    status = serializers.ChoiceField(
        choices=list(zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys())),
        default="active",
        help_text="Status of the uptime monitor. Disabled uptime monitors will not perform checks and do not count against the uptime monitor quota.",
    )
    owner = ActorField(
        required=False,
        allow_null=True,
        help_text="The ID of the team or user that owns the uptime monitor. (eg. user:51 or team:6)",
    )
    environment = serializers.CharField(
        max_length=64,
        required=False,
        allow_null=True,
        help_text="Name of the environment to create uptime issues in.",
    )
    url = url
    interval_seconds = serializers.ChoiceField(
        required=True,
        choices=UptimeSubscription.IntervalSeconds.choices,
        help_text="Time in seconds between uptime checks.",
    )
    timeout_ms = timeout_ms
    mode = serializers.IntegerField(required=False)
    method = method
    headers = headers
    trace_sampling = serializers.BooleanField(
        required=False,
        default=False,
        help_text="When enabled allows check requets to be considered for dowstream performance tracing.",
    )
    body = body
    recovery_threshold = serializers.IntegerField(
        required=False,
        default=DEFAULT_RECOVERY_THRESHOLD,
        min_value=1,
        help_text="Number of consecutive successful checks required to mark monitor as recovered.",
    )
    downtime_threshold = serializers.IntegerField(
        required=False,
        default=DEFAULT_DOWNTIME_THRESHOLD,
        min_value=1,
        help_text="Number of consecutive failed checks required to mark monitor as down.",
    )

    def validate(self, attrs):
        # When creating a new uptime monitor, check if we would exceed the organization limit
        if not self.instance:
            organization = self.context["organization"]
            try:
                check_uptime_subscription_limit(organization.id)
            except MaxManualUptimeSubscriptionsReached:
                raise serializers.ValidationError(
                    f"You may have at most {MAX_MANUAL_SUBSCRIPTIONS_PER_ORG} uptime monitors per organization"
                )

        headers = []
        method = "GET"
        body = None
        url = ""
        if self.instance:
            uptime_subscription = get_uptime_subscription(self.instance)
            headers = uptime_subscription.headers
            method = uptime_subscription.method
            body = uptime_subscription.body
            url = uptime_subscription.url

        _validate_request_size(
            attrs.get("method", method),
            attrs.get("url", url),
            attrs.get("headers", headers),
            attrs.get("body", body),
        )

        return attrs

    def validate_url(self, url):
        return _validate_url(url)

    def validate_headers(self, headers):
        return _validate_headers(headers)

    def validate_status(self, value):
        return _validate_monitor_status(value)

    def validate_mode(self, mode):
        return _validate_mode(mode, self.context["request"])

    def create(self, validated_data):
        if validated_data.get("environment") is not None:
            environment = Environment.get_or_create(
                project=self.context["project"],
                name=validated_data["environment"],
            )
        else:
            environment = None

        method_headers_body = {
            k: v for k, v in validated_data.items() if k in {"method", "headers", "body"}
        }
        detector = create_uptime_detector(
            project=self.context["project"],
            environment=environment,
            url=validated_data["url"],
            interval_seconds=validated_data["interval_seconds"],
            timeout_ms=validated_data["timeout_ms"],
            name=validated_data["name"],
            status=validated_data.get("status"),
            mode=validated_data.get("mode", UptimeMonitorMode.MANUAL),
            owner=validated_data.get("owner"),
            trace_sampling=validated_data.get("trace_sampling", False),
            recovery_threshold=validated_data["recovery_threshold"],
            downtime_threshold=validated_data["downtime_threshold"],
            **method_headers_body,
        )

        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=detector.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
            data=get_audit_log_data(detector),
        )

        return detector

    def update(self, instance: Detector, data):
        uptime_subscription = get_uptime_subscription(instance)

        url = data["url"] if "url" in data else uptime_subscription.url
        interval_seconds = (
            data["interval_seconds"]
            if "interval_seconds" in data
            else uptime_subscription.interval_seconds
        )
        timeout_ms = data["timeout_ms"] if "timeout_ms" in data else uptime_subscription.timeout_ms
        method = data["method"] if "method" in data else uptime_subscription.method
        headers = data["headers"] if "headers" in data else uptime_subscription.headers
        body = data["body"] if "body" in data else uptime_subscription.body
        name = data["name"] if "name" in data else instance.name
        owner = data["owner"] if "owner" in data else instance.owner
        trace_sampling = (
            data["trace_sampling"]
            if "trace_sampling" in data
            else uptime_subscription.trace_sampling
        )
        status = data["status"] if "status" in data else instance.status
        recovery_threshold = (
            data["recovery_threshold"]
            if "recovery_threshold" in data
            else instance.config["recovery_threshold"]
        )
        downtime_threshold = (
            data["downtime_threshold"]
            if "downtime_threshold" in data
            else instance.config["downtime_threshold"]
        )

        if "environment" in data:
            environment = Environment.get_or_create(
                project=self.context["project"],
                name=data["environment"],
            )
        else:
            environment = Environment.objects.get(
                projects=self.context["project"],
                name=instance.config["environment"],
            )

        if "mode" in data:
            raise serializers.ValidationError("Mode can only be specified on creation (for now)")

        try:
            update_uptime_detector(
                detector=instance,
                environment=environment,
                url=url,
                interval_seconds=interval_seconds,
                timeout_ms=timeout_ms,
                method=method,
                headers=headers,
                body=body,
                name=name,
                owner=owner,
                trace_sampling=trace_sampling,
                status=status,
                recovery_threshold=recovery_threshold,
                downtime_threshold=downtime_threshold,
            )
        except UptimeMonitorNoSeatAvailable as err:
            # Nest seat availability errors under status. Since this is the
            # field that will trigger seat availability errors.
            if err.result is None:
                raise serializers.ValidationError({"status": ["Cannot enable uptime monitor"]})
            else:
                raise serializers.ValidationError({"status": [err.result.reason]})
        finally:
            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=instance.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_EDIT"),
                data=get_audit_log_data(instance),
            )

        return instance


class UptimeMonitorDataSourceValidator(BaseDataSourceValidator[UptimeSubscription]):
    @property
    def data_source_type_handler(self) -> type[UptimeSubscriptionDataSourceHandler]:
        return UptimeSubscriptionDataSourceHandler

    url = URLField(required=True, max_length=255)
    interval_seconds = serializers.ChoiceField(
        required=True,
        choices=UptimeSubscription.IntervalSeconds.choices,
        help_text="Time in seconds between uptime checks.",
    )
    timeout_ms = serializers.IntegerField(
        required=True,
        min_value=1000,
        max_value=60_000,
        help_text="The number of milliseconds the request will wait for a response before timing-out.",
    )
    method = serializers.ChoiceField(
        required=False,
        choices=UptimeSubscription.SupportedHTTPMethods.choices,
        help_text="The HTTP method used to make the check request.",
    )
    headers = serializers.JSONField(
        required=False,
        help_text="Additional headers to send with the check request.",
    )
    trace_sampling = serializers.BooleanField(
        required=False,
        default=False,
        help_text="When enabled allows check requets to be considered for dowstream performance tracing.",
    )
    body = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The body to send with the check request.",
    )

    class Meta:
        model = UptimeSubscription
        fields = [
            "url",
            "headers",
            "timeout_ms",
            "method",
            "trace_sampling",
            "body",
            "interval_seconds",
        ]

    def validate_url(self, url):
        return _validate_url(url)

    def validate_headers(self, headers):
        return _validate_headers(headers)

    def validate_mode(self, mode):
        return _validate_mode(mode, self.context["request"])

    def validate(self, attrs: dict[str, Any]):
        attrs = super().validate(attrs)

        headers = []
        method = "GET"
        body = None
        url = ""
        if self.instance:
            headers = self.instance.headers
            method = self.instance.method
            body = self.instance.body
            url = self.instance.url

        _validate_request_size(
            attrs.get("method", method),
            attrs.get("url", url),
            attrs.get("headers", headers),
            attrs.get("body", body),
        )

        return attrs

    @override
    def create_source(self, validated_data: dict[str, Any]) -> UptimeSubscription:
        with atomic_transaction(using=(router.db_for_write(UptimeSubscription),)):
            uptime_subscription = create_uptime_subscription(
                url=validated_data["url"],
                interval_seconds=validated_data["interval_seconds"],
                timeout_ms=validated_data["timeout_ms"],
                trace_sampling=validated_data.get("trace_sampling", False),
                method=validated_data.get("method", "GET"),
                headers=validated_data.get("headers", None),
                body=validated_data.get("body", None),
            )
        return uptime_subscription


class UptimeDomainCheckFailureConfigValidator(CamelSnakeSerializer):
    """
    Validator for the uptime detector config field.
    """

    environment = serializers.CharField(
        max_length=64,
        required=False,
        allow_null=True,
        help_text="Name of the environment to create uptime issues in.",
    )
    recovery_threshold = serializers.IntegerField(
        required=False,
        default=DEFAULT_RECOVERY_THRESHOLD,
        min_value=1,
        help_text="Number of consecutive successful checks required to mark monitor as recovered.",
    )
    downtime_threshold = serializers.IntegerField(
        required=False,
        default=DEFAULT_DOWNTIME_THRESHOLD,
        min_value=1,
        help_text="Number of consecutive failed checks required to mark monitor as down.",
    )
    mode = serializers.IntegerField(required=False, default=UptimeMonitorMode.MANUAL)

    def bind(self, field_name, parent):
        super().bind(field_name, parent)
        if not parent:
            return
        if parent.partial:
            self.partial = True
        if parent.instance and hasattr(parent.instance, field_name):
            self.instance = getattr(parent.instance, field_name)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """
        Handle mode validation and automatic mode switching.

        Rules:
        1. Non-superusers updating AUTO_DETECTED monitors: Always switch to MANUAL
        2. Non-superusers trying to set non-MANUAL mode: Reject with validation error
        3. Superusers: Can set any mode
        4. Partial updates: Merge with existing config to preserve unspecified fields
        """
        request = self.context["request"]
        is_superuser = is_active_superuser(request)

        # On partial updates, merge attrs with existing config to preserve unspecified fields
        # DRF's partial=True makes fields optional but doesn't auto-merge with instance data
        if self.instance and self.partial:
            existing_config = self.instance.copy()
            existing_config.update(attrs)
            attrs = existing_config

        # On updates, check if we need to auto-switch from AUTO_DETECTED to MANUAL
        if self.instance:
            current_mode = self.instance.get("mode")

            # For full updates, preserve the mode if it wasn't in the request
            # DRF includes fields with defaults even when not provided, so we
            # need to check the parent's initial_data to see if mode was
            # actually provided
            mode_in_request = (
                self.parent
                and hasattr(self.parent, "initial_data")
                and "mode" in self.parent.initial_data.get("config", {})
            )

            # If mode wasn't explicitly provided, use the current mode
            if not mode_in_request:
                attrs["mode"] = current_mode

            requested_mode = attrs.get("mode")

            # If currently AUTO_DETECTED and not a superuser, force switch to MANUAL
            if current_mode != UptimeMonitorMode.MANUAL and not is_superuser:
                attrs["mode"] = UptimeMonitorMode.MANUAL

            # If non-superuser is trying to change mode to something other than MANUAL
            elif (
                mode_in_request
                and requested_mode != current_mode
                and requested_mode != UptimeMonitorMode.MANUAL
                and not is_superuser
            ):
                raise serializers.ValidationError({"mode": ["Only superusers can modify `mode`"]})
        else:
            # On create, non-superusers can only set MANUAL mode
            if "mode" in attrs and attrs["mode"] != UptimeMonitorMode.MANUAL and not is_superuser:
                raise serializers.ValidationError({"mode": ["Only superusers can modify `mode`"]})

        return attrs


class UptimeDomainCheckFailureValidator(BaseDetectorTypeValidator):
    enforce_single_datasource = True
    data_sources = serializers.ListField(child=UptimeMonitorDataSourceValidator(), required=False)
    config = UptimeDomainCheckFailureConfigValidator(required=False)  # type: ignore[assignment]

    def validate_enabled(self, value: bool) -> bool:
        """
        Validate that enabling a detector is allowed based on seat availability.

        This check will ONLY be performed when a detector instance is provided via
        context (i.e., during updates). For creation, seat assignment is handled
        in the create() method after the detector is created.
        """
        detector = self.instance

        # Only validate on updates when trying to enable a currently disabled detector
        if detector and value and not detector.enabled:
            result = quotas.backend.check_assign_seat(DataCategory.UPTIME, detector)
            if not result.assignable:
                raise serializers.ValidationError(result.reason)

        return value

    def create(self, validated_data):
        detector = super().create(validated_data)

        try:
            enable_uptime_detector(detector, ensure_assignment=True)
        except UptimeMonitorNoSeatAvailable:
            # No need to do anything if we failed to handle seat
            # assignment. The monitor will be created, but not enabled
            pass

        return detector

    def update(self, instance: Detector, validated_data: dict[str, Any]) -> Detector:
        # Handle seat management when enabling/disabling
        was_enabled = instance.enabled
        enabled = validated_data.get("enabled", was_enabled)

        if was_enabled != enabled:
            if enabled:
                enable_uptime_detector(instance)
            else:
                disable_uptime_detector(instance)

        super().update(instance, validated_data)

        data_source = None
        if "data_sources" in validated_data:
            data_source = validated_data.pop("data_sources")[0]

        if data_source is not None:
            self.update_data_source(instance, data_source)

        return instance

    def update_data_source(self, instance: Detector, data_source: dict[str, Any]):
        subscription = get_uptime_subscription(instance)
        update_uptime_subscription(
            subscription=subscription,
            url=data_source.get("url", NOT_SET),
            interval_seconds=data_source.get("interval_seconds", NOT_SET),
            timeout_ms=data_source.get("timeout_ms", NOT_SET),
            method=data_source.get("method", NOT_SET),
            headers=data_source.get("headers", NOT_SET),
            body=data_source.get("body", NOT_SET),
            trace_sampling=data_source.get("trace_sampling", NOT_SET),
        )

        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=instance.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_EDIT"),
            data=instance.get_audit_log_data(),
        )

        return instance

    def delete(self) -> None:
        assert self.instance is not None

        remove_uptime_seat(self.instance)
        uptime_subscription = get_uptime_subscription(self.instance)
        delete_uptime_subscription(uptime_subscription)

        super().delete()
