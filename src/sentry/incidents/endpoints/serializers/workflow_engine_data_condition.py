from collections import defaultdict
from typing import DefaultDict

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.endpoints.utils import translate_threshold
from sentry.incidents.models.alert_rule import AlertRuleTrigger
from sentry.workflow_engine.migration_helpers.alert_rule import get_threshold_type
from sentry.workflow_engine.models import Action, AlertRuleDetector, DataConditionGroupAction


class WorkflowEngineDataConditionSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        data_conditions = {item.id: item for item in item_list}

        result: DefaultDict[str, dict[str, list[str]]] = defaultdict(dict)
        data_condition_groups = [
            data_condition.condition_group for data_condition in data_conditions.values()
        ]
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id__in=[dcg.id for dcg in data_condition_groups],
        )
        actions = Action.objects.filter(
            id__in=[dcga.action_id for dcga in data_condition_group_actions]
        ).order_by("id")
        serialized_actions = serialize(list(actions), WorkflowEngineActionSerializer(), **kwargs)
        for trigger, serialized in zip(actions, serialized_actions):
            triggers_actions = result[data_conditions[trigger.alert_rule_trigger_id]].setdefault(
                "actions", []
            )
            triggers_actions.append(serialized)

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=obj.alert_rule)
        alert_rule = alert_rule_detector.alert_rule
        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule)
        detector = alert_rule_detector.detector
        return {
            "id": str(trigger.id),
            "alertRuleId": str(alert_rule.id),
            "label": obj.type,
            "thresholdType": get_threshold_type(obj.type),
            "alertThreshold": translate_threshold(
                detector.config.get("comparison_delta"), obj.type, obj.alert_threshold
            ),
            "resolveThreshold": translate_threshold(
                detector.config.get("comparison_delta"), obj.type, obj.comparison
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
