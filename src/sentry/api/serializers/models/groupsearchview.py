from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.savedsearch import SORT_LITERALS


class GroupSearchViewSerializerResponse(TypedDict):
    id: str
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    dateCreated: str | None
    dateUpdated: str | None


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> GroupSearchViewSerializerResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "query": obj.query,
            "querySort": obj.query_sort,
            "position": obj.position,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
