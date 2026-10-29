from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count, Q

from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.access import Access
from sentry.investigations.endpoints.serializers.action_request import (
    InvestigationActionRequestSerializer,
    InvestigationActionRequestSerializerResponse,
)
from sentry.investigations.endpoints.serializers.block import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.investigations.endpoints.serializers.parameter import (
    InvestigationParameterSerializerResponse,
)
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.services.action_requests import STALE
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestState,
    NotebookBlock,
    NotebookFavoriteUser,
    NotebookProject,
    NotebookSourceType,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.viewer_context import ActorType


class InvestigationCreatorSerializerResponse(TypedDict):
    type: ActorType
    id: str


class InvestigationTemplateSerializerResponse(TypedDict):
    key: str | None
    version: int | None


class InvestigationSourceSerializerResponseOptional(TypedDict, total=False):
    snapshot: dict[str, Any]


class InvestigationSourceSerializerResponse(InvestigationSourceSerializerResponseOptional):
    type: str
    ref: dict[str, Any]
    revision: int | None


class InvestigationTitleGenerationSerializerResponse(TypedDict):
    status: str | None


class InvestigationOrchestrationSerializerResponse(TypedDict):
    phase: str
    status: str
    heartbeatAt: datetime | None
    notebookRevision: int


def orchestration_summaries_by_investigation(
    investigations: Sequence[Notebook],
) -> dict[int, InvestigationOrchestrationSerializerResponse]:
    return {
        investigation_id: {
            "phase": phase,
            "status": status,
            "heartbeatAt": heartbeat_at,
            "notebookRevision": notebook_revision,
        }
        for investigation_id, phase, status, heartbeat_at, notebook_revision in (
            InvestigationOrchestrationRun.objects.filter(
                investigation_id__in=[investigation.id for investigation in investigations]
            ).values_list(
                "investigation_id",
                "phase",
                "status",
                "heartbeat_at",
                "notebook_revision",
            )
        )
    }


class InvestigationSerializerResponse(TypedDict):
    """
    Investigation summary. version is the notebook concurrency token;
    orchestration.notebookRevision tracks agent report updates independently. IDs are strings
    and dates are ISO-8601 timestamps.
    """

    id: str
    title: str
    summary: str | None
    summaryDescription: str | None
    status: str
    sourceType: str
    createdBy: str | None
    creator: InvestigationCreatorSerializerResponse | None
    dateCreated: datetime
    dateUpdated: datetime
    version: int
    blockCount: int
    isFavorited: bool
    titleGeneration: InvestigationTitleGenerationSerializerResponse
    orchestration: InvestigationOrchestrationSerializerResponse | None


class InvestigationDetailsSerializerResponse(InvestigationSerializerResponse):
    """
    Full notebook with ordered active blocks, parameter definitions and saved values, project
    IDs, and source context. source.snapshot is present only for source-backed investigations.
    actionRequests has Seer's action requests that aren't superseded, plus stale ones while Seer
    re-checks them, newest report first, with that report's primary at the top.
    """

    template: InvestigationTemplateSerializerResponse | None
    source: InvestigationSourceSerializerResponse
    filters: dict[str, Any]
    projectIds: list[int]
    parameters: list[InvestigationParameterSerializerResponse]
    blocks: list[InvestigationBlockSerializerResponse]
    actionRequests: list[InvestigationActionRequestSerializerResponse]


