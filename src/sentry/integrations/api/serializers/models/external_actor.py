from collections.abc import Mapping, MutableMapping, Sequence
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.utils.providers import get_provider_string
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class ExternalActorResponseOptional(TypedDict, total=False):
    externalId: Annotated[str, ApiDescription("ID of the user or team in the provider")]
    userId: Annotated[str, ApiDescription("ID of the Sentry user. Only set for user mappings")]
    teamId: Annotated[str, ApiDescription("ID of the Sentry team. Only set for team mappings")]


class ExternalActorResponse(ExternalActorResponseOptional):
    id: Annotated[str, ApiDescription("ID of the external actor mapping")]
    provider: Annotated[
        str, ApiDescription("Provider of the external actor, such as github or slack")
    ]
    externalName: Annotated[
        str, ApiDescription("Name of the user or team in the provider, such as @octocat")
    ]
    integrationId: Annotated[str, ApiDescription("ID of the integration the mapping belongs to")]


@register(ExternalActor)
class ExternalActorSerializer(Serializer[ExternalActorResponse]):
    def get_attrs(
        self,
        item_list: Sequence[ExternalActor],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[ExternalActor, MutableMapping[str, Any]]:
        # create a mapping of external actor to a set of attributes.
        # Those attributes are either {"user": user.id} or {"team": team.id}.
        return {
            external_actor: (
                {"team": external_actor.team_id}
                if external_actor.team_id is not None
                else {"user": external_actor.user_id}
            )
            for external_actor in item_list
        }

    def serialize(
        self,
        obj: ExternalActor,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        key: str | None = None,
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
