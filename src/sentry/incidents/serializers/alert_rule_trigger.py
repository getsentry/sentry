from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.incidents.logic import (
    AlertRuleTriggerLabelAlreadyUsedError,
    ChannelLookupTimeoutError,
    create_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    rewrite_trigger_action_fields,
    update_alert_rule_trigger,
)
from sentry.incidents.models import AlertRuleTrigger, AlertRuleTriggerAction

from .alert_rule_trigger_action import AlertRuleTriggerActionSerializer


class AlertRuleTriggerSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule trigger. Required context:
     - `alert_rule`: The alert_rule related to this trigger.
     - `organization`: The organization related to this trigger.
     - `access`: An access object (from `request.access`)
     - `user`: The user from `request.user`
    """

    id = serializers.IntegerField(required=False)

    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)
    actions = serializers.ListField(required=False)

    class Meta:
        model = AlertRuleTrigger
        fields = ["id", "label", "alert_threshold", "excluded_projects", "actions"]
        extra_kwargs = {"label": {"min_length": 1, "max_length": 64}}

    def create(self, validated_data):
        try:
            actions = validated_data.pop("actions", None)
            alert_rule_trigger = create_alert_rule_trigger(
                alert_rule=self.context["alert_rule"], **validated_data
            )
            self._handle_actions(alert_rule_trigger, actions)

            return alert_rule_trigger
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")

    def update(self, instance, validated_data):
        actions = validated_data.pop("actions")
        if "id" in validated_data:
            validated_data.pop("id")
        try:
            alert_rule_trigger = update_alert_rule_trigger(instance, **validated_data)
            self._handle_actions(alert_rule_trigger, actions)
            return alert_rule_trigger
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")

    def _handle_actions(self, alert_rule_trigger, actions):
        channel_lookup_timeout_error = None
        if actions is not None:
            # Delete actions we don't have present in the updated data.
            action_ids = [x["id"] for x in actions if "id" in x]
            actions_to_delete = AlertRuleTriggerAction.objects.filter(
                alert_rule_trigger=alert_rule_trigger
            ).exclude(id__in=action_ids)
            for action in actions_to_delete:
                delete_alert_rule_trigger_action(action)

            for action_data in actions:
                action_data = rewrite_trigger_action_fields(action_data)
                if "id" in action_data:
                    action_instance = AlertRuleTriggerAction.objects.get(
                        alert_rule_trigger=alert_rule_trigger, id=action_data["id"]
                    )
                else:
                    action_instance = None

                action_serializer = AlertRuleTriggerActionSerializer(
                    context={
                        "alert_rule": alert_rule_trigger.alert_rule,
                        "trigger": alert_rule_trigger,
                        "organization": self.context["organization"],
                        "access": self.context["access"],
                        "user": self.context["user"],
                        "use_async_lookup": self.context.get("use_async_lookup"),
                        "validate_channel_id": self.context.get("validate_channel_id"),
                        "input_channel_id": action_data.pop("input_channel_id", None),
                    },
                    instance=action_instance,
                    data=action_data,
                )
                if action_serializer.is_valid():
                    try:
                        action_serializer.save()
                    except ChannelLookupTimeoutError as e:
                        # raise the lookup error after the rest of the validation is complete
                        channel_lookup_timeout_error = e
                else:
                    raise serializers.ValidationError(action_serializer.errors)
        if channel_lookup_timeout_error:
            raise channel_lookup_timeout_error
