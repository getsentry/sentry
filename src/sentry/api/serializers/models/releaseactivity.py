from typing import Any, Mapping, MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models.releaseactivity import ReleaseActivity
from sentry.utils.json import JSONData


@register(ReleaseActivity)
class ReleaseActivitySerializer(Serializer):
    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        return {"id": obj.id, "type": obj.type, "data": obj.data, "date_added": obj.date_added}
