from collections import defaultdict
from typing import Any, List, Mapping, MutableMapping, Optional

from sentry.api.serializers import Serializer, register
from sentry.models import (
    ACTOR_TYPES,
    ExternalActor,
    User,
    actor_type_to_class,
    actor_type_to_string,
)
from sentry.types.integrations import get_provider_string


@register(ExternalActor)
class ExternalActorSerializer(Serializer):  # type: ignore
    def get_attrs(
        self, item_list: List[ExternalActor], user: User, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        external_actors_by_actor_id = {
            external_actor.actor_id: external_actor for external_actor in item_list
        }

        actor_ids_by_type = defaultdict(list)
        for actor_id, external_actor in external_actors_by_actor_id.items():
            if actor_id is not None:
                type_str = actor_type_to_string(external_actor.actor.type)
                actor_ids_by_type[type_str].append(actor_id)

        resolved_actors_by_type: MutableMapping[str, Mapping[int, int]] = defaultdict(dict)
        for type_str, type_id in ACTOR_TYPES.items():
            klass = actor_type_to_class(type_id)
            actor_ids = actor_ids_by_type[type_str]

            resolved_actors = klass.objects.filter(actor_id__in=actor_ids)

            resolved_actors_by_type[type_str] = {model.actor_id: model for model in resolved_actors}

        results: MutableMapping[ExternalActor, MutableMapping[str, Any]] = defaultdict(dict)
        for type_str, mapping in resolved_actors_by_type.items():
            for actor_id, model in mapping.items():
                external_actor = external_actors_by_actor_id[actor_id]
                results[external_actor][type_str] = model

        return results

    def serialize(
        self,
        obj: ExternalActor,
        attrs: Mapping[str, Any],
        user: User,
        key: Optional[str] = None,
        **kwargs: Any,
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
        if key == "user":
            data["userId"] = str(attrs[key].id)
        elif key == "team":
            data["teamId"] = str(attrs[key].id)

        return data
