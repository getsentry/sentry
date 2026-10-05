from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.investigations.models import InvestigationComment
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


class InvestigationCommentSerializerResponse(TypedDict):
    id: str
    blockId: str | None
    author: UserSerializerResponse | None
    body: str
    dateCreated: datetime
    dateUpdated: datetime


@register(InvestigationComment)
class InvestigationCommentSerializer(Serializer[InvestigationCommentSerializerResponse]):
    @override
    def get_attrs(
        self,
        item_list: Sequence[InvestigationComment],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[InvestigationComment, dict[str, Any]]:
        author_ids = list({c.author_id for c in item_list if c.author_id is not None})
        authors = (
            {
                serialized["id"]: serialized
                for serialized in user_service.serialize_many(
                    filter={"user_ids": author_ids}, as_user=serialize_generic_user(user)
                )
            }
            if author_ids
            else {}
        )
        return {comment: {"author": authors.get(str(comment.author_id))} for comment in item_list}

    @override
    def serialize(
        self,
        obj: InvestigationComment,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationCommentSerializerResponse:
        return {
            "id": str(obj.id),
            "blockId": str(obj.block_id) if obj.block_id is not None else None,
            "author": attrs["author"],
            "body": obj.body,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
