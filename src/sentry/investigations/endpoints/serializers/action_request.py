from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.investigations.models import (
    InvestigationActionRequest,
    InvestigationActionRequestAnchorType,
    InvestigationBlock,
)
from sentry.users.api.serializers.user import SerializedAvatarFields
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class InvestigationActionRequestAnchorResponse(TypedDict):
    """`id` is Seer's ID: a block's agent key or a hypothesis ID. `blockId` is the live block
    it points to, if there is one.
    """

    type: str
    id: str
    blockId: str | None


class InvestigationActionRequestActorResponse(TypedDict):
    id: str
    name: str
    username: str
    email: str
    avatarUrl: str
    avatar: SerializedAvatarFields


class InvestigationActionRequestSerializerResponse(TypedDict):
    """
    A step Seer suggests. `primary` marks the recommended next step after a run, and `anchor`
    puts a request under a block or hypothesis. `action` is null when it's only advice. What's
    in `appliedDetails` depends on the action kind, and `appliedBy` is null when Sentry applied
    it automatically.
    """

    id: str
    key: str
    reportRevision: int
    primary: bool
    anchor: InvestigationActionRequestAnchorResponse | None
    title: str
    rationale: str
    impact: str | None
    state: str
    reason: str | None
    action: dict[str, Any] | None
    appliedBy: InvestigationActionRequestActorResponse | None
    appliedDetails: dict[str, Any] | None
    dateApplied: datetime | None
    error: dict[str, Any] | None
    dateCreated: datetime


@register(InvestigationActionRequest)
class InvestigationActionRequestSerializer(
    Serializer[InvestigationActionRequestSerializerResponse]
):
    def _anchored_block_ids(
        self, item_list: Sequence[InvestigationActionRequest]
    ) -> dict[tuple[int, str], str]:
        keys = {
            item.anchor_id
            for item in item_list
            if item.anchor_type == InvestigationActionRequestAnchorType.BLOCK and item.anchor_id
        }
        if not keys:
            return {}
        return {
            (investigation_id, key): str(block_id)
            for investigation_id, key, block_id in InvestigationBlock.objects.filter(
                investigation_id__in={item.investigation_id for item in item_list},
                stable_agent_key__in=keys,
                deleted_at__isnull=True,
            ).values_list("investigation_id", "stable_agent_key", "id")
            if key is not None
        }

    @override
    def get_attrs(
        self,
        item_list: Sequence[InvestigationActionRequest],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[InvestigationActionRequest, dict[str, Any]]:
        anchored_blocks = self._anchored_block_ids(item_list)
        return {
            item: {
                "block_id": (
                    anchored_blocks.get((item.investigation_id, item.anchor_id or ""))
                    if item.anchor_type == InvestigationActionRequestAnchorType.BLOCK
                    else None
                )
            }
            for item in item_list
        }

    @override
    def serialize(
        self,
        obj: InvestigationActionRequest,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationActionRequestSerializerResponse:
        return {
            "id": str(obj.id),
            "key": obj.key,
            "reportRevision": obj.report_revision,
            "primary": obj.primary,
            "anchor": (
                {"type": obj.anchor_type, "id": obj.anchor_id, "blockId": attrs["block_id"]}
                if obj.anchor_type is not None and obj.anchor_id is not None
                else None
            ),
            "title": obj.title,
            "rationale": obj.rationale,
            "impact": obj.impact,
            "state": obj.state,
            "reason": obj.reason,
            "action": obj.action_payload,
            "appliedBy": (
                (obj.applied_details or {}).get("actor") if obj.applied_by_id is not None else None
            ),
            "appliedDetails": (
                {key: value for key, value in obj.applied_details.items() if key != "actor"}
                if obj.applied_details is not None
                else None
            ),
            "dateApplied": obj.date_applied,
            "error": obj.error,
            "dateCreated": obj.date_added,
        }
