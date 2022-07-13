from datetime import datetime
from typing import Any, Mapping, MutableMapping, Sequence, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Group
from sentry.models.releaseactivity import ReleaseActivity
from sentry.utils.json import JSONData


class ReleaseActivityResponse(TypedDict):
    id: int
    type: str
    data: Mapping[str, JSONData]
    date_added: datetime


@register(ReleaseActivity)
class ReleaseActivitySerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[ReleaseActivity], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        def _update_data(d: MutableMapping[str, Any]):
            if d.get("group_id"):
                try:
                    d["group"] = Group.objects.get(id=d.get("group_id"))
                except Group.DoesNotExist:
                    d["group"] = None
                d.pop("group_id", None)
                d["group"] = serialize(d["group"])
            return d

        return {activity: _update_data(activity.data) for activity in item_list}

    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> ReleaseActivityResponse:
        return {"id": obj.id, "type": obj.type, "data": attrs, "date_added": obj.date_added}
