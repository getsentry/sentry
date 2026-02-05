from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer, register, serialize
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
)


@register(DataConditionGroup)
class DataConditionGroupSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataConditionGroup], user: Any, **kwargs: Any
    ) -> MutableMapping[DataConditionGroup, dict[str, Any]]:
        attrs: MutableMapping[DataConditionGroup, dict[str, Any]] = defaultdict(dict)
        conditions: defaultdict[int, list[Any]] = defaultdict(list)

        condition_list = list(DataCondition.objects.filter(condition_group__in=item_list))

        for condition, serialized in zip(condition_list, serialize(condition_list, user=user)):
            conditions[condition.condition_group_id].append(serialized)

        dcga_list = list(DataConditionGroupAction.objects.filter(condition_group__in=item_list))
        actions = {dcga.action for dcga in dcga_list}

        serialized_actions = {
            action.id: serialized
            for action, serialized in zip(actions, serialize(actions, user=user))
        }
        action_map: defaultdict[int, list[Any]] = defaultdict(list)
        for dcga in dcga_list:
            action_map[dcga.condition_group_id].append(serialized_actions[dcga.action_id])

        for item in item_list:
            attrs[item]["conditions"] = conditions.get(item.id, [])
            attrs[item]["actions"] = action_map.get(item.id, [])
        return attrs

    def serialize(
        self, obj: DataConditionGroup, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "logicType": obj.logic_type,
            "conditions": attrs.get("conditions"),
            "actions": attrs.get("actions"),
        }
