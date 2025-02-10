from django.utils.encoding import force_str
from rest_framework import serializers

from sentry import analytics, features
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.auth.access import Access
from sentry.incidents.logic import (
    InvalidTriggerActionError,
    create_alert_rule_trigger_action,
    update_alert_rule_trigger_action,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING, STRING_TO_ACTION_TARGET_TYPE
from sentry.integrations.opsgenie.utils import OPSGENIE_CUSTOM_PRIORITIES
from sentry.integrations.pagerduty.utils import PAGERDUTY_CUSTOM_PRIORITIES
from sentry.integrations.slack.utils.channel import validate_channel_id
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionService
from sentry.shared_integrations.exceptions import ApiRateLimitedError
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_metric_action


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
    priority = serializers.CharField(required=False, allow_null=True)

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
            "priority",
        ]
        extra_kwargs = {
            "target_identifier": {"required": True},
            "target_display": {"required": False},
            "integration": {"required": False, "allow_null": True},
            "sentry_app": {"required": False, "allow_null": True},
            "sentry_app_config": {"required": False, "allow_null": True},
            "sentry_app_installation_uuid": {"required": False, "allow_null": True},
        }

    def validate_type(self, type: str) -> ActionService:
        factory = AlertRuleTriggerAction.look_up_factory_by_slug(type)
        if factory is None:
            valid_slugs = AlertRuleTriggerAction.get_all_slugs()
            raise serializers.ValidationError(f"Invalid type, valid values are {valid_slugs!r}")
        return factory.service_type

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
        access: Access = self.context["access"]
        identifier = attrs.get("target_identifier")

        if type is not None:
            type_info = AlertRuleTriggerAction.get_registered_factory(type)
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

        action_type = attrs.get("type")
        if action_type == AlertRuleTriggerAction.Type.EMAIL:
            if target_type == AlertRuleTriggerAction.TargetType.TEAM:
                try:
                    team = Team.objects.get(id=identifier)
                except Team.DoesNotExist:
                    raise serializers.ValidationError("Team does not exist")
                if not access.has_team_access(team):
                    raise serializers.ValidationError("Team does not exist")
            elif target_type == AlertRuleTriggerAction.TargetType.USER:
                if not OrganizationMember.objects.filter(
                    organization=self.context["organization"], user_id=identifier
                ).exists():
                    raise serializers.ValidationError("User does not belong to this organization")
        elif action_type == AlertRuleTriggerAction.Type.SLACK:
            if not attrs.get("integration_id"):
                raise serializers.ValidationError(
                    {"integration": "Integration must be provided for slack"}
                )
        elif action_type == AlertRuleTriggerAction.Type.DISCORD:
            if not attrs.get("integration_id"):
                raise serializers.ValidationError(
                    {"integration": "Integration must be provided for discord"}
                )

        elif action_type == AlertRuleTriggerAction.Type.SENTRY_APP:
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

                installations = self.context.get("installations")
                if installations and sentry_app_installation_uuid not in {
                    i.uuid for i in installations
                }:
                    raise serializers.ValidationError(
                        {"sentry_app": "The installation does not exist."}
                    )

        if attrs.get("priority"):
            if action_type not in [
                AlertRuleTriggerAction.Type.PAGERDUTY,
                AlertRuleTriggerAction.Type.OPSGENIE,
            ]:
                raise serializers.ValidationError(
                    {"priority": "Can only be set for Pagerduty or Opsgenie"}
                )

            priority: str = attrs["priority"]

            if (
                action_type == AlertRuleTriggerAction.Type.PAGERDUTY
                and priority not in PAGERDUTY_CUSTOM_PRIORITIES
            ):
                raise serializers.ValidationError(
                    {
                        "priority": f"Allowed priorities for Pagerduty are {str(PAGERDUTY_CUSTOM_PRIORITIES)}"
                    }
                )
            if (
                action_type == AlertRuleTriggerAction.Type.OPSGENIE
                and priority not in OPSGENIE_CUSTOM_PRIORITIES
            ):
                raise serializers.ValidationError(
                    {
                        "priority": f"Allowed priorities for Opsgenie are {str(OPSGENIE_CUSTOM_PRIORITIES)}"
                    }
                )

            # TODO(Ecosystem): Validate fields on schema config if alert-rule-action component exists
            # See NotifyEventSentryAppAction::self_validate for more details

        attrs["use_async_lookup"] = self.context.get("use_async_lookup")
        attrs["input_channel_id"] = self.context.get("input_channel_id")
        attrs["installations"] = self.context.get("installations")
        attrs["integrations"] = self.context.get("integrations")
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
            raise serializers.ValidationError(force_str(e))

        analytics.record(
            "metric_alert_with_ui_component.created",
            user_id=getattr(self.context["user"], "id", None),
            alert_rule_id=getattr(self.context["alert_rule"], "id"),
            organization_id=getattr(self.context["organization"], "id"),
        )
        if features.has(
            "organizations:workflow-engine-metric-alert-dual-write",
            action.alert_rule_trigger.alert_rule.organization,
        ):
            migrate_metric_action(action)

        return action

    def update(self, instance, validated_data):
        for key in ("id", "sentry_app_installation_uuid"):
            validated_data.pop(key, None)

        try:
            action = update_alert_rule_trigger_action(instance, **validated_data)
        except (ApiRateLimitedError, InvalidTriggerActionError) as e:
            raise serializers.ValidationError(force_str(e))

        return action
