from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer, register, serialize
from sentry.workflow_engine.models import DataSource
from sentry.workflow_engine.types import DataSourceTypeHandler


@register(DataSource)
class DataSourceSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataSource], user: Any, **kwargs: Any
    ) -> MutableMapping[DataSource, dict[str, Any]]:
        attrs: dict[DataSource, dict[str, Any]] = defaultdict(dict)
        ds_by_type: dict[type[DataSourceTypeHandler[Any]], list[DataSource]] = defaultdict(list)
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
        self, obj: DataSource, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "type": obj.type,
            "sourceId": str(obj.source_id),
            "queryObj": attrs["query_obj"],
        }
