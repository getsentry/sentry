from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer, register, serialize
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)


@register(DataSource)
class DataSourceSerializer(Serializer):
    def serialize(self, obj: DataSource, attrs: Mapping[str, Any], user, **kwargs):
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "type": obj.type,
            "queryId": str(obj.query_id),
        }


@register(DataCondition)
class DataConditionSerializer(Serializer):
    def serialize(self, obj: DataCondition, *args, **kwargs):
        return {
            "id": str(obj.id),
            "condition": obj.condition,
            "comparison": obj.comparison,
            "result": obj.condition_result,
        }


@register(DataConditionGroup)
class DataConditionGroupSerializer(Serializer):
    def get_attrs(self, item_list: Sequence[DataConditionGroup], user, **kwargs):
        attrs: Mapping[DataConditionGroup, Any] = defaultdict(dict)
        conditions = defaultdict(list)

        condition_list = list(DataCondition.objects.filter(condition_group__in=item_list))

        for condition, serialized in zip(condition_list, serialize(condition_list, user=user)):
            conditions[condition.condition_group_id].append(serialized)

        for item in item_list:
            attrs[item]["conditions"] = conditions.get(item.id, [])

        return attrs

    def serialize(self, obj: DataConditionGroup, attrs: Mapping[str, Any], user, **kwargs):
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "logicType": obj.logic_type,
            "conditions": attrs.get("conditions"),
        }


@register(Detector)
class DetectorSerializer(Serializer):
    def get_attrs(self, item_list: Sequence[Detector], user, **kwargs):
        attrs: Mapping[Detector, Any] = defaultdict(dict)

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

        for item in item_list:
            attrs[item]["data_sources"] = ds_map.get(item.id)
            attrs[item]["condition_group"] = condition_group_map.get(
                str(item.workflow_condition_group_id)
            )

        return attrs

    def serialize(self, obj: Detector, attrs: Mapping[str, Any], user, **kwargs):
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "name": obj.name,
            "type": obj.type,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dataSources": attrs.get("data_sources"),
            "conditionGroup": attrs.get("condition_group"),
        }
