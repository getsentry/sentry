from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry import audit_log
from sentry.api.fields import ActorField
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.utils.audit import create_audit_entry


@extend_schema_serializer()
class UptimeMonitorValidator(CamelSnakeSerializer):
    name = serializers.CharField(
        max_length=128,
        help_text="Name of the uptime monitor",
    )
    owner = ActorField(
        required=False,
        allow_null=True,
        help_text="The ID of the team or user that owns the uptime monitor. (eg. user:51 or team:6)",
    )

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
