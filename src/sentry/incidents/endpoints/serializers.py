from __future__ import absolute_import

from datetime import timedelta

import operator

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.api.serializers.rest_framework.environment import EnvironmentField
from sentry.incidents.logic import (
    AlertRuleNameAlreadyUsedError,
    AlertRuleTriggerLabelAlreadyUsedError,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    update_alert_rule,
    update_alert_rule_trigger,
    update_alert_rule_trigger_action,
    delete_alert_rule_trigger_action,
    delete_alert_rule_trigger,
)
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.models.user import User
from sentry.snuba.models import QueryAggregations


string_to_action_type = {
    registration.slug: registration.type
    for registration in AlertRuleTriggerAction.get_registered_types()
}
action_target_type_to_string = {
    AlertRuleTriggerAction.TargetType.USER: "user",
    AlertRuleTriggerAction.TargetType.TEAM: "team",
    AlertRuleTriggerAction.TargetType.SPECIFIC: "specific",
}
string_to_action_target_type = {v: k for (k, v) in action_target_type_to_string.items()}

CRITICAL_TRIGGER_LABEL = "critical"
WARNING_TRIGGER_LABEL = "warning"


class AlertRuleTriggerActionSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating a trigger action. Required context:
     - `trigger`: The trigger related to this action.
     - `alert_rule`: The alert_rule related to this action.
     - `organization`: The organization related to this action.
     - `access`: An access object (from `request.access`)
    """

    id = serializers.IntegerField(required=False)
    type = serializers.CharField()
    target_type = serializers.CharField()

    class Meta:
        model = AlertRuleTriggerAction
        fields = ["id", "type", "target_type", "target_identifier", "integration"]
        extra_kwargs = {
            "target_identifier": {"required": True},
            "target_display": {"required": False},
            "integration": {"required": False, "allow_null": True},
        }

    def validate_type(self, type):
        if type not in string_to_action_type:
            raise serializers.ValidationError(
                "Invalid type, valid values are [%s]" % ", ".join(string_to_action_type.keys())
            )
        return string_to_action_type[type]

    def validate_target_type(self, target_type):
        if target_type not in string_to_action_target_type:
            raise serializers.ValidationError(
                "Invalid targetType, valid values are [%s]"
                % ", ".join(string_to_action_target_type.keys())
            )
        return string_to_action_target_type[target_type]

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
                    [
                        action_target_type_to_string[type_name]
                        for type_name in type_info.supported_target_types
                    ]
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
                if not access.has_team(team):
                    raise serializers.ValidationError("Team does not exist")
            elif target_type == AlertRuleTriggerAction.TargetType.USER:
                try:
                    user = User.objects.get(id=identifier)
                except User.DoesNotExist:
                    raise serializers.ValidationError("User does not exist")

                if not OrganizationMember.objects.filter(
                    organization=self.context["organization"], user=user
                ).exists():
                    raise serializers.ValidationError("User does not belong to this organization")
        elif attrs.get("type") == AlertRuleTriggerAction.Type.SLACK:
            if not attrs.get("integration"):
                raise serializers.ValidationError(
                    {"integration": "Integration must be provided for slack"}
                )

        return attrs

    def create(self, validated_data):
        return create_alert_rule_trigger_action(trigger=self.context["trigger"], **validated_data)

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        return update_alert_rule_trigger_action(instance, **validated_data)


class AlertRuleTriggerSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule trigger. Required context:
     - `alert_rule`: The alert_rule related to this trigger.
     - `organization`: The organization related to this trigger.
     - `access`: An access object (from `request.access`)
    """

    id = serializers.IntegerField(required=False)

    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)
    actions = serializers.ListField(required=True)

    class Meta:
        model = AlertRuleTrigger
        fields = [
            "id",
            "label",
            "threshold_type",
            "alert_threshold",
            "resolve_threshold",
            "excluded_projects",
            "actions",
        ]
        extra_kwargs = {"label": {"min_length": 1, "max_length": 64}}

    def validate_threshold_type(self, threshold_type):
        try:
            return AlertRuleThresholdType(threshold_type)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid threshold type, valid values are %s"
                % [item.value for item in AlertRuleThresholdType]
            )

    def create(self, validated_data):
        try:
            actions = validated_data.pop("actions")
            alert_rule_trigger = create_alert_rule_trigger(
                alert_rule=self.context["alert_rule"], **validated_data
            )
            self._handle_action_updates(alert_rule_trigger, actions)

            return alert_rule_trigger
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")

    def update(self, instance, validated_data):
        actions = validated_data.pop("actions")
        if "id" in validated_data:
            validated_data.pop("id")
        try:
            alert_rule_trigger = update_alert_rule_trigger(instance, **validated_data)
            self._handle_action_updates(alert_rule_trigger, actions)
            return alert_rule_trigger
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")

    def _handle_action_updates(self, alert_rule_trigger, actions):
        if actions is not None:
            # Delete actions we don't have present in the updated data.
            action_ids = [x["id"] for x in actions if "id" in x]
            actions_to_delete = AlertRuleTriggerAction.objects.filter(
                alert_rule_trigger=alert_rule_trigger
            ).exclude(id__in=action_ids)
            for action in actions_to_delete:
                delete_alert_rule_trigger_action(action)

            for action_data in actions:
                if "integration_id" in action_data:
                    action_data["integration"] = action_data.pop("integration_id")

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
                    },
                    instance=action_instance,
                    data=action_data,
                )

                if action_serializer.is_valid():
                    action_serializer.save()
                else:
                    raise serializers.ValidationError(action_serializer.errors)


class AlertRuleSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule. Required context:
     - `organization`: The organization related to this alert rule.
     - `access`: An access object (from `request.access`)
    """

    environment = serializers.ListField(child=EnvironmentField(), required=False)
    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    projects = serializers.ListField(child=ProjectField(), required=False)
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)
    triggers = serializers.ListField(required=True)

    class Meta:
        model = AlertRule
        fields = [
            "name",
            "query",
            "time_window",
            "environment",
            "threshold_period",
            "aggregation",
            "projects",
            "include_all_projects",
            "excluded_projects",
            "triggers",
        ]
        extra_kwargs = {
            "query": {"allow_blank": True, "required": True},
            "threshold_period": {"default": 1, "min_value": 1, "max_value": 20},
            "time_window": {
                "min_value": 1,
                "max_value": int(timedelta(days=1).total_seconds() / 60),
                "required": True,
            },
            "aggregation": {"required": False},
            "name": {"min_length": 1, "max_length": 64},
            "include_all_projects": {"default": False},
        }

    def validate_aggregation(self, aggregation):
        try:
            return QueryAggregations(aggregation)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid aggregation, valid values are %s"
                % [item.value for item in QueryAggregations]
            )

    def validate(self, data):
        """Performs validation on an alert rule's data
        This includes ensuring there is either 1 or 2 triggers, which each have actions, and have proper thresholds set.
        The critical trigger should both alert and resolve 'after' the warning trigger (whether that means > or < the value depends on threshold type).
        """
        triggers = data.get("triggers", [])
        if triggers:
            if len(triggers) == 1:
                critical = triggers[0]
                if critical.get("label", None) != CRITICAL_TRIGGER_LABEL:
                    raise serializers.ValidationError(
                        'First trigger must be labeled "%s"' % (CRITICAL_TRIGGER_LABEL)
                    )
                if critical["threshold_type"] == AlertRuleThresholdType.ABOVE.value:
                    alert_op, trigger_error = (
                        operator.lt,
                        "alert threshold must be above resolution threshold",
                    )
                elif critical["threshold_type"] == AlertRuleThresholdType.BELOW.value:
                    alert_op, trigger_error = (
                        operator.gt,
                        "alert threshold must be below resolution threshold",
                    )
                if critical["resolve_threshold"] is not None:
                    if alert_op(critical["alert_threshold"], critical["resolve_threshold"]):
                        raise serializers.ValidationError("Critical " + trigger_error)
            elif len(triggers) == 2:
                critical = triggers[0]
                warning = triggers[1]
                if (
                    critical.get("label", None) != CRITICAL_TRIGGER_LABEL
                    or warning["label"] != WARNING_TRIGGER_LABEL
                ):
                    raise serializers.ValidationError(
                        'First trigger must be labeled "%s", second trigger must be labeled "%s"'
                        % (CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL)
                    )
                else:
                    if critical["threshold_type"] != warning["threshold_type"]:
                        raise serializers.ValidationError(
                            "Must have matching threshold types (i.e. critical and warning triggers must both be an upper or lower bound)"
                        )

                    if critical["threshold_type"] == AlertRuleThresholdType.ABOVE.value:
                        alert_op, resolve_op = operator.lt, operator.lt
                        alert_error = (
                            "Critical trigger must have an alert threshold above warning trigger"
                        )
                        resolve_error = "Critical trigger must have a resolution threshold above (or equal to) warning trigger"
                        trigger_error = "alert threshold must be above resolution threshold"
                    elif critical["threshold_type"] == AlertRuleThresholdType.BELOW.value:
                        alert_op, resolve_op = operator.gt, operator.gt
                        alert_error = (
                            "Critical trigger must have an alert threshold below warning trigger"
                        )
                        resolve_error = "Critical trigger must have a resolution threshold below (or equal to) warning trigger"
                        trigger_error = "alert threshold must be below resolution threshold"
                    else:
                        raise serializers.ValidationError(
                            "Invalid threshold type. Valid values are %s"
                            % [item.value for item in AlertRuleThresholdType]
                        )

                    if alert_op(critical["alert_threshold"], warning["alert_threshold"]):
                        raise serializers.ValidationError(alert_error)
                    elif resolve_op(critical["resolve_threshold"], warning["resolve_threshold"]):
                        raise serializers.ValidationError(resolve_error)

                    if critical["resolve_threshold"] is not None:
                        if alert_op(critical["alert_threshold"], critical["resolve_threshold"]):
                            raise serializers.ValidationError("Critical " + trigger_error)

                    if warning["resolve_threshold"] is not None:
                        if alert_op(warning["alert_threshold"], warning["resolve_threshold"]):
                            raise serializers.ValidationError("Warning " + trigger_error)
            else:
                raise serializers.ValidationError(
                    "Must send 1 or 2 triggers - A critical trigger, and an optional warning trigger"
                )

            # Triggers have passed checks. Check that all triggers have at least one action now.
            for trigger in triggers:
                actions = trigger.get("actions", [])
                if actions == []:
                    raise serializers.ValidationError(
                        '"' + trigger["label"] + '" trigger must have an action.'
                    )
        else:
            raise serializers.ValidationError("Must include at least one trigger")

        return data

    def create(self, validated_data):
        try:
            triggers = validated_data.pop("triggers")
            alert_rule = create_alert_rule(
                organization=self.context["organization"], **validated_data
            )
            self._handle_trigger_updates(alert_rule, triggers)
            return alert_rule
        except AlertRuleNameAlreadyUsedError:
            raise serializers.ValidationError("This name is already in use for this project")

    def update(self, instance, validated_data):
        triggers = validated_data.pop("triggers")
        if "id" in validated_data:
            validated_data.pop("id")
        try:
            alert_rule = update_alert_rule(instance, **validated_data)
            self._handle_trigger_updates(alert_rule, triggers)
            return alert_rule
        except AlertRuleNameAlreadyUsedError:
            raise serializers.ValidationError("This name is already in use for this project")

    def _handle_trigger_updates(self, alert_rule, triggers):
        if triggers is not None:
            # Delete triggers we don't have present in the incoming data
            trigger_ids = [x["id"] for x in triggers if "id" in x]
            triggers_to_delete = AlertRuleTrigger.objects.filter(alert_rule=alert_rule).exclude(
                id__in=trigger_ids
            )
            for trigger in triggers_to_delete:
                delete_alert_rule_trigger(trigger)

            for trigger_data in triggers:
                if "id" in trigger_data:
                    trigger_instance = AlertRuleTrigger.objects.get(
                        alert_rule=alert_rule, id=trigger_data["id"]
                    )
                else:
                    trigger_instance = None

                trigger_serializer = AlertRuleTriggerSerializer(
                    context={
                        "alert_rule": alert_rule,
                        "organization": self.context["organization"],
                        "access": self.context["access"],
                    },
                    instance=trigger_instance,
                    data=trigger_data,
                )

                if trigger_serializer.is_valid():
                    trigger_serializer.save()
                else:
                    raise serializers.ValidationError(trigger_serializer.errors)
