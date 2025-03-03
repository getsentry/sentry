from collections.abc import Sequence

import jsonschema
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.fields import URLField

from sentry import audit_log, features
from sentry.api.fields import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    MAX_MANUAL_SUBSCRIPTIONS_PER_ORG,
    MaxManualUptimeSubscriptionsReached,
    MaxUrlsForDomainReachedException,
    UptimeMonitorNoSeatAvailable,
    check_url_limits,
    create_project_uptime_subscription,
    update_project_uptime_subscription,
)
from sentry.utils.audit import create_audit_entry

"""
The bounding upper limit on how many ProjectUptimeSubscription's can exist for
a single domain + suffix.

This takes into accunt subdomains by including them in the count. For example,
for the domain `sentry.io` both the hosts `subdomain-one.sentry.io` and
`subdomain-2.sentry.io` will both count towards the limit

Importantly domains like `vercel.dev` are considered TLDs as defined by the
public suffix list (PSL). See `extract_domain_parts` fo more details
"""
MAX_REQUEST_SIZE_BYTES = 1000

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
        max_value=30_000,
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

    def validate(self, attrs):
        if features.has("organization:uptime-create-disabled", self.context["organization"]):
            raise serializers.ValidationError(
                "The uptime feature is disabled for your organization"
            )

        headers = []
        method = "GET"
        body = None
        url = ""
        if self.instance:
            headers = self.instance.uptime_subscription.headers
            method = self.instance.uptime_subscription.method
            body = self.instance.uptime_subscription.body
            url = self.instance.uptime_subscription.url

        request_size = compute_http_request_size(
            attrs.get("method", method),
            attrs.get("url", url),
            attrs.get("headers", headers),
            attrs.get("body", body),
        )
        if request_size > MAX_REQUEST_SIZE_BYTES:
            raise serializers.ValidationError(
                f"Request is too large, max size is {MAX_REQUEST_SIZE_BYTES} bytes"
            )
        return attrs

    def validate_url(self, url):
        try:
            check_url_limits(url)
        except MaxUrlsForDomainReachedException as e:
            raise serializers.ValidationError(
                f"The domain *.{e.domain}.{e.suffix} has already been used in {e.max_urls} uptime monitoring alerts, "
                "which is the limit. You cannot create any additional alerts for this domain."
            )
        return url

    def validate_headers(self, headers):
        try:
            jsonschema.validate(headers, HEADERS_LIST_SCHEMA)
            return headers
        except jsonschema.ValidationError:
            raise serializers.ValidationError("Expected array of header tuples.")

    def validate_status(self, value):
        return MONITOR_STATUSES.get(value, ObjectStatus.ACTIVE)

    def validate_mode(self, mode):
        if not is_active_superuser(self.context["request"]):
            raise serializers.ValidationError("Only superusers can modify `mode`")
        try:
            return ProjectUptimeSubscriptionMode(mode)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid mode, valid values are %s"
                % [item.value for item in ProjectUptimeSubscriptionMode]
            )

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
            uptime_monitor = create_project_uptime_subscription(
                project=self.context["project"],
                environment=environment,
                url=validated_data["url"],
                interval_seconds=validated_data["interval_seconds"],
                timeout_ms=validated_data["timeout_ms"],
                name=validated_data["name"],
                status=validated_data.get("status"),
                mode=validated_data.get("mode", ProjectUptimeSubscriptionMode.MANUAL),
                owner=validated_data.get("owner"),
                trace_sampling=validated_data.get("trace_sampling", False),
                **method_headers_body,
            )
        except MaxManualUptimeSubscriptionsReached:
            raise serializers.ValidationError(
                f"You may have at most {MAX_MANUAL_SUBSCRIPTIONS_PER_ORG} uptime monitors per organization"
            )
        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=uptime_monitor.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
            data=uptime_monitor.get_audit_log_data(),
        )
        return uptime_monitor

    def update(self, instance: ProjectUptimeSubscription, data):
        url = data["url"] if "url" in data else instance.uptime_subscription.url
        interval_seconds = (
            data["interval_seconds"]
            if "interval_seconds" in data
            else instance.uptime_subscription.interval_seconds
        )
        timeout_ms = (
            data["timeout_ms"] if "timeout_ms" in data else instance.uptime_subscription.timeout_ms
        )
        method = data["method"] if "method" in data else instance.uptime_subscription.method
        headers = data["headers"] if "headers" in data else instance.uptime_subscription.headers
        body = data["body"] if "body" in data else instance.uptime_subscription.body
        name = data["name"] if "name" in data else instance.name
        owner = data["owner"] if "owner" in data else instance.owner
        trace_sampling = (
            data["trace_sampling"]
            if "trace_sampling" in data
            else instance.uptime_subscription.trace_sampling
        )
        status = data["status"] if "status" in data else instance.status

        if "environment" in data:
            environment = Environment.get_or_create(
                project=self.context["project"],
                name=data["environment"],
            )
        else:
            environment = instance.environment

        if "mode" in data:
            raise serializers.ValidationError("Mode can only be specified on creation (for now)")

        try:
            update_project_uptime_subscription(
                uptime_monitor=instance,
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
                data=instance.get_audit_log_data(),
            )

        return instance
