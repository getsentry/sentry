from __future__ import absolute_import

import logging
import operator
from datetime import timedelta

from rest_framework import serializers

from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_text

from sentry.api.event_search import InvalidSearchQuery
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.environment import EnvironmentField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.incidents.logic import (
    AlertRuleNameAlreadyUsedError,
    AlertRuleTriggerLabelAlreadyUsedError,
    InvalidTriggerActionError,
    ChannelLookupTimeoutError,
    check_aggregate_column_support,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    delete_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    translate_aggregate_field,
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
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.models.user import User
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QueryDatasets
from sentry.snuba.tasks import build_snuba_filter
from sentry.utils.snuba import raw_query
from sentry.utils.compat import zip

logger = logging.getLogger(__name__)


string_to_action_type = {
    registration.slug: registration.type
    for registration in AlertRuleTriggerAction.get_registered_types()
}
action_target_type_to_string = {
    AlertRuleTriggerAction.TargetType.USER: "user",
    AlertRuleTriggerAction.TargetType.TEAM: "team",
    AlertRuleTriggerAction.TargetType.SPECIFIC: "specific",
    AlertRuleTriggerAction.TargetType.SENTRY_APP: "sentry_app",
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
        fields = ["id", "type", "target_type", "target_identifier", "integration", "sentry_app"]
        extra_kwargs = {
            "target_identifier": {"required": True},
            "target_display": {"required": False},
            "integration": {"required": False, "allow_null": True},
            "sentry_app": {"required": False, "allow_null": True},
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

        elif attrs.get("type") == AlertRuleTriggerAction.Type.SENTRY_APP:
            if not attrs.get("sentry_app"):
                raise serializers.ValidationError(
                    {"sentry_app": "SentryApp must be provided for sentry_app"}
                )
        attrs["use_async_lookup"] = self.context.get("use_async_lookup")
        return attrs

    def create(self, validated_data):
        try:
            return create_alert_rule_trigger_action(
                trigger=self.context["trigger"], **validated_data
            )
        except InvalidTriggerActionError as e:
            raise serializers.ValidationError(force_text(e))

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        try:
            return update_alert_rule_trigger_action(instance, **validated_data)
        except InvalidTriggerActionError as e:
            raise serializers.ValidationError(force_text(e))


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
                if "integration_id" in action_data:
                    action_data["integration"] = action_data.pop("integration_id")

                if "sentry_app_id" in action_data:
                    action_data["sentry_app"] = action_data.pop("sentry_app_id")

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
                        "use_async_lookup": self.context.get("use_async_lookup"),
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


class ObjectField(serializers.Field):
    def to_internal_value(self, data):
        return data


class AlertRuleSerializer(CamelSnakeModelSerializer):
    """
    Serializer for creating/updating an alert rule. Required context:
     - `organization`: The organization related to this alert rule.
     - `access`: An access object (from `request.access`)
    """

    environment = EnvironmentField(required=False, allow_null=True)
    # TODO: These might be slow for many projects, since it will query for each
    # individually. If we find this to be a problem then we can look into batching.
    projects = serializers.ListField(child=ProjectField(), required=False)
    excluded_projects = serializers.ListField(child=ProjectField(), required=False)
    triggers = serializers.ListField(required=True)
    dataset = serializers.CharField(required=False)
    query = serializers.CharField(required=True, allow_blank=True)
    time_window = serializers.IntegerField(
        required=True, min_value=1, max_value=int(timedelta(days=1).total_seconds() / 60)
    )
    threshold_period = serializers.IntegerField(default=1, min_value=1, max_value=20)
    aggregate = serializers.CharField(required=True, min_length=1)

    class Meta:
        model = AlertRule
        fields = [
            "name",
            "dataset",
            "query",
            "time_window",
            "environment",
            "threshold_type",
            "resolve_threshold",
            "threshold_period",
            "aggregate",
            "projects",
            "include_all_projects",
            "excluded_projects",
            "triggers",
        ]
        extra_kwargs = {
            "name": {"min_length": 1, "max_length": 64},
            "include_all_projects": {"default": False},
            "threshold_type": {"required": True},
            "resolve_threshold": {"required": False},
        }

    def validate_aggregate(self, aggregate):
        try:
            if not check_aggregate_column_support(aggregate):
                raise serializers.ValidationError(
                    "Invalid Metric: We do not currently support this field."
                )
        except InvalidSearchQuery as e:
            raise serializers.ValidationError("Invalid Metric: {}".format(force_text(e)))
        return translate_aggregate_field(aggregate)

    def validate_dataset(self, dataset):
        try:
            return QueryDatasets(dataset)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid dataset, valid values are %s" % [item.value for item in QueryDatasets]
            )

    def validate_threshold_type(self, threshold_type):
        try:
            return AlertRuleThresholdType(threshold_type)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid threshold type, valid values are %s"
                % [item.value for item in AlertRuleThresholdType]
            )

    def validate(self, data):
        """
        Performs validation on an alert rule's data.
        This includes ensuring there is either 1 or 2 triggers, which each have
        actions, and have proper thresholds set. The critical trigger should
        both alert and resolve 'after' the warning trigger (whether that means
        > or < the value depends on threshold type).
        """
        data.setdefault("dataset", QueryDatasets.EVENTS)
        project_id = data.get("projects")
        if not project_id:
            # We just need a valid project id from the org so that we can verify
            # the query. We don't use the returned data anywhere, so it doesn't
            # matter which.
            project_id = list(self.context["organization"].project_set.all()[:1])
        try:
            snuba_filter = build_snuba_filter(
                data["dataset"],
                data["query"],
                data["aggregate"],
                data.get("environment"),
                # TODO: We'll handle this when we add support for passing these to the
                # serializer
                None,
                params={
                    "project_id": [p.id for p in project_id],
                    "start": timezone.now() - timedelta(minutes=10),
                    "end": timezone.now(),
                },
            )
        except (InvalidSearchQuery, ValueError) as e:
            raise serializers.ValidationError("Invalid Query or Metric: {}".format(force_text(e)))
        else:
            if not snuba_filter.aggregations:
                raise serializers.ValidationError(
                    "Invalid Metric: Please pass a valid function for aggregation"
                )

            try:
                raw_query(
                    aggregations=snuba_filter.aggregations,
                    start=snuba_filter.start,
                    end=snuba_filter.end,
                    conditions=snuba_filter.conditions,
                    filter_keys=snuba_filter.filter_keys,
                    having=snuba_filter.having,
                    dataset=Dataset(data["dataset"].value),
                    limit=1,
                    referrer="alertruleserializer.test_query",
                )
            except Exception:
                logger.exception("Error while validating snuba alert rule query")
                raise serializers.ValidationError(
                    "Invalid Query or Metric: An error occurred while attempting "
                    "to run the query"
                )

        triggers = data.get("triggers", [])
        if not triggers:
            raise serializers.ValidationError("Must include at least one trigger")
        if len(triggers) > 2:
            raise serializers.ValidationError(
                "Must send 1 or 2 triggers - A critical trigger, and an optional warning trigger"
            )

        for i, (trigger, expected_label) in enumerate(
            zip(triggers, (CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL))
        ):
            if trigger.get("label", None) != expected_label:
                raise serializers.ValidationError(
                    'Trigger {} must be labeled "{}"'.format(i + 1, expected_label)
                )
        critical = triggers[0]
        threshold_type = data["threshold_type"]

        self._validate_trigger_thresholds(threshold_type, critical, data.get("resolve_threshold"))

        if len(triggers) == 2:
            warning = triggers[1]
            self._validate_trigger_thresholds(
                threshold_type, warning, data.get("resolve_threshold")
            )
            self._validate_critical_warning_triggers(threshold_type, critical, warning)

        return data

    def _validate_trigger_thresholds(self, threshold_type, trigger, resolve_threshold):
        if resolve_threshold is None:
            return
        is_integer = (
            type(trigger["alert_threshold"]) is int or trigger["alert_threshold"].is_integer()
        ) and (type(resolve_threshold) is int or resolve_threshold.is_integer())
        # Since we're comparing non-inclusive thresholds here (>, <), we need
        # to modify the values when we compare. An example of why:
        # Alert > 0, resolve < 1. This means that we want to alert on values
        # of 1 or more, and resolve on values of 0 or less. This is valid, but
        # without modifying the values, this boundary case will fail.
        if threshold_type == AlertRuleThresholdType.ABOVE:
            alert_op = operator.lt
            alert_add, resolve_add = (1, -1) if is_integer else (0, 0)
        else:
            alert_op = operator.gt
            alert_add, resolve_add = (-1, 1) if is_integer else (0, 0)

        if alert_op(trigger["alert_threshold"] + alert_add, resolve_threshold + resolve_add):
            raise serializers.ValidationError(
                "{} alert threshold must be above resolution threshold".format(trigger["label"])
            )

    def _validate_critical_warning_triggers(self, threshold_type, critical, warning):
        if threshold_type == AlertRuleThresholdType.ABOVE:
            alert_op = operator.lt
            threshold_type = "above"
        elif threshold_type == AlertRuleThresholdType.BELOW:
            alert_op = operator.gt
            threshold_type = "below"

        if alert_op(critical["alert_threshold"], warning["alert_threshold"]):
            raise serializers.ValidationError(
                "Critical trigger must have an alert threshold {} warning trigger".format(
                    threshold_type
                )
            )

    def create(self, validated_data):
        try:
            with transaction.atomic():
                triggers = validated_data.pop("triggers")
                alert_rule = create_alert_rule(
                    user=self.context.get("user", None),
                    organization=self.context["organization"],
                    **validated_data
                )
                self._handle_triggers(alert_rule, triggers)
                return alert_rule
        except AlertRuleNameAlreadyUsedError:
            raise serializers.ValidationError("This name is already in use for this organization")

    def update(self, instance, validated_data):
        triggers = validated_data.pop("triggers")
        if "id" in validated_data:
            validated_data.pop("id")
        try:
            with transaction.atomic():
                alert_rule = update_alert_rule(instance, **validated_data)
                self._handle_triggers(alert_rule, triggers)
                return alert_rule
        except AlertRuleNameAlreadyUsedError:
            raise serializers.ValidationError("This name is already in use for this organization")

    def _handle_triggers(self, alert_rule, triggers):
        channel_lookup_timeout_error = None
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
                        "use_async_lookup": self.context.get("use_async_lookup"),
                    },
                    instance=trigger_instance,
                    data=trigger_data,
                )

                if trigger_serializer.is_valid():
                    try:
                        trigger_serializer.save()
                    except ChannelLookupTimeoutError as e:
                        # raise the lookup error after the rest of the validation is complete
                        channel_lookup_timeout_error = e
                else:
                    raise serializers.ValidationError(trigger_serializer.errors)
        if channel_lookup_timeout_error:
            raise channel_lookup_timeout_error
