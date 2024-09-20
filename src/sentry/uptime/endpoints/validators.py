from datetime import timedelta

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.fields import URLField

from sentry import audit_log
from sentry.api.fields import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.uptime.detectors.url_extraction import extract_domain_parts
from sentry.uptime.models import ProjectUptimeSubscription, ProjectUptimeSubscriptionMode
from sentry.uptime.subscriptions.subscriptions import (
    create_project_uptime_subscription,
    create_uptime_subscription,
)
from sentry.utils.audit import create_audit_entry

MAX_MONITORS_PER_DOMAIN = 100
"""
The bounding upper limit on how many ProjectUptimeSubscription's can exist for
a single domain + suffix.

This takes into accunt subdomains by including them in the count. For example,
for the domain `sentry.io` both the hosts `subdomain-one.sentry.io` and
`subdomain-2.sentry.io` will both count towards the limit

Importantly domains like `vercel.dev` are considered TLDs as defined by the
public suffix list (PSL). See `extract_domain_parts` fo more details
"""


@extend_schema_serializer()
class UptimeMonitorValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        required=True,
        max_length=128,
        help_text="Name of the uptime monitor",
    )
    owner = ActorField(
        required=True,
        allow_null=True,
        help_text="The ID of the team or user that owns the uptime monitor. (eg. user:51 or team:6)",
    )
    url = URLField(required=True, max_length=255)
    interval_seconds = serializers.IntegerField(
        required=True, min_value=60, max_value=int(timedelta(days=1).total_seconds())
    )
    mode = serializers.IntegerField(required=False)

    def validate_url(self, url):
        url_parts = extract_domain_parts(url)
        existing_count = ProjectUptimeSubscription.objects.filter(
            uptime_subscription__url_domain=url_parts.domain,
            uptime_subscription__url_domain_suffix=url_parts.suffix,
        ).count()

        if existing_count >= MAX_MONITORS_PER_DOMAIN:
            raise serializers.ValidationError(
                f"The domain *.{url_parts.domain}.{url_parts.suffix} has already been used in {MAX_MONITORS_PER_DOMAIN} uptime monitoring alerts, which is the limit. You cannot create any additional alerts for this domain."
            )
        return url

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
        uptime_subscription = create_uptime_subscription(
            url=validated_data["url"],
            interval_seconds=validated_data["interval_seconds"],
        )
        uptime_monitor = create_project_uptime_subscription(
            project=self.context["project"],
            uptime_subscription=uptime_subscription,
            name=validated_data["name"],
            mode=validated_data.get("mode", ProjectUptimeSubscriptionMode.MANUAL),
            owner=validated_data["owner"],
        )
        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=uptime_monitor.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
            data=uptime_monitor.get_audit_log_data(),
        )
        return uptime_monitor

    def update(self, instance, validated_data):
        params = {}
        if "name" in validated_data:
            params["name"] = validated_data["name"]

        if "owner" in validated_data:
            owner = validated_data["owner"]
            params["owner_user_id"] = None
            params["owner_team_id"] = None
            if owner is not None:
                if owner.is_user:
                    params["owner_user_id"] = owner.id
                if owner.is_team:
                    params["owner_team_id"] = owner.id

        if "mode" in validated_data:
            raise serializers.ValidationError("Mode can only be specified on creation (for now)")

        if params:
            instance.update(**params)
            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=instance.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_EDIT"),
                data=instance.get_audit_log_data(),
            )

        return instance
