from typing import Any, Mapping

from sentry.api.serializers import Serializer, register
from sentry.models import ExternalActor
from sentry.types.integrations import get_provider_string


@register(ExternalActor)
class ExternalActorSerializer(Serializer):
    def serialize(
        self, obj: ExternalActor, attrs: Mapping[Any, Any], user: Any, **kwargs
    ) -> Mapping[str, Any]:
        provider = get_provider_string(obj.provider)
        data = {
            "id": str(obj.id),
            "provider": provider,
            "externalName": obj.external_name,
        }

        if obj.external_id:
            data["externalId"] = obj.external_id

        # Extra context `key` tells the API how to resolve actor_id.
        key = kwargs.pop("key", None)
        if key == "user":
            data["userId"] = str(obj.actor.resolve().id)
        elif key == "team":
            data["teamId"] = str(obj.actor.resolve().id)
        else:
            data["actorId"] = str(obj.actor.id)

        return data
