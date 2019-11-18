from __future__ import absolute_import

from datetime import timedelta

import six
from enum import Enum
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.incidents.logic import (
    AlertRuleNameAlreadyUsedError,
    AlertRuleTriggerLabelAlreadyUsedError,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    get_excluded_projects_for_alert_rule,
    update_alert_rule,
    update_alert_rule_trigger,
    update_alert_rule_trigger_action,
)
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.models.project import Project
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.models.user import User
from sentry.snuba.models import QueryAggregations


class AlertRuleSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule. Required context:
     - `organization`: The organization related to this alert rule.
     - `access`: An access object (from `request.access`)
    """

    # XXX: ArrayFields aren't supported automatically until DRF 3.1
    aggregations = serializers.ListField(child=serializers.IntegerField(), required=False)
    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    projects = serializers.ListField(child=ProjectField(), required=False)
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)
    threshold_type = serializers.IntegerField(required=False)
    alert_threshold = serializers.IntegerField(required=False)
    resolve_threshold = serializers.IntegerField(required=False)

    class Meta:
        model = AlertRule
        fields = [
            "name",
            "threshold_type",
            "query",
            "time_window",
            "alert_threshold",
            "resolve_threshold",
            "threshold_period",
            "aggregation",
            "aggregations",
            "projects",
            "include_all_projects",
            "excluded_projects",
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

    def validate_aggregations(self, aggregations):
        # TODO: Remove this once FE transitions
        try:
            return [QueryAggregations(agg) for agg in aggregations]
        except ValueError:
            raise serializers.ValidationError(
                "Invalid aggregation, valid values are %s"
                % [item.value for item in QueryAggregations]
            )

    def validate(self, attrs):
        return self._handle_old_fields_transition(attrs)

    def create(self, validated_data):
        try:
            # TODO: Remove this, just temporary while we're supporting both fields.
            if "aggregation" not in validated_data:
                raise serializers.ValidationError("aggregation is required")

            return create_alert_rule(organization=self.context["organization"], **validated_data)
        except AlertRuleNameAlreadyUsedError:
            raise serializers.ValidationError("This name is already in use for this project")

    def _remove_unchanged_fields(self, instance, validated_data):
        for field_name, value in list(six.iteritems(validated_data)):
            # Remove any fields that haven't actually changed
            if field_name == "projects":
                project_slugs = Project.objects.filter(
                    querysubscription__alert_rules=instance
                ).values_list("slug", flat=True)
                if set(project_slugs) == set([project.slug for project in value]):
                    validated_data.pop(field_name)
                continue
            if field_name == "excluded_projects":
                excluded_slugs = [
                    p.project.slug for p in get_excluded_projects_for_alert_rule(instance)
                ]
                if set(excluded_slugs) == set(project.slug for project in value):
                    validated_data.pop(field_name)
                continue
            if isinstance(value, Enum):
                value = value.value
            if getattr(instance, field_name) == value:
                validated_data.pop(field_name)
        return validated_data

    def _handle_old_fields_transition(self, validated_data):
        # Temporary methods for transitioning from multiple aggregations to a single
        # aggregate
        if "aggregations" in validated_data and "aggregation" not in validated_data:
            validated_data["aggregation"] = validated_data["aggregations"][0]

        validated_data.pop("aggregations", None)
        # TODO: Remove after frontend stops using these fields
        validated_data.pop("threshold_type", None)
        validated_data.pop("alert_threshold", None)
        validated_data.pop("resolve_threshold", None)
        return validated_data

    def update(self, instance, validated_data):
        validated_data = self._remove_unchanged_fields(instance, validated_data)
        return update_alert_rule(instance, **validated_data)


class AlertRuleTriggerSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule trigger. Required context:
     - `alert_rule`: The alert_rule related to this trigger.
     - `organization`: The organization related to this trigger.
     - `access`: An access object (from `request.access`)
    """

    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)

    class Meta:
        model = AlertRuleTrigger
        fields = [
            "label",
            "threshold_type",
            "alert_threshold",
            "resolve_threshold",
            "excluded_projects",
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
            return create_alert_rule_trigger(
                alert_rule=self.context["alert_rule"], **validated_data
            )
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")

    def _remove_unchanged_fields(self, instance, validated_data):
        for field_name, value in list(six.iteritems(validated_data)):
            # Remove any fields that haven't actually changed
            if field_name == "excluded_projects":
                excluded_slugs = [
                    e.query_subscription.project.slug for e in instance.exclusions.all()
                ]
                if set(excluded_slugs) == set(project.slug for project in value):
                    validated_data.pop(field_name)
                continue
            if isinstance(value, Enum):
                value = value.value
            if getattr(instance, field_name) == value:
                validated_data.pop(field_name)
        return validated_data

    def update(self, instance, validated_data):
        validated_data = self._remove_unchanged_fields(instance, validated_data)
        try:
            return update_alert_rule_trigger(instance, **validated_data)
        except AlertRuleTriggerLabelAlreadyUsedError:
            raise serializers.ValidationError("This label is already in use for this alert rule")


class AlertRuleTriggerActionSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating a trigger action. Required context:
     - `trigger`: The trigger related to this action.
     - `alert_rule`: The alert_rule related to this action.
     - `organization`: The organization related to this action.
     - `access`: An access object (from `request.access`)
    """

    class Meta:
        model = AlertRuleTriggerAction
        fields = ["type", "target_type", "target_identifier", "target_display", "integration"]
        extra_kwargs = {
            "target_identifier": {"required": True},
            "target_display": {"required": False},
            "integration": {"required": False, "allow_null": False},
        }

    def validate_type(self, type):
        try:
            return AlertRuleTriggerAction.Type(type)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid type, valid values are %s"
                % [item.value for item in AlertRuleTriggerAction.Type]
            )

    def validate_target_type(self, target_type):
        try:
            return AlertRuleTriggerAction.TargetType(target_type)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid target_type, valid values are %s"
                % [item.value for item in AlertRuleTriggerAction.TargetType]
            )

    def validate(self, attrs):
        if ("target_type" in attrs) != ("target_identifier" in attrs):
            raise serializers.ValidationError(
                "targetType and targetIdentifier must be passed together"
            )
        target_type = attrs.get("target_type")
        access = self.context["access"]
        identifier = attrs.get("target_identifier")
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
            elif target_type == AlertRuleTriggerAction.TargetType.SPECIFIC:
                # Compare with `type` and perform a specific validation as needed
                pass
        elif attrs.get("type") == AlertRuleTriggerAction.Type.SLACK:
            if target_type != AlertRuleTriggerAction.TargetType.SPECIFIC:
                raise serializers.ValidationError(
                    {"target_type": "Must provide a specific channel for slack"}
                )
            if "integration" not in attrs:
                raise serializers.ValidationError(
                    {"integration": "Integration must be provided for slack"}
                )

        return attrs

    def create(self, validated_data):
        return create_alert_rule_trigger_action(trigger=self.context["trigger"], **validated_data)

    def _remove_unchanged_fields(self, instance, validated_data):
        if validated_data.get("type", instance.type) == AlertRuleTriggerAction.Type.SLACK.value:
            if (
                "target_identifier" in validated_data
                and validated_data["target_identifier"] == instance.target_display
            ):
                validated_data.pop("target_identifier")
        for field_name, value in list(six.iteritems(validated_data)):
            # Remove any fields that haven't actually changed
            if isinstance(value, Enum):
                value = value.value
            if getattr(instance, field_name) == value:
                validated_data.pop(field_name)
        return validated_data

    def update(self, instance, validated_data):
        validated_data = self._remove_unchanged_fields(instance, validated_data)
        return update_alert_rule_trigger_action(instance, **validated_data)
