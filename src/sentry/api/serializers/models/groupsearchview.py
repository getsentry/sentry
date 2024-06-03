from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "query": obj.query,
            "querySort": obj.query_sort,
            "position": obj.position,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
