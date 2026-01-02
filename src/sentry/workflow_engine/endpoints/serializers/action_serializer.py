from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry


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
        # Get the action handler and config transformer if available
        action_handler = action_handler_registry.get(obj.type)
        config_transformer = action_handler.get_config_transformer()

        # Transform config if transformer is available
        if config_transformer is not None:
            config = config_transformer.to_api(obj.config)
        else:
            config = obj.config

        return {
            "id": str(obj.id),
            "type": obj.type,
            "integrationId": str(obj.integration_id) if obj.integration_id else None,
            "data": convert_dict_key_case(obj.data, snake_to_camel_case),
            "config": convert_dict_key_case(config, snake_to_camel_case),
            "status": obj.get_status_display(),
        }
