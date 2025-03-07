from collections import defaultdict
from typing import DefaultDict

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.endpoints.utils import translate_threshold
from sentry.incidents.models.alert_rule import (
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)

# from sentry.workflow_engine.migration_helpers.alert_rule import get_threshold_type
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    DataCondition,
    DataConditionGroupAction,
    Detector,
)

# from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowEngineDataConditionSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        data_conditions = {item.id: item for item in item_list}
        data_condition_groups = [
            data_condition.condition_group for data_condition in data_conditions.values()
        ]
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id__in=[dcg.id for dcg in data_condition_groups]
        )
        aartas = ActionAlertRuleTriggerAction.objects.filter(
            action__in=[dcga.action.id for dcga in data_condition_group_actions]
        )
        rule_actions = AlertRuleTriggerAction.objects.filter(
            alert_rule_trigger__in=[aarta.alert_rule_trigger_action.id for aarta in aartas]
        ).order_by("id")

        actions = Action.objects.filter(
            id__in=[dcga.action_id for dcga in data_condition_group_actions]
        ).order_by("id")
        serialized_actions = serialize(
            list(actions), user, WorkflowEngineActionSerializer(), **kwargs
        )

        result: DefaultDict[str, dict[str, list[str]]] = defaultdict(dict)
        for action, serialized in zip(rule_actions, serialized_actions):
            dcga = data_condition_group_actions.get(action_id=action.id)
            data_condition = DataCondition.objects.filter(
                condition_group=dcga.condition_group
            ).first()
            triggers_actions = result[data_conditions[data_condition.id]].setdefault("actions", [])
            triggers_actions.append(serialized)
        return result

    def serialize(self, obj, attrs, user, **kwargs):
        # we are assuming that the obj/DataCondition is a detector trigger here
        detector = Detector.objects.get(workflow_condition_group=obj.condition_group)
        alert_rule_detector = AlertRuleDetector.objects.get(detector=detector)
        alert_rule = alert_rule_detector.alert_rule
        label = "critical" if obj.condition_result == DetectorPriorityLevel.HIGH else "warning"
        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule, label=label)
        # resolve_trigger = DataCondition.objects.get(
        #     comparison=alert_rule.resolve_threshold,
        #     condition_result=DetectorPriorityLevel.OK,
        #     type=Condition.LESS_OR_EQUAL.value if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value else Condition.GREATER_OR_EQUAL.value,
        # )
        # threshold_type = AlertRuleThresholdType.ABOVE if resolve_trigger.type == Condition.GREATER_OR_EQUAL else AlertRuleThresholdType.BELOW
        return {
            "id": str(trigger.id),
            "alertRuleId": str(alert_rule.id),
            "label": label,
            "thresholdType": AlertRuleThresholdType.ABOVE.value,  # what to do if there isn't a resolve trigger?
            "alertThreshold": translate_threshold(
                detector.config.get("comparison_delta"),
                AlertRuleThresholdType.ABOVE.value,
                obj.comparison,
            ),  # dont hardcode threshold type
            # "resolveThreshold": translate_threshold(
            #     detector.config.get("comparison_delta"), threshold_type, obj.comparison
            # ),
            "resolveThreshold": None,
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
