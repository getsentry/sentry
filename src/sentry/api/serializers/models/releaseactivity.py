from datetime import datetime
from typing import Any, Mapping, MutableMapping, Sequence, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Group
from sentry.models.releaseactivity import ReleaseActivity
from sentry.types.releaseactivity import ReleaseActivityType
from sentry.utils.json import JSONData


class ReleaseActivityResponse(TypedDict):
    id: int
    type: str
    data: Mapping[str, JSONData]
    date_added: datetime


@register(ReleaseActivity)
class ReleaseActivitySerializer(Serializer):  # type: ignore
    def get_attrs(
        self, item_list: Sequence[ReleaseActivity], user: Any, **kwargs: Any
    ) -> MutableMapping[ReleaseActivity, Any]:
        groups = list(
            Group.objects.filter(
                id__in=[
                    i.data.get("group_id") for i in item_list if i.data and i.data.get("group_id")
                ]
            )
        )
        serialized_groups = {g["id"]: g for g in serialize(groups, user)}

        def _expand_group(d: Mapping[str, Any]) -> Mapping[str, Any]:
            if d.get("group_id"):
                d_copy = dict(d)
                d_copy["group"] = serialized_groups.get(str(d.get("group_id")), None)
                return d_copy

            return d

        return {activity: _expand_group(activity.data) for activity in item_list}

    def serialize(
        self, obj: Any, attrs: Mapping[str, JSONData], user: Any, **kwargs: Any
    ) -> ReleaseActivityResponse:
        return {
            "id": obj.id,
            "type": str(ReleaseActivityType(obj.type).name),
            "data": attrs,
            "date_added": obj.date_added,
        }
