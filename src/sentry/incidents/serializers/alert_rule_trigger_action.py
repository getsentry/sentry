from django.utils.encoding import force_text
from rest_framework import serializers

from sentry import analytics
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.incidents.logic import (
    InvalidTriggerActionError,
    create_alert_rule_trigger_action,
    update_alert_rule_trigger_action,
)
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.incidents.serializers import (
    ACTION_TARGET_TYPE_TO_STRING,
    STRING_TO_ACTION_TARGET_TYPE,
    STRING_TO_ACTION_TYPE,
)
from sentry.integrations.slack.utils import validate_channel_id
from sentry.models import OrganizationMember, Team
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.shared_integrations.exceptions import ApiRateLimitedError


class AlertRuleTriggerActionSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating a trigger action. Required context:
     - `trigger`: The trigger related to this action.
     - `alert_rule`: The alert_rule related to this action.
     - `organization`: The organization related to this action.
     - `access`: An access object (from `request.access`)
     - `user`: The user from `request.user`
    """

    id = serializers.IntegerField(required=False)
    type = serializers.CharField()
    target_type = serializers.CharField()
    sentry_app_config = serializers.JSONField(required=False)  # array of dicts
    sentry_app_installation_uuid = serializers.CharField(required=False)

    integration = serializers.IntegerField(source="integration_id", required=False, allow_null=True)
    sentry_app = serializers.IntegerField(source="sentry_app_id", required=False, allow_null=True)

    class Meta:
        model = AlertRuleTriggerAction
        fields = [
            "id",
            "type",
            "target_type",
            "target_identifier",
            "integration",
            "sentry_app",
            "sentry_app_config",
            "sentry_app_installation_uuid",
        ]
        extra_kwargs = {
            "target_identifier": {"required": True},
            "target_display": {"required": False},
            "integration": {"required": False, "allow_null": True},
            "sentry_app": {"required": False, "allow_null": True},
            "sentry_app_config": {"required": False, "allow_null": True},
            "sentry_app_installation_uuid": {"required": False, "allow_null": True},
        }

    def validate_type(self, type):
        if type not in STRING_TO_ACTION_TYPE:
            raise serializers.ValidationError(
                "Invalid type, valid values are [%s]" % ", ".join(STRING_TO_ACTION_TYPE.keys())
            )
        return STRING_TO_ACTION_TYPE[type]

    def validate_target_type(self, target_type):
        if target_type not in STRING_TO_ACTION_TARGET_TYPE:
            raise serializers.ValidationError(
                "Invalid targetType, valid values are [%s]"
                % ", ".join(STRING_TO_ACTION_TARGET_TYPE.keys())
            )
        return STRING_TO_ACTION_TARGET_TYPE[target_type]

    def validate(self, attrs):
        if ("type" in attrs) != ("target_type" in attrs) != ("target_identifier" in attrs):
            raise serializers.ValidationError(
                "type, targetType and targetIdentifier must be passed together"
            )
        type = attrs.get("type")
        target_type = attrs.get("target_type")
        access = self.context["access"]
        identifier = attrs.get("target_identifier")

        if type is not None:
            type_info = AlertRuleTriggerAction.get_registered_type(type)
            if target_type not in type_info.supported_target_types:
                allowed_target_types = ",".join(
                    ACTION_TARGET_TYPE_TO_STRING[type_name]
                    for type_name in type_info.supported_target_types
                )
                raise serializers.ValidationError(
                    {
                        "target_type": "Invalid target type for %s. Valid types are [%s]"
                        % (type_info.slug, allowed_target_types)
                    }
                )

        if attrs.get("type") == AlertRuleTriggerAction.Type.EMAIL:
            if target_type == AlertRuleTriggerAction.TargetType.TEAM:
                try:
                    team = Team.objects.get(id=identifier)
                except Team.DoesNotExist:
                    raise serializers.ValidationError("Team does not exist")
                if not access.has_team_access(team):
                    raise serializers.ValidationError("Team does not exist")
            elif target_type == AlertRuleTriggerAction.TargetType.USER:
                if user_service.get_user(user_id=identifier) is None:
                    raise serializers.ValidationError("User does not exist")

                if not OrganizationMember.objects.filter(
                    organization=self.context["organization"], user_id=identifier
                ).exists():
                    raise serializers.ValidationError("User does not belong to this organization")
        elif attrs.get("type") == AlertRuleTriggerAction.Type.SLACK:
            if not attrs.get("integration_id"):
                raise serializers.ValidationError(
                    {"integration": "Integration must be provided for slack"}
                )

        elif attrs.get("type") == AlertRuleTriggerAction.Type.SENTRY_APP:
            sentry_app_installation_uuid = attrs.get("sentry_app_installation_uuid")

            if not attrs.get("sentry_app_id"):
                raise serializers.ValidationError(
                    {"sentry_app": "SentryApp must be provided for sentry_app"}
                )
            if attrs.get("sentry_app_config"):
                if sentry_app_installation_uuid is None:
                    raise serializers.ValidationError(
                        {"sentry_app": "Missing parameter: sentry_app_installation_uuid"}
                    )

                installations = app_service.get_many(
                    filter=dict(uuids=[sentry_app_installation_uuid])
                )
                if not installations:
                    raise serializers.ValidationError(
                        {"sentry_app": "The installation does not exist."}
                    )

            # TODO(Ecosystem): Validate fields on schema config if alert-rule-action component exists
            # See NotifyEventSentryAppAction::self_validate for more details

        attrs["use_async_lookup"] = self.context.get("use_async_lookup")
        attrs["input_channel_id"] = self.context.get("input_channel_id")
        should_validate_channel_id = self.context.get("validate_channel_id", True)
        # validate_channel_id is assumed to be true unless explicitly passed as false
        if attrs["input_channel_id"] and should_validate_channel_id:
            validate_channel_id(identifier, attrs["integration_id"], attrs["input_channel_id"])
        return attrs

    def create(self, validated_data):
        for key in ("id", "sentry_app_installation_uuid"):
            validated_data.pop(key, None)

        try:
            action = create_alert_rule_trigger_action(
                trigger=self.context["trigger"], **validated_data
            )
        except (ApiRateLimitedError, InvalidTriggerActionError) as e:
            raise serializers.ValidationError(force_text(e))

        analytics.record(
            "metric_alert_with_ui_component.created",
            user_id=getattr(self.context["user"], "id", None),
            alert_rule_id=getattr(self.context["alert_rule"], "id"),
            organization_id=getattr(self.context["organization"], "id"),
        )
        return action

    def update(self, instance, validated_data):
        for key in ("id", "sentry_app_installation_uuid"):
            validated_data.pop(key, None)

        try:
            action = update_alert_rule_trigger_action(instance, **validated_data)
        except (ApiRateLimitedError, InvalidTriggerActionError) as e:
            raise serializers.ValidationError(force_text(e))

        return action
