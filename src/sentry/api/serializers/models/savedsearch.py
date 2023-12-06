from sentry.api.serializers import Serializer, register
from sentry.models.savedsearch import SavedSearch


@register(SavedSearch)
class SavedSearchSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "type": obj.type,
            "name": obj.name,
            "query": obj.query,
            "sort": obj.sort,
            "visibility": obj.visibility,
            "dateCreated": obj.date_added,
            "isGlobal": obj.is_global,
            "isPinned": obj.is_pinned,
        }