@register(Notebook)
class InvestigationSerializer(Serializer):
    @override
    def get_attrs(
        self,
        item_list: Sequence[Notebook],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Notebook, dict[str, Any]]:
        block_counts = dict(
            Notebook.objects.filter(id__in=[i.id for i in item_list])
            .annotate(active_block_count=Count("blocks", filter=Q(blocks__deleted_at__isnull=True)))
            .values_list("id", "active_block_count")
        )

        favorited_ids: set[int] = set()
        user_id = getattr(user, "id", None)
        if user_id is not None:
            favorited_ids = set(
                NotebookFavoriteUser.objects.filter(
                    user_id=user_id, notebook__in=item_list
                ).values_list("notebook_id", flat=True)
            )

        orchestration_by_investigation = orchestration_summaries_by_investigation(item_list)

        return {
            investigation: {
                "block_count": block_counts.get(investigation.id, 0),
                "is_favorited": investigation.id in favorited_ids,
                "orchestration": orchestration_by_investigation.get(investigation.id),
            }
            for investigation in item_list
        }

    @override
    def serialize(
        self,
        obj: Notebook,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationSerializerResponse:
        source = obj.source
        creator = obj.creator_actor
        return {
            "id": str(obj.id),
            "title": obj.title,
            "summary": obj.summary,
            "summaryDescription": obj.summary_description,
            "status": obj.status,
            "sourceType": source.get("type", NotebookSourceType.MANUAL),
            "createdBy": (str(obj.created_by_id) if obj.created_by_id is not None else None),
            "creator": (
                {
                    "type": creator.type,
                    "id": str(creator.id),
                }
                if creator is not None
                else None
            ),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "version": obj.version,
            "blockCount": attrs["block_count"],
            "isFavorited": attrs["is_favorited"],
            "titleGeneration": {"status": obj.title_generation_status},
            "orchestration": attrs["orchestration"],
        }


class InvestigationDetailsSerializer(InvestigationSerializer):
    """
    Serializes an investigation along with its project selection, parameters,
    and blocks. Use this for single-investigation reads; the base serializer
    omits the nested collections so list reads stay cheap. access decides which
    action requests the viewer can apply; without it none can.
    """

    def __init__(self, access: Access | None = None, **kwargs: Any) -> None:
        self.access = access
        super().__init__(**kwargs)

    def _blocks_by_investigation(
        self, item_list: Sequence[Notebook], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[InvestigationBlockSerializerResponse]]:
        blocks = list(
            NotebookBlock.objects.filter(notebook__in=item_list, deleted_at__isnull=True).order_by(
                "position", "id"
            )
        )
        serialized = serialize(
            blocks,
            user,
            InvestigationBlockSerializer(),
        )

        by_investigation: MutableMapping[int, list[InvestigationBlockSerializerResponse]] = (
            defaultdict(list)
        )
        for block, block_response in zip(blocks, serialized):
            by_investigation[block.notebook_id].append(block_response)
        return by_investigation

    def _action_requests_by_investigation(
        self, item_list: Sequence[Notebook], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[InvestigationActionRequestSerializerResponse]]:
        action_requests = list(
            NotebookActionRequest.objects.filter(notebook__in=item_list)
            .filter(~Q(state=NotebookActionRequestState.SUPERSEDED) | STALE)
            .order_by("-producer_revision", "-primary", "id")
        )
        serialized = serialize(
            action_requests,
            user,
            InvestigationActionRequestSerializer(access=self.access, investigations=item_list),
        )

        by_investigation: MutableMapping[
            int, list[InvestigationActionRequestSerializerResponse]
        ] = defaultdict(list)
        for action_request, response in zip(action_requests, serialized):
            by_investigation[action_request.notebook_id].append(response)
        return by_investigation

    @override
    def get_attrs(
        self,
        item_list: Sequence[Notebook],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Notebook, dict[str, Any]]:
        attrs = super().get_attrs(item_list, user, **kwargs)

        blocks_by_investigation = self._blocks_by_investigation(item_list, user)
        action_requests_by_investigation = self._action_requests_by_investigation(item_list, user)

        project_ids_by_investigation: MutableMapping[int, list[int]] = defaultdict(list)
        for investigation_id, project_id in (
            NotebookProject.objects.filter(notebook__in=item_list)
            .order_by("project_id")
            .values_list("notebook_id", "project_id")
        ):
            project_ids_by_investigation[investigation_id].append(project_id)

        for investigation in item_list:
            attrs[investigation]["blocks"] = blocks_by_investigation[investigation.id]
            attrs[investigation]["project_ids"] = project_ids_by_investigation[investigation.id]
            attrs[investigation]["action_requests"] = action_requests_by_investigation[
                investigation.id
            ]

        return attrs

    @override
    def serialize(
        self,
        obj: Notebook,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationDetailsSerializerResponse:
        resolved_source = obj.source
        source: InvestigationSourceSerializerResponse = {
            "type": resolved_source.get("type", NotebookSourceType.MANUAL),
            "ref": resolved_source.get("ref", {}),
            "revision": obj.source_revision,
        }
        snapshot = resolved_source.get("snapshot")
        if isinstance(snapshot, dict):
            source["snapshot"] = snapshot
        return {
            **super().serialize(obj, attrs, user, **kwargs),
            "template": None,
            "source": source,
            "filters": obj.filters,
            "projectIds": attrs["project_ids"],
            "parameters": [],
            "blocks": attrs["blocks"],
            "actionRequests": attrs["action_requests"],
            "titleGeneration": {"status": obj.title_generation_status},
        }
