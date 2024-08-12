from collections.abc import MutableMapping, Sequence
from typing import Any, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.types.actor import Actor
from sentry.uptime.models import ProjectUptimeSubscription


class ProjectUptimeSubscriptionSerializerResponse(TypedDict):
    id: str
    projectSlug: str
    name: str
    status: int
    mode: int
    url: str
    intervalSeconds: int
    timeoutMs: int
    owner: ActorSerializerResponse


@register(ProjectUptimeSubscription)
class ProjectUptimeSubscriptionSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand

    def get_attrs(
        self, item_list: Sequence[ProjectUptimeSubscription], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        prefetch_related_objects(item_list, "uptime_subscription", "project")
        owners = list(filter(None, [item.owner for item in item_list]))
        owners_serialized = serialize(
            Actor.resolve_many(owners, filter_none=False), user, ActorSerializer()
        )
        serialized_owner_lookup = {
            owner: serialized_owner for owner, serialized_owner in zip(owners, owners_serialized)
        }

        return {
            item: {"owner": serialized_owner_lookup.get(item.owner) if item.owner else None}
            for item in item_list
        }

    def serialize(
        self, obj: ProjectUptimeSubscription, attrs, user, **kwargs
    ) -> ProjectUptimeSubscriptionSerializerResponse:
        return {
            "id": str(obj.id),
            "projectSlug": obj.project.slug,
            "name": obj.name or f"Uptime Monitoring for {obj.uptime_subscription.url}",
            "status": obj.uptime_status,
            "mode": obj.mode,
            "url": obj.uptime_subscription.url,
            "intervalSeconds": obj.uptime_subscription.interval_seconds,
            "timeoutMs": obj.uptime_subscription.timeout_ms,
            "owner": attrs["owner"],
        }
