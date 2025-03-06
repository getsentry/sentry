import logging
import operator
from datetime import timedelta

from django import forms
from django.conf import settings
from django.db import router, transaction
from parsimonious.exceptions import ParseError
from rest_framework import serializers
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import features
from sentry.api.exceptions import BadRequest, RequestTimeout
from sentry.api.fields.actor import ActorField
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.environment import EnvironmentField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    WARNING_TRIGGER_LABEL,
    ChannelLookupTimeoutError,
    create_alert_rule,
    delete_alert_rule_trigger,
    update_alert_rule,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
)
from sentry.snuba.models import QuerySubscription
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.workflow_engine.migration_helpers.alert_rule import (
    dual_delete_migrated_alert_rule_trigger,
    dual_update_resolve_condition,
    migrate_alert_rule,
    migrate_resolve_threshold_data_conditions,
)

from .alert_rule_trigger import AlertRuleTriggerSerializer

logger = logging.getLogger(__name__)


class AlertRuleSerializer(SnubaQueryValidator, CamelSnakeModelSerializer[AlertRule]):
    """
    Serializer for creating/updating an alert rule. Required context:
     - `organization`: The organization related to this alert rule.
     - `access`: An access object (from `request.access`)
     - `user`: The user from `request.user`
    """

    environment = EnvironmentField(required=False, allow_null=True)
    projects = serializers.ListField(
        child=ProjectField(scope="project:read"),
        required=False,
        max_length=1,
    )
    triggers = serializers.ListField(required=True)
    query_type = serializers.IntegerField(required=False)
    dataset = serializers.CharField(required=False)
    event_types = serializers.ListField(child=serializers.CharField(), required=False)
    query = serializers.CharField(required=True, allow_blank=True)
    time_window = serializers.IntegerField(
        required=True, min_value=1, max_value=int(timedelta(days=1).total_seconds() / 60)
    )
    threshold_period = serializers.IntegerField(default=1, min_value=1, max_value=20)
    comparison_delta = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=int(timedelta(days=89).total_seconds() / 60),
        allow_null=True,
    )
    aggregate = serializers.CharField(required=True, min_length=1)

    # This will be set to required=True once the frontend starts sending it.
    owner = ActorField(required=False, allow_null=True)

    description = serializers.CharField(required=False, allow_blank=True)
    sensitivity = serializers.CharField(required=False, allow_null=True)
    seasonality = serializers.CharField(required=False, allow_null=True)
    detection_type = serializers.CharField(required=False, default=AlertRuleDetectionType.STATIC)

    class Meta:
        model = AlertRule
        fields = [
            "name",
            "owner",
            "query_type",
            "dataset",
            "query",
            "time_window",
            "environment",
            "threshold_type",
            "resolve_threshold",
            "threshold_period",
            "comparison_delta",
            "aggregate",
            "projects",
            "triggers",
            "event_types",
            "description",
            "sensitivity",
            "seasonality",
            "detection_type",
        ]
        extra_kwargs = {
            "name": {"min_length": 1, "max_length": 256},
            "threshold_type": {"required": True},
            "resolve_threshold": {"required": False},
        }

    threshold_translators = {
        AlertRuleThresholdType.ABOVE: lambda threshold: threshold + 100,
        AlertRuleThresholdType.BELOW: lambda threshold: 100 - threshold,
    }

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
        data = super().validate(data)

        triggers = data.get("triggers", [])
        if not triggers:
            raise serializers.ValidationError("Must include at least one trigger")
        if len(triggers) > 2:
            raise serializers.ValidationError(
                "Must send 1 or 2 triggers - A critical trigger, and an optional warning trigger"
            )
        for trigger in triggers:
            if not trigger.get("actions", []):
                raise serializers.ValidationError(
                    "Each trigger must have an associated action for this alert to fire."
                )

        for i, (trigger, expected_label) in enumerate(
            zip(triggers, (CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL))
        ):
            if trigger.get("label", None) != expected_label:
                raise serializers.ValidationError(
                    f'Trigger {i + 1} must be labeled "{expected_label}"'
                )
        threshold_type = data["threshold_type"]
        self._translate_thresholds(threshold_type, data.get("comparison_delta"), triggers, data)

        critical = triggers[0]
        self._validate_trigger_thresholds(threshold_type, critical, data.get("resolve_threshold"))

        if len(triggers) == 2:
            warning = triggers[1]
            self._validate_trigger_thresholds(
                threshold_type, warning, data.get("resolve_threshold")
            )
            self._validate_critical_warning_triggers(threshold_type, critical, warning)

        return data

    def _translate_thresholds(self, threshold_type, comparison_delta, triggers, data):
        """
        Performs transformations on the thresholds used in the alert. Currently this is used to
        translate thresholds for comparison alerts. The frontend will pass in the delta percent
        change. So a 30% increase, 40% decrease, etc. We want to change this to the total percentage
        we expect when comparing values. So 130% for a 30% increase, 60% for a 40% decrease, etc.
        This makes these threshold operate in the same way as our other thresholds.
        """
        if comparison_delta is None:
            return

        translator = self.threshold_translators.get(threshold_type)
        if not translator:
            raise serializers.ValidationError(
                "Invalid threshold type: Allowed types for comparison alerts are above OR below"
            )

        resolve_threshold = data.get("resolve_threshold")
        if resolve_threshold:
            data["resolve_threshold"] = translator(resolve_threshold)
        for trigger in triggers:
            trigger["alert_threshold"] = translator(trigger["alert_threshold"])

    def _validate_trigger_thresholds(self, threshold_type, trigger, resolve_threshold):
        if trigger.get("alert_threshold") is None:
            raise serializers.ValidationError("Trigger must have an alertThreshold")

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
            alert_op = operator.le
            alert_add, resolve_add = (1, -1) if is_integer else (0, 0)
        else:
            alert_op = operator.ge
            alert_add, resolve_add = (-1, 1) if is_integer else (0, 0)

        if alert_op(trigger["alert_threshold"] + alert_add, resolve_threshold + resolve_add):
            raise serializers.ValidationError(
                f"{trigger['label']} alert threshold must be {threshold_type.name.lower()} resolution threshold"
            )

    def _validate_critical_warning_triggers(self, threshold_type, critical, warning):
        if threshold_type == AlertRuleThresholdType.ABOVE:
            alert_op = operator.lt
            threshold_type = "above"
        else:
            alert_op = operator.gt
            threshold_type = "below"

        if alert_op(critical["alert_threshold"], warning["alert_threshold"]):
            raise serializers.ValidationError(
                f"Critical trigger must have an alert threshold {threshold_type} warning trigger"
            )

    def create(self, validated_data):
        org_subscription_count = QuerySubscription.objects.filter(
            project__organization_id=self.context["organization"].id,
            status__in=(
                QuerySubscription.Status.ACTIVE.value,
                QuerySubscription.Status.CREATING.value,
                QuerySubscription.Status.UPDATING.value,
            ),
        ).count()

        if org_subscription_count >= settings.MAX_QUERY_SUBSCRIPTIONS_PER_ORG:
            raise serializers.ValidationError(
                f"You may not exceed {settings.MAX_QUERY_SUBSCRIPTIONS_PER_ORG} metric alerts per organization"
            )
        with transaction.atomic(router.db_for_write(AlertRule)):
            triggers = validated_data.pop("triggers")
            user = self.context.get("user", None)
            try:
                alert_rule = create_alert_rule(
                    user=user,
                    organization=self.context["organization"],
                    ip_address=self.context.get("ip_address"),
                    **validated_data,
                )
            except (TimeoutError, MaxRetryError):
                raise RequestTimeout
            except ParseError:
                raise serializers.ValidationError("Failed to parse Seer store data response")
            except forms.ValidationError as e:
                # if we fail in create_metric_alert, then only one message is ever returned
                raise serializers.ValidationError(e.error_list[0].message)
            except Exception as e:
                logger.exception(
                    "Error when creating alert rule",
                    extra={"details": str(e)},
                )
                raise BadRequest

            # NOTE (mifu67): skip dual writing anomaly detection alerts until we figure out how to handle them
            should_dual_write = (
                features.has(
                    "organizations:workflow-engine-metric-alert-dual-write", alert_rule.organization
                )
                and alert_rule.detection_type != AlertRuleDetectionType.DYNAMIC
            )
            if should_dual_write:
                migrate_alert_rule(alert_rule, user)

            self._handle_triggers(alert_rule, triggers)
            if should_dual_write:
                migrate_resolve_threshold_data_conditions(alert_rule)

            return alert_rule

    def update(self, instance, validated_data):
        triggers = validated_data.pop("triggers")
        if "id" in validated_data:
            validated_data.pop("id")
        with transaction.atomic(router.db_for_write(AlertRule)):
            try:
                alert_rule = update_alert_rule(
                    instance,
                    user=self.context.get("user", None),
                    ip_address=self.context.get("ip_address"),
                    **validated_data,
                )
            except (TimeoutError, MaxRetryError):
                raise RequestTimeout
            except ParseError:
                raise serializers.ValidationError("Failed to parse Seer store data response")
            except forms.ValidationError as e:
                # if we fail in update_metric_alert, then only one message is ever returned
                raise serializers.ValidationError(e.error_list[0].message)
            except Exception as e:
                logger.exception(
                    "Error when updating alert rule",
                    extra={"details": str(e)},
                )
                raise BadRequest
            self._handle_triggers(alert_rule, triggers)
            return alert_rule

    def _handle_triggers(self, alert_rule, triggers):
        channel_lookup_timeout_error = None
        if triggers is not None:
            # Delete triggers we don't have present in the incoming data
            trigger_ids = [x["id"] for x in triggers if "id" in x]
            triggers_to_delete = AlertRuleTrigger.objects.filter(alert_rule=alert_rule).exclude(
                id__in=trigger_ids
            )
            for trigger in triggers_to_delete:
                with transaction.atomic(router.db_for_write(AlertRuleTrigger)):
                    dual_delete_migrated_alert_rule_trigger(trigger)
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
                        "user": self.context["user"],
                        "use_async_lookup": self.context.get("use_async_lookup"),
                        "input_channel_id": self.context.get("input_channel_id"),
                        "validate_channel_id": self.context.get("validate_channel_id", True),
                        "installations": self.context.get("installations"),
                        "integrations": self.context.get("integrations"),
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
            # after all the triggers have been processed, dual update the resolve data condition if necessary
            # if an error occurs in this method, it won't affect the alert rule triggers, which have already been saved
            dual_update_resolve_condition(alert_rule)
        if channel_lookup_timeout_error:
            raise channel_lookup_timeout_error
