from collections.abc import Sequence
from typing import Any, override

import jsonschema
from django.db import router
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.fields import URLField

from sentry import audit_log
from sentry.api.fields import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.uptime.models import (
    UptimeStatus,
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
    check_url_limits,
    create_uptime_detector,
    create_uptime_subscription,
    update_uptime_detector,
    update_uptime_subscription,
)
from sentry.uptime.types import UptimeMonitorMode
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
    mode = serializers.IntegerField(required=False)
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
        try:
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
        except MaxManualUptimeSubscriptionsReached:
            raise serializers.ValidationError(
                f"You may have at most {MAX_MANUAL_SUBSCRIPTIONS_PER_ORG} uptime monitors per organization"
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
                uptime_status=UptimeStatus.OK,
                method=validated_data.get("method", "GET"),
                headers=validated_data.get("headers", None),
                body=validated_data.get("body", None),
            )
        return uptime_subscription


class UptimeDomainCheckFailureValidator(BaseDetectorTypeValidator):
    data_source = UptimeMonitorDataSourceValidator(required=True)

    def update(self, instance: Detector, validated_data: dict[str, Any]) -> Detector:
        super().update(instance, validated_data)

        if "data_source" in validated_data:
            data_source = validated_data.pop("data_source")
            if data_source:
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

    def create(self, validated_data):
        return super().create(validated_data)
