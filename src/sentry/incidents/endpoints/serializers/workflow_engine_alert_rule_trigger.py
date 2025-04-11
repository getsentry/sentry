from collections import defaultdict
from typing import DefaultDict

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.utils import translate_threshold
from sentry.workflow_engine.models import Action, DataConditionGroupAction


class WorkflowEngineAlertRuleTriggerSerializer(Serializer):
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
        # TODO create action serializer
        serialized_actions = serialize(list(actions), **kwargs)
        for trigger, serialized in zip(actions, serialized_actions):
            triggers_actions = result[data_conditions[trigger.alert_rule_trigger_id]].setdefault(
                "actions", []
            )
            triggers_actions.append(serialized)

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        # TODO update all this
        return {
            "id": str(obj.id),
            "alertRuleId": str(obj.alert_rule_id),
            "label": obj.label,
            "thresholdType": obj.alert_rule.threshold_type,
            "alertThreshold": translate_threshold(obj.alert_rule, obj.alert_threshold),
            "resolveThreshold": translate_threshold(
                obj.alert_rule, obj.alert_rule.resolve_threshold
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
