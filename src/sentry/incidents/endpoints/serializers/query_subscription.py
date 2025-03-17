from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.snuba.models import QuerySubscription, SnubaQuery


@register(SnubaQuery)
class SnubaQuerySerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SnubaQuery], user, **kwargs
    ) -> MutableMapping[SnubaQuery, dict[str, Any]]:
        prefetch_related_objects(item_list, "environment")
        return {}

    def serialize(
        self, obj: SnubaQuery, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "dataset": obj.dataset,
            "query": obj.query,
            "aggregate": obj.aggregate,
            "timeWindow": obj.time_window,
            "environment": obj.environment.name if obj.environment else None,
        }


@register(QuerySubscription)
class QuerySubscriptionSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[QuerySubscription], user, **kwargs
    ) -> MutableMapping[QuerySubscription, dict[str, Any]]:
        attrs: dict[QuerySubscription, dict[str, Any]] = defaultdict(dict)

        prefetch_related_objects(item_list, "snuba_query")
        snuba_queries = [item.snuba_query for item in item_list]
        for qs, serialized_sq in zip(item_list, serialize(snuba_queries, user=user)):
            attrs[qs]["snuba_query"] = serialized_sq

        return attrs

    def serialize(
        self, obj: QuerySubscription, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "status": obj.status,
            "subscription": obj.subscription_id,
            "snubaQuery": attrs.get("snuba_query"),
        }
