from collections import defaultdict
from typing import Any, List, Mapping, MutableMapping, Optional

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models import (
    ACTOR_TYPES,
    ExternalActor,
    User,
    actor_type_to_class,
    actor_type_to_string,
)
from sentry.types.integrations import get_provider_string


class ExternalActorResponseOptional(TypedDict, total=False):
    externalId: str
    userId: str
    teamId: str


class ExternalActorResponse(ExternalActorResponseOptional):
    id: str
    provider: str
    externalName: str
    integrationId: str


@register(ExternalActor)
class ExternalActorSerializer(Serializer):  # type: ignore
    def get_attrs(
        self, item_list: List[ExternalActor], user: User, **kwargs: Any
    ) -> MutableMapping[ExternalActor, MutableMapping[str, Any]]:
        # get all of the actor ids we need to lookup
        external_actors_by_actor_id = {
            external_actor.actor_id: external_actor for external_actor in item_list
        }

        # iterating over each actor id and split it up by type.
        actor_ids_by_type = defaultdict(list)
        for actor_id, external_actor in external_actors_by_actor_id.items():
            if actor_id is not None:
                type_str = actor_type_to_string(external_actor.actor.type)
                actor_ids_by_type[type_str].append(actor_id)

        # each actor id maps to an object
        resolved_actors: MutableMapping[int, Any] = {}
        for type_str, type_id in ACTOR_TYPES.items():
            klass = actor_type_to_class(type_id)
            actor_ids = actor_ids_by_type[type_str]

            for model in klass.objects.filter(actor_id__in=actor_ids):
                resolved_actors[model.actor_id] = {type_str: model}

        # create a mapping of external actor to a set of attributes. Those attributes are either {"user": User} or {"team": Team}.
        return {
            external_actor: resolved_actors[external_actor.actor_id] for external_actor in item_list
        }

    def serialize(
        self,
        obj: ExternalActor,
        attrs: Mapping[str, Any],
        user: User,
        key: Optional[str] = None,
        **kwargs: Any,
    ) -> ExternalActorResponse:
        provider = get_provider_string(obj.provider)
        data: ExternalActorResponse = {
            "id": str(obj.id),
            "provider": provider,
            "externalName": obj.external_name,
            "integrationId": str(obj.integration_id),
        }

        if obj.external_id:
            data["externalId"] = obj.external_id

        # Extra context `key` tells the API how to resolve actor_id.
        if key == "user":
            data["userId"] = str(attrs[key].id)
        elif key == "team":
            data["teamId"] = str(attrs[key].id)

        return data
