from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Annotated, Any, TypedDict, cast, override

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription, ApiSchema
from sentry.apidocs.formats import JsonValue
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.auth.access import Access
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestAnchorType,
    NotebookBlock,
)
from sentry.notebooks.services.action_kinds import (
    applied_details_hint,
    get_action_kind,
    shared_cannot_apply_reason,
)
from sentry.notebooks.services.action_kinds.base import ActionRequestError, CannotApplyReason
from sentry.notebooks.services.producer import (
    follow_up_reason_hint,
    follow_up_rerun_hint,
    follow_up_status_hint,
    follow_ups,
)
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


def _schema_from(hint: Callable[[], object]) -> ApiSchema:
    return ApiSchema(lambda: resolve_type_hint(hint()))


class NotebookActionRequestAnchorResponse(TypedDict):
    """`id` is Seer's ID: a block's agent key or a hypothesis ID. `blockId` is the live block
    it points to, if there is one.
    """

    type: Annotated[str, ApiDescription("block or hypothesis")]
    id: Annotated[str, ApiDescription("The agent's ID for the block or hypothesis")]
    blockId: Annotated[
        str | None, ApiDescription("The ID of the block the request is under, if it still exists")
    ]


class NotebookActionRequestFollowUpResponse(TypedDict):
    """The re-check or re-run Sentry sent Seer for this request. `reason` is Seer's code when it
    turned it down or dropped it. `rerun` is what Seer did with a re-run, and null for a
    re-check. `retryable` says whether the user can try it again.
    """

    status: Annotated[
        str, _schema_from(follow_up_status_hint), ApiDescription("Where the follow-up is")
    ]
    reason: Annotated[
        str | None,
        _schema_from(follow_up_reason_hint),
        ApiDescription("Why the agent turned down or dropped the follow-up, if it did"),
    ]
    rerun: Annotated[
        str | None,
        _schema_from(follow_up_rerun_hint),
        ApiDescription("What the agent did with a re-run. Null for a re-check"),
    ]
    retryable: Annotated[bool, ApiDescription("Whether the requesting user can send it again")]


