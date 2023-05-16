from collections import defaultdict
from typing import Any, List, Mapping, MutableMapping, Optional

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.actor import ACTOR_TYPES, Actor, actor_type_to_string
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.user import User
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

        # Group actors by type (team/user)
        actor_ids_by_type = defaultdict(list)
        for actor_id, external_actor in external_actors_by_actor_id.items():
            if actor_id is not None:
                type_str = actor_type_to_string(external_actor.actor.type)
                actor_ids_by_type[type_str].append(actor_id)

        # Resolve actors to the team/user id.
        # These attributes are indexed by the actor type so that we can select
        # the right value in serialize()
        resolved_actors: MutableMapping[int, Any] = {}
        for type_str, type_id in ACTOR_TYPES.items():
            if type_str == "user":
                actors = Actor.objects.filter(type=type_id, id__in=actor_ids_by_type[type_str])
                for actor in actors:
                    resolved_actors[actor.id] = {type_str: actor.user_id}
            if type_str == "team":
                actors = Actor.objects.filter(type=type_id, id__in=actor_ids_by_type[type_str])
                for actor in actors:
                    resolved_actors[actor.id] = {type_str: actor.team_id}

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
            data["userId"] = str(attrs[key])
        elif key == "team":
            data["teamId"] = str(attrs[key])

        return data
