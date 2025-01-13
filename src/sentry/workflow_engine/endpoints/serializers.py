from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer, register, serialize
from sentry.issues.grouptype import ErrorGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition_group_action import DataConditionGroupAction
from sentry.workflow_engine.types import DataSourceTypeHandler


@register(Action)
class ActionSerializer(Serializer):
    def serialize(self, obj: Action, *args, **kwargs):
        return {
            "id": str(obj.id),
            "type": obj.type,
            "data": json.dumps(obj.data),
        }


@register(DataSource)
class DataSourceSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataSource], user: Any, **kwargs: Any
    ) -> MutableMapping[DataSource, dict[str, Any]]:
        attrs: dict[DataSource, dict[str, Any]] = defaultdict(dict)
        ds_by_type: dict[type[DataSourceTypeHandler], list[DataSource]] = defaultdict(list)
        for item in item_list:
            ds_by_type[item.type_handler].append(item)

        serialized_query_objs: dict[int, dict[str, Any]] = {}

        for type_handler, ds_items in ds_by_type.items():
            ds_query_objs = list(type_handler.bulk_get_query_object(ds_items).items())
            serialized: list[dict[str, Any]] = serialize(
                [query_obj for ds, query_obj in ds_query_objs], user=user
            )
            serialized_query_objs.update(
                {
                    ds_id: serialized_obj
                    for (ds_id, query_obj), serialized_obj in zip(ds_query_objs, serialized)
                }
            )
        for item in item_list:
            attrs[item]["query_obj"] = serialized_query_objs.get(item.id, [])

        return attrs

    def serialize(
        self, obj: DataSource, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "type": obj.type,
            "queryId": str(obj.query_id),
            "queryObj": attrs["query_obj"],
        }


@register(DataCondition)
class DataConditionSerializer(Serializer):
    def serialize(self, obj: DataCondition, *args, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "condition": obj.type,
            "comparison": obj.comparison,
            "result": obj.condition_result,
        }


@register(DataConditionGroup)
class DataConditionGroupSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataConditionGroup], user, **kwargs
    ) -> MutableMapping[DataConditionGroup, dict[str, Any]]:
        attrs: MutableMapping[DataConditionGroup, dict[str, Any]] = defaultdict(dict)
        conditions = defaultdict(list)

        condition_list = list(DataCondition.objects.filter(condition_group__in=item_list))

        for condition, serialized in zip(condition_list, serialize(condition_list, user=user)):
            conditions[condition.condition_group_id].append(serialized)

        dcga_list = list(DataConditionGroupAction.objects.filter(condition_group__in=item_list))
        actions = {dcga.action for dcga in dcga_list}

        serialized_actions = {
            action.id: serialized
            for action, serialized in zip(actions, serialize(actions, user=user))
        }
        action_map = defaultdict(list)
        for dcga in dcga_list:
            action_map[dcga.condition_group_id].append(serialized_actions[dcga.action_id])

        for item in item_list:
            attrs[item]["conditions"] = conditions.get(item.id, [])
            attrs[item]["actions"] = action_map.get(item.id, [])
        return attrs

    def serialize(
        self, obj: DataConditionGroup, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "logicType": obj.logic_type,
            "conditions": attrs.get("conditions"),
            "actions": attrs.get("actions"),
        }


@register(Detector)
class DetectorSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Detector], user, **kwargs
    ) -> MutableMapping[Detector, dict[str, Any]]:
        attrs: MutableMapping[Detector, dict[str, Any]] = defaultdict(dict)

        dsd_list = list(
            DataSourceDetector.objects.filter(detector__in=item_list).select_related("data_source")
        )
        data_sources = {dsd.data_source for dsd in dsd_list}
        serialized_data_sources = {
            ds.id: serialized
            for ds, serialized in zip(data_sources, serialize(data_sources, user=user))
        }
        ds_map = defaultdict(list)
        for dsd in dsd_list:
            ds_map[dsd.detector_id].append(serialized_data_sources[dsd.data_source_id])

        condition_groups = list(
            DataConditionGroup.objects.filter(
                id__in=[
                    d.workflow_condition_group_id
                    for d in item_list
                    if d.workflow_condition_group_id
                ]
            )
        )
        condition_group_map = {
            str(group.id): serialized
            for group, serialized in zip(condition_groups, serialize(condition_groups, user=user))
        }

        filtered_item_list = [item for item in item_list if item.type == ErrorGroupType.slug]
        project_ids = [item.project_id for item in filtered_item_list]

        project_options_list = list(
            ProjectOption.objects.filter(
                key__in=Detector.error_detector_project_options.values(), project__in=project_ids
            )
        )

        configs: dict[int, dict[str, Any]] = defaultdict(
            dict
        )  # make the config for Error Detectors
        for option in project_options_list:
            configs[option.project_id][option.key] = option.value

        for item in item_list:
            attrs[item]["data_sources"] = ds_map.get(item.id)
            attrs[item]["condition_group"] = condition_group_map.get(
                str(item.workflow_condition_group_id)
            )
            if item.id in configs:
                attrs[item]["config"] = configs[item.id]
            else:
                attrs[item]["config"] = item.config

        return attrs

    def serialize(self, obj: Detector, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "name": obj.name,
            "type": obj.type,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dataSources": attrs.get("data_sources"),
            "conditionGroup": attrs.get("condition_group"),
            "config": attrs.get("config"),
        }


@register(Workflow)
class WorkflowSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
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

        wdcg_list = list(WorkflowDataConditionGroup.objects.filter(workflow__in=item_list))
        condition_groups = {wdcg.condition_group for wdcg in wdcg_list}

        serialized_condition_groups = {
            dcg.id: serialized
            for dcg, serialized in zip(condition_groups, serialize(condition_groups, user=user))
        }
        dcg_map = defaultdict(list)
        for wdcg in wdcg_list:
            dcg_map[wdcg.workflow_id].append(serialized_condition_groups[wdcg.condition_group_id])

        for item in item_list:
            attrs[item]["trigger_condition_group"] = trigger_condition_map.get(
                item.when_condition_group_id
            )  # when condition group
            attrs[item]["data_condition_groups"] = dcg_map.get(
                item.id, []
            )  # data condition groups associated with workflow via WorkflowDataConditionGroup lookup table
        return attrs

    def serialize(self, obj: Workflow, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        # WHAT TO DO ABOUT CONFIG?
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "triggerConditionGroup": attrs.get("trigger_condition_group"),
            "dataConditionGroups": attrs.get("data_condition_groups"),
            "environment": obj.environment.name if obj.environment else None,
        }
