from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.workflow_engine.models import (
    DataConditionGroup,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.processors.workflow_fire_history import get_last_fired_dates


@register(Workflow)
class WorkflowSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Workflow], user, **kwargs
    ) -> MutableMapping[Workflow, dict[str, Any]]:
        attrs: MutableMapping[Workflow, dict[str, Any]] = defaultdict(dict)
        trigger_conditions = list(
            DataConditionGroup.objects.filter(
                id__in=[w.when_condition_group_id for w in item_list if w.when_condition_group_id]
            )
        )
        trigger_condition_map = {
            group.id: serialized
            for group, serialized in zip(
                trigger_conditions, serialize(trigger_conditions, user=user)
            )
        }

        last_triggered_map = get_last_fired_dates([w.id for w in item_list])

        wdcg_list = list(WorkflowDataConditionGroup.objects.filter(workflow__in=item_list))
        condition_groups = {wdcg.condition_group for wdcg in wdcg_list}

        serialized_condition_groups = {
            dcg.id: serialized
            for dcg, serialized in zip(condition_groups, serialize(condition_groups, user=user))
        }
        dcg_map = defaultdict(list)
        for wdcg in wdcg_list:
            dcg_map[wdcg.workflow_id].append(serialized_condition_groups[wdcg.condition_group_id])

        detectors_map = defaultdict(list)
        detector_workflows = DetectorWorkflow.objects.filter(workflow__in=item_list).values_list(
            "detector_id", "workflow_id"
        )
        for detector_id, workflow_id in detector_workflows:
            detectors_map[workflow_id].append(str(detector_id))

        for item in item_list:
            attrs[item]["triggers"] = trigger_condition_map.get(
                item.when_condition_group_id
            )  # when condition group
            attrs[item]["actionFilters"] = dcg_map.get(
                item.id, []
            )  # The data condition groups for filtering actions
            attrs[item]["detectorIds"] = detectors_map[item.id]
            attrs[item]["lastTriggered"] = last_triggered_map.get(item.id)
        return attrs

    def serialize(self, obj: Workflow, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "name": str(obj.name),
            "organizationId": str(obj.organization_id),
            "createdBy": str(obj.created_by_id) if obj.created_by_id else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "triggers": attrs.get("triggers"),
            "actionFilters": attrs.get("actionFilters"),
            "environment": obj.environment.name if obj.environment else None,
            "config": convert_dict_key_case(obj.config, snake_to_camel_case),
            "detectorIds": attrs.get("detectorIds"),
            "enabled": obj.enabled,
            "lastTriggered": attrs.get("lastTriggered"),
        }