class NotebookActionRequestSerializerResponse(TypedDict):
    """
    A step Seer suggests. `primary` marks the recommended next step after a run, and `anchor`
    puts a request under a block or hypothesis. `action` is Seer's payload, or null when it's
    only advice. `canApply` says whether this viewer can apply it now, and `cannotApplyReason`
    says why not. What's in `appliedDetails` depends on the action kind, and `appliedBy` is null
    when Sentry applied it automatically. `followUp` is what Seer did with the re-check or re-run
    Sentry sent for this request.
    """

    id: Annotated[str, ApiDescription("The action request ID")]
    key: Annotated[str, ApiDescription("The agent's key for the request")]
    reportRevision: Annotated[int, ApiDescription("The report revision that suggested it")]
    primary: Annotated[bool, ApiDescription("Whether it's the recommended next step")]
    anchor: Annotated[
        NotebookActionRequestAnchorResponse | None,
        ApiDescription("The block or hypothesis the request is under, if any"),
    ]
    title: Annotated[str, ApiDescription("A short title for the step")]
    rationale: Annotated[str, ApiDescription("Why the agent suggests it")]
    impact: Annotated[str | None, ApiDescription("What the step would change, if the agent said")]
    state: Annotated[str, ApiDescription("suggested, applied, failed, superseded, or withdrawn")]
    reason: Annotated[
        str | None, ApiDescription("Why the request is in its state, if there's a reason")
    ]
    action: Annotated[
        dict[str, JsonValue] | None,
        ApiDescription("The agent's action payload, or null when the request is only advice"),
    ]
    canApply: Annotated[bool, ApiDescription("Whether the requesting user can apply it now")]
    cannotApplyReason: Annotated[
        CannotApplyReason | None,
        ApiDescription("Why the requesting user can't apply it, if they can't"),
    ]
    appliedBy: Annotated[
        UserSerializerResponse | None,
        ApiDescription("The user who applied it. Null when Sentry applied it"),
    ]
    appliedDetails: Annotated[
        Mapping[str, object] | None,
        _schema_from(applied_details_hint),
        ApiDescription("What applying it changed. The fields depend on the action"),
    ]
    dateApplied: Annotated[datetime | None, ApiDescription("When it was applied")]
    error: Annotated[
        ActionRequestError | None, ApiDescription("What went wrong, if applying it failed")
    ]
    followUp: Annotated[
        NotebookActionRequestFollowUpResponse | None,
        ApiDescription("The re-check or re-run Sentry sent the agent, if any"),
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the agent suggested it")]


@register(NotebookActionRequest)
class NotebookActionRequestSerializer(Serializer[NotebookActionRequestSerializerResponse]):
    def __init__(
        self,
        access: Access | None = None,
        notebooks: Sequence[Notebook] | None = None,
        **kwargs: Any,
    ) -> None:
        self.access = access
        self.notebooks = notebooks
        super().__init__(**kwargs)

    def _notebooks(self, item_list: Sequence[NotebookActionRequest]) -> dict[int, Notebook]:
        notebook_ids = {item.notebook_id for item in item_list}
        return {
            notebook.id: notebook
            for notebook in (
                self.notebooks
                if self.notebooks is not None
                else Notebook.objects.filter(id__in=notebook_ids).select_related("organization")
            )
        }

    def _cannot_apply_reasons(
        self,
        item_list: Sequence[NotebookActionRequest],
        notebooks: dict[int, Notebook],
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, CannotApplyReason | None]:
        access = self.access
        reasons: dict[int, CannotApplyReason | None] = {}
        by_kind: dict[str, list[NotebookActionRequest]] = defaultdict(list)
        for item in item_list:
            notebook = notebooks[item.notebook_id]
            reason = shared_cannot_apply_reason(notebook, item)
            if reason is not None:
                reasons[item.id] = reason
            elif access is None:
                reasons[item.id] = CannotApplyReason.NO_ACCESS
            else:
                by_kind[item.action_kind or ""].append(item)
        if access is None:
            return reasons
        for kind_name, items in by_kind.items():
            kind = get_action_kind(kind_name)
            assert kind is not None
            reasons.update(
                kind.cannot_apply_reasons(items, notebooks=notebooks, access=access, user=user)
            )
        return reasons

    def _anchored_block_ids(
        self, item_list: Sequence[NotebookActionRequest]
    ) -> dict[tuple[int, str], str]:
        keys = {
            item.anchor_id
            for item in item_list
            if item.anchor_type == NotebookActionRequestAnchorType.BLOCK and item.anchor_id
        }
        if not keys:
            return {}
        return {
            (notebook_id, key): str(block_id)
            for notebook_id, key, block_id in NotebookBlock.objects.filter(
                notebook_id__in={item.notebook_id for item in item_list},
                producer_key__in=keys,
                deleted_at__isnull=True,
            ).values_list("notebook_id", "producer_key", "id")
            if key is not None
        }

    @override
    def get_attrs(
        self,
        item_list: Sequence[NotebookActionRequest],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[NotebookActionRequest, dict[str, Any]]:
        notebooks = self._notebooks(item_list)
        reasons = self._cannot_apply_reasons(item_list, notebooks, user)
        anchored_blocks = self._anchored_block_ids(item_list)
        item_follow_ups = follow_ups(item_list, notebooks)
        applier_ids = {item.applied_by_id for item in item_list if item.applied_by_id is not None}
        appliers = (
            {
                applier["id"]: applier
                for applier in user_service.serialize_many(
                    filter={"user_ids": list(applier_ids)}, as_user=serialize_generic_user(user)
                )
            }
            if applier_ids
            else {}
        )
        return {
            item: {
                "cannot_apply_reason": reasons.get(item.id, CannotApplyReason.UNSUPPORTED_ACTION),
                "block_id": (
                    anchored_blocks.get((item.notebook_id, item.anchor_id or ""))
                    if item.anchor_type == NotebookActionRequestAnchorType.BLOCK
                    else None
                ),
                "applied_by": appliers.get(str(item.applied_by_id)),
                "follow_up": (
                    item_follow_ups.get((item.notebook_id, item.followup_request_id))
                    if item.followup_request_id is not None
                    else None
                ),
            }
            for item in item_list
        }

    @override
    def serialize(
        self,
        obj: NotebookActionRequest,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> NotebookActionRequestSerializerResponse:
        return {
            "id": str(obj.id),
            "key": obj.key,
            "reportRevision": obj.producer_revision,
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
            "canApply": attrs["cannot_apply_reason"] is None,
            "cannotApplyReason": attrs["cannot_apply_reason"],
            "appliedBy": attrs["applied_by"],
            # Only the shared apply path writes these columns.
            "appliedDetails": obj.applied_details,
            "dateApplied": obj.date_applied,
            "error": cast(ActionRequestError | None, obj.error),
            "followUp": attrs["follow_up"],
            "dateCreated": obj.date_added,
        }
