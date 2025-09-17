from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.workflow_engine.models import Action


class ActionSerializerResponse(TypedDict):
    id: str
    type: str
    integrationId: str | None
    data: dict
    config: dict
    status: str


@register(Action)
class ActionSerializer(Serializer):
    def serialize(self, obj: Action, *args, **kwargs) -> ActionSerializerResponse:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "integrationId": str(obj.integration_id) if obj.integration_id else None,
            "data": obj.data,
            "config": convert_dict_key_case(obj.config, snake_to_camel_case),
            "status": obj.get_status_display(),
        }
