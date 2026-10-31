from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count

from sentry.api.serializers import Serializer, register
from sentry.auth.principal import has_user
from sentry.models.broadcast import Broadcast, BroadcastSeen
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class BroadcastSerializerResponse(TypedDict):
    id: str
    message: str
    title: str
    link: str | None
    mediaUrl: str | None
    isActive: bool
    dateCreated: datetime
    dateExpires: datetime | None
    hasSeen: bool
    category: str | None


class AdminBroadcastSerializerResponse(BroadcastSerializerResponse):
    userCount: int
    createdBy: str | None
    upstreamId: str | None
    syncLocked: bool


@register(Broadcast)
class BroadcastSerializer(Serializer[BroadcastSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[Broadcast],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[Broadcast, dict[str, object]]:
        if not has_user(user):
            seen = set()
        else:
            seen = set(
                BroadcastSeen.objects.filter(broadcast__in=item_list, user_id=user.id).values_list(
                    "broadcast", flat=True
                )
            )

        return {item: {"seen": item.id in seen} for item in item_list}

    def serialize(
        self,
        obj: Broadcast,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> BroadcastSerializerResponse:
        return {
            "id": str(obj.id),
            "message": obj.message,
            "title": obj.title,
            "link": obj.link,
            "mediaUrl": obj.media_url,
            "isActive": obj.is_active,
            "dateCreated": obj.date_added,
            "dateExpires": obj.date_expires,
            "hasSeen": cast(bool, attrs["seen"]),
            "category": obj.category,
        }


class AdminBroadcastSerializer(BroadcastSerializer):
    def get_attrs(
        self,
        item_list: Sequence[Broadcast],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[Broadcast, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)
        counts = dict(
            BroadcastSeen.objects.filter(broadcast__in=item_list)
            .values("broadcast")
            .distinct()
            .annotate(user_count=Count("broadcast"))
            .values_list("broadcast", "user_count")
        )

        for item in attrs:
            attrs[item]["user_count"] = counts.get(item.id, 0)
        return attrs

    def serialize(
        self,
        obj: Broadcast,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> AdminBroadcastSerializerResponse:
        context: AdminBroadcastSerializerResponse = {
            **super().serialize(obj, attrs, user),
            "userCount": cast(int, attrs["user_count"]),
            "createdBy": obj.created_by_id.email if obj.created_by_id else None,
            "upstreamId": obj.upstream_id,
            "syncLocked": obj.sync_locked,
        }
        return context
