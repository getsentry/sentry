from typing import Any, List, Mapping, MutableMapping, Optional

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.actor import Actor, actor_type_to_string
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
        # Get all of the actor ids we need to lookup
        external_actors_by_actor_id = {
            external_actor.actor_id: external_actor for external_actor in item_list
        }

        # Fetch all the actors and build the resolved_actors payloads per external_actor
        # These attributes are indexed by the actor type so that we can select
        # the right value in serialize()
        resolved_actors: MutableMapping[int, Any] = {}
        actor_ids = list(external_actors_by_actor_id.keys())
        for actor in Actor.objects.filter(id__in=actor_ids):
            type_str = actor_type_to_string(actor.type)
            if type_str == "user":
                resolved_actors[actor.id] = {type_str: actor.user_id}
            if type_str == "team":
                resolved_actors[actor.id] = {type_str: actor.team_id}

        # create a mapping of external actor to a set of attributes.
        # Those attributes are either {"user": user.id} or {"team": team.id}.
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
