from typing import Any, Mapping, MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models.releaseactivity import ReleaseActivity
from sentry.utils.json import JSONData


@register(ReleaseActivity)
class ReleaseActivitySerializer(Serializer):
    # def get_attrs(self, item_list, user):
    #     user_map = {d["id"]: d for d in serialize({i.user for i in item_list}, user)}
    #
    #     result = {}
    #     for item in item_list:
    #         result[item] = {"user": user_map[str(item.user_id)]}
    #     return result
    #
    # def get_attrs(self, item_list: List[Any], user: Any, **kwargs: Any) -> MutableMapping[Any, Any]:

    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        return {"id": obj.id, "type": obj.type, "data": obj.data, "date_added": obj.date_added}
