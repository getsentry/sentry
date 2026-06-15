from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class DeploySerializerResponse(TypedDict):
    id: str
    environment: str | None
    dateStarted: datetime | None
    dateFinished: datetime
    name: str | None
    url: str | None


@register(Deploy)
class DeploySerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Deploy], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        environments = {
            id: name
            for id, name in Environment.objects.filter(
                id__in=[d.environment_id for d in item_list]
            ).values_list("id", "name")
        }

        result = {}
        for item in item_list:
            result[item] = {"environment": environments.get(item.environment_id)}

        return result

    def serialize(
        self,
        obj: Deploy,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> DeploySerializerResponse:
        return {
            "id": str(obj.id),
            "environment": attrs.get("environment"),
            "dateStarted": obj.date_started,
            "dateFinished": obj.date_finished,
            "name": obj.name,
            "url": obj.url,
        }
