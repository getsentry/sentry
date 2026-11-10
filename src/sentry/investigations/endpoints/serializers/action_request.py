from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict, cast, override
from uuid import UUID

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.auth.access import Access
from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationRerun,
)
from sentry.investigations.seer_client import CommandRejectionCode
from sentry.investigations.services.action_kinds import (
    AppliedDetails,
    get_action_kind,
    shared_cannot_apply_reason,
)
from sentry.investigations.services.action_kinds.base import ActionRequestError, CannotApplyReason
from sentry.investigations.services.orchestration import follow_up_can_be_retried
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestAnchorType,
    NotebookBlock,
)
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


class InvestigationActionRequestAnchorResponse(TypedDict):
    """`id` is Seer's ID: a block's agent key or a hypothesis ID. `blockId` is the live block
    it points to, if there is one.
    """

    type: str
    id: str
    blockId: str | None


class InvestigationActionRequestFollowUpResponse(TypedDict):
    """The re-check or re-run Sentry sent Seer for this request. `reason` is Seer's code when it
    turned it down or dropped it. `rerun` is what Seer did with a re-run, and null for a
    re-check. `retryable` says whether the user can try it again.
    """

    status: InvestigationOrchestrationCommandStatus
    reason: CommandRejectionCode | None
    rerun: InvestigationOrchestrationRerun | None
    retryable: bool


class InvestigationActionRequestSerializerResponse(TypedDict):
    """
    A step Seer suggests. `primary` marks the recommended next step after a run, and `anchor`
    puts a request under a block or hypothesis. `action` is Seer's payload, or null when it's
    only advice. `canApply` says whether this viewer can apply it now, and `cannotApplyReason`
    says why not. What's in `appliedDetails` depends on the action kind, and `appliedBy` is null
    when Sentry applied it automatically. `followUp` is what Seer did with the re-check or re-run
    Sentry sent for this request.
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
    canApply: bool
    cannotApplyReason: CannotApplyReason | None
    appliedBy: UserSerializerResponse | None
    appliedDetails: AppliedDetails | None
    dateApplied: datetime | None
    error: ActionRequestError | None
    followUp: InvestigationActionRequestFollowUpResponse | None
    dateCreated: datetime


@register(NotebookActionRequest)
class InvestigationActionRequestSerializer(
    Serializer[InvestigationActionRequestSerializerResponse]
):
    def __init__(
        self,
        access: Access | None = None,
        investigations: Sequence[Notebook] | None = None,
        **kwargs: Any,
    ) -> None:
        self.access = access
        self.investigations = investigations
        super().__init__(**kwargs)

    def _cannot_apply_reasons(
        self,
        item_list: Sequence[NotebookActionRequest],
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, CannotApplyReason | None]:
        investigation_ids = {item.notebook_id for item in item_list}
        investigations = {
            investigation.id: investigation
            for investigation in (
                self.investigations
                if self.investigations is not None
                else Notebook.objects.filter(id__in=investigation_ids).select_related(
                    "organization"
                )
            )
        }
        access = self.access
        reasons: dict[int, CannotApplyReason | None] = {}
        by_kind: dict[str, list[NotebookActionRequest]] = defaultdict(list)
        for item in item_list:
            reason = shared_cannot_apply_reason(investigations[item.notebook_id], item)
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
                kind.cannot_apply_reasons(
                    items, investigations=investigations, access=access, user=user
                )
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
            (investigation_id, key): str(block_id)
            for investigation_id, key, block_id in NotebookBlock.objects.filter(
                notebook_id__in={item.notebook_id for item in item_list},
                producer_key__in=keys,
                deleted_at__isnull=True,
            ).values_list("notebook_id", "producer_key", "id")
            if key is not None
        }

    def _follow_ups(
        self, item_list: Sequence[NotebookActionRequest]
    ) -> dict[tuple[int, UUID], InvestigationActionRequestFollowUpResponse]:
        request_ids = {
            item.followup_request_id for item in item_list if item.followup_request_id is not None
        }
        if not request_ids:
            return {}
        return {
            (investigation_id, request_id): {
                "status": InvestigationOrchestrationCommandStatus(status),
                "reason": (error or {}).get("reason"),
                "rerun": InvestigationOrchestrationRerun(rerun) if rerun is not None else None,
                "retryable": status == InvestigationOrchestrationCommandStatus.FAILED
                and follow_up_can_be_retried(command_type, error),
            }
            for investigation_id, request_id, command_type, status, error, rerun in (
                InvestigationOrchestrationCommand.objects.filter(
                    orchestration_run__investigation_id__in={
                        item.notebook_id for item in item_list
                    },
                    request_id__in=request_ids,
                ).values_list(
                    "orchestration_run__investigation_id",
                    "request_id",
                    "type",
                    "status",
                    "error",
                    "rerun",
                )
            )
        }

    @override
    def get_attrs(
        self,
        item_list: Sequence[NotebookActionRequest],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[NotebookActionRequest, dict[str, Any]]:
        reasons = self._cannot_apply_reasons(item_list, user)
        anchored_blocks = self._anchored_block_ids(item_list)
        follow_ups = self._follow_ups(item_list)
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
                    follow_ups.get((item.notebook_id, item.followup_request_id))
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
    ) -> InvestigationActionRequestSerializerResponse:
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
            "appliedDetails": cast(AppliedDetails | None, obj.applied_details),
            "dateApplied": obj.date_applied,
            "error": cast(ActionRequestError | None, obj.error),
            "followUp": attrs["follow_up"],
            "dateCreated": obj.date_added,
        }
