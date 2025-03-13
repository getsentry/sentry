from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, DefaultDict

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.endpoints.utils import translate_threshold
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.users.models.user import User
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowEngineDataConditionSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataCondition], user: User, **kwargs: Any
    ) -> MutableMapping[Action, MutableMapping[str, Any]]:
        data_conditions = {item.id: item for item in item_list}
        data_condition_groups = [
            data_condition.condition_group for data_condition in data_conditions.values()
        ]
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id__in=[dcg.id for dcg in data_condition_groups]
        )
        actions = Action.objects.filter(
            id__in=[dcga.action_id for dcga in data_condition_group_actions]
        ).order_by("id")
        serialized_actions = serialize(
            list(actions), user, WorkflowEngineActionSerializer(), **kwargs
        )

        result: DefaultDict[str, dict[str, list[str]]] = defaultdict(dict)
        for action, serialized in zip(actions, serialized_actions):
            dcga = data_condition_group_actions.get(action_id=action.id)
            data_condition_group = DataConditionGroup.objects.get(id=dcga.condition_group.id)
            triggers_actions = result[data_conditions[data_condition_group.id]].setdefault(
                "actions", []
            )
            triggers_actions.append(serialized)
        return result

    def serialize(
        self, obj: DataCondition, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> dict[str, Any]:
        # XXX: we are assuming that the obj/DataCondition is a detector trigger
        detector = Detector.objects.get(workflow_condition_group=obj.condition_group)

        if obj.condition_result == DetectorPriorityLevel.HIGH:
            resolve_comparison = obj.comparison
        else:
            critical_detector_trigger = DataCondition.objects.get(
                condition_group=obj.condition_group, condition_result=DetectorPriorityLevel.HIGH
            )
            resolve_comparison = critical_detector_trigger.comparison

        resolve_trigger_data_condition = DataCondition.objects.get(
            comparison=resolve_comparison,
            condition_result=DetectorPriorityLevel.OK,
            type=(
                Condition.GREATER_OR_EQUAL
                if obj.type == Condition.LESS_OR_EQUAL
                else Condition.LESS_OR_EQUAL
            ),
        )
        return {
            "id": str(obj.id),
            "alertRuleId": str(detector.id),
            "label": (
                "critical" if obj.condition_result == DetectorPriorityLevel.HIGH else "warning"
            ),
            "thresholdType": (
                AlertRuleThresholdType.ABOVE.value
                if resolve_trigger_data_condition.type == Condition.LESS_OR_EQUAL
                else AlertRuleThresholdType.BELOW.value
            ),
            "alertThreshold": translate_threshold(
                detector.config.get("comparison_delta"),
                resolve_trigger_data_condition.type,
                obj.comparison,
            ),
            "resolveThreshold": (
                AlertRuleThresholdType.ABOVE
                if resolve_trigger_data_condition.type == Condition.GREATER_OR_EQUAL
                else AlertRuleThresholdType.BELOW
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
