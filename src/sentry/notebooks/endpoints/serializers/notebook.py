from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Annotated, Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count, Q

from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import JsonValue
from sentry.auth.access import Access
from sentry.auth.principal import acting_user_id
from sentry.notebooks.endpoints.serializers.action_request import (
    NotebookActionRequestSerializer,
    NotebookActionRequestSerializerResponse,
)
from sentry.notebooks.endpoints.serializers.block import (
    NotebookBlockSerializer,
    NotebookBlockSerializerResponse,
)
from sentry.notebooks.endpoints.serializers.parameter import (
    NotebookParameterSerializerResponse,
)
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestState,
    NotebookBlock,
    NotebookFavoriteUser,
    NotebookProject,
    NotebookSourceType,
)
from sentry.notebooks.services.action_requests import STALE
from sentry.notebooks.services.producer import orchestration_summaries
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.viewer_context import ActorType


class NotebookCreatorSerializerResponse(TypedDict):
    type: Annotated[
        ActorType, ApiDescription("Whether a user or a service account created the notebook")
    ]
    id: Annotated[
        str, ApiDescription("The ID of the user or service account that created the notebook")
    ]


class NotebookTemplateSerializerResponse(TypedDict):
    key: Annotated[
        str | None, ApiDescription("The key of the template the notebook started from, if any")
    ]
    version: Annotated[int | None, ApiDescription("The version of that template, if any")]


class NotebookSourceSerializerResponseOptional(TypedDict, total=False):
    snapshot: Annotated[
        dict[str, JsonValue],
        ApiDescription(
            "What Sentry knew about the source when the notebook started. Only on source-backed notebooks"
        ),
    ]


class NotebookSourceSerializerResponse(NotebookSourceSerializerResponseOptional):
    type: Annotated[
        str, ApiDescription("The source type: manual, or the type of what the notebook is about")
    ]
    ref: Annotated[
        dict[str, JsonValue],
        ApiDescription(
            "The identifying fields of the source, such as an issue ID. Empty for a manual notebook"
        ),
    ]
    revision: Annotated[
        int | None,
        ApiDescription(
            "The notebook's revision for its source. A new revision starts once the previous one is archived. Null for a manual notebook"
        ),
    ]


class NotebookTitleGenerationSerializerResponse(TypedDict):
    status: Annotated[
        str | None,
        ApiDescription("The state of automatic title generation, or null if it hasn't run"),
    ]


class NotebookOrchestrationSerializerResponse(TypedDict):
    phase: Annotated[str, ApiDescription("The phase the agent's run is in")]
    status: Annotated[str, ApiDescription("The status of the agent's run")]
    heartbeatAt: Annotated[datetime | None, ApiDescription("When the run last reported progress")]
    notebookRevision: Annotated[
        int, ApiDescription("How many times the run has changed the notebook's report")
    ]


class NotebookSerializerResponse(TypedDict):
    """
    Investigation summary. version is the notebook concurrency token;
    orchestration.notebookRevision tracks agent report updates independently. IDs are strings
    and dates are ISO-8601 timestamps.
    """

    id: Annotated[str, ApiDescription("The notebook ID")]
    title: Annotated[str, ApiDescription("The notebook title")]
    summary: Annotated[
        str | None, ApiDescription("A one-line summary of the notebook, if one was generated")
    ]
    summaryDescription: Annotated[
        str | None, ApiDescription("A longer summary of the notebook, if one was generated")
    ]
    status: Annotated[str, ApiDescription("active or archived. Archived notebooks are read-only")]
    sourceType: Annotated[
        str, ApiDescription("What the notebook is about: manual, or a source type")
    ]
    createdBy: Annotated[
        str | None, ApiDescription("The ID of the user who created the notebook, if a user did")
    ]
    creator: Annotated[
        NotebookCreatorSerializerResponse | None,
        ApiDescription("The user or service account that created the notebook"),
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the notebook was created")]
    dateUpdated: Annotated[datetime, ApiDescription("When the notebook last changed")]
    version: Annotated[
        int,
        ApiDescription(
            "The notebook's concurrency token. Send it as notebookVersion with a change"
        ),
    ]
    blockCount: Annotated[int, ApiDescription("The number of blocks the notebook has")]
    isFavorited: Annotated[
        bool, ApiDescription("Whether the requesting user favorited the notebook")
    ]
    titleGeneration: Annotated[
        NotebookTitleGenerationSerializerResponse,
        ApiDescription("The state of automatic title generation"),
    ]
    orchestration: Annotated[
        NotebookOrchestrationSerializerResponse | None,
        ApiDescription("The agent's run for the notebook, if it has one"),
    ]


class NotebookDetailsSerializerResponse(NotebookSerializerResponse):
    """
    Full notebook with ordered active blocks, parameter definitions and saved values, project
    IDs, and source context. source.snapshot is present only for source-backed investigations.
    actionRequests has Seer's action requests that aren't superseded, plus stale ones while Seer
    re-checks them, newest report first, with that report's primary at the top.
    """

    template: Annotated[
        NotebookTemplateSerializerResponse | None,
        ApiDescription("The template the notebook started from, if any"),
    ]
    source: Annotated[
        NotebookSourceSerializerResponse, ApiDescription("What the notebook is about")
    ]
    filters: Annotated[
        dict[str, JsonValue], ApiDescription("Saved filters, stored with their original keys")
    ]
    projectIds: Annotated[list[int], ApiDescription("The IDs of the projects the notebook covers")]
    parameters: Annotated[
        list[NotebookParameterSerializerResponse],
        ApiDescription("The notebook's parameters, in order"),
    ]
    blocks: Annotated[
        list[NotebookBlockSerializerResponse], ApiDescription("The notebook's blocks, in order")
    ]
    actionRequests: Annotated[
        list[NotebookActionRequestSerializerResponse],
        ApiDescription("Steps the agent suggests, newest report first"),
    ]


@register(Notebook)
class NotebookSerializer(Serializer):
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
        user_id = acting_user_id(user)
        if user_id is not None:
            favorited_ids = set(
                NotebookFavoriteUser.objects.filter(
                    user_id=user_id, notebook__in=item_list
                ).values_list("notebook_id", flat=True)
            )

        orchestration_by_notebook = orchestration_summaries(item_list)

        return {
            notebook: {
                "block_count": block_counts.get(notebook.id, 0),
                "is_favorited": notebook.id in favorited_ids,
                "orchestration": orchestration_by_notebook.get(notebook.id),
            }
            for notebook in item_list
        }

    @override
    def serialize(
        self,
        obj: Notebook,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> NotebookSerializerResponse:
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


class NotebookDetailsSerializer(NotebookSerializer):
    """
    Serializes an investigation along with its project selection, parameters,
    and blocks. Use this for single-investigation reads; the base serializer
    omits the nested collections so list reads stay cheap. access decides which
    action requests the viewer can apply; without it none can.
    """

    def __init__(self, access: Access | None = None, **kwargs: Any) -> None:
        self.access = access
        super().__init__(**kwargs)

    def _blocks_by_notebook(
        self, item_list: Sequence[Notebook], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[NotebookBlockSerializerResponse]]:
        blocks = list(
            NotebookBlock.objects.filter(notebook__in=item_list, deleted_at__isnull=True).order_by(
                "position", "id"
            )
        )
        serialized = serialize(
            blocks,
            user,
            NotebookBlockSerializer(),
        )

        by_notebook: MutableMapping[int, list[NotebookBlockSerializerResponse]] = defaultdict(list)
        for block, block_response in zip(blocks, serialized):
            by_notebook[block.notebook_id].append(block_response)
        return by_notebook

    def _action_requests_by_notebook(
        self, item_list: Sequence[Notebook], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[NotebookActionRequestSerializerResponse]]:
        action_requests = list(
            NotebookActionRequest.objects.filter(notebook__in=item_list)
            .filter(~Q(state=NotebookActionRequestState.SUPERSEDED) | STALE)
            .order_by("-producer_revision", "-primary", "id")
        )
        serialized = serialize(
            action_requests,
            user,
            NotebookActionRequestSerializer(access=self.access, notebooks=item_list),
        )

        by_notebook: MutableMapping[int, list[NotebookActionRequestSerializerResponse]] = (
            defaultdict(list)
        )
        for action_request, response in zip(action_requests, serialized):
            by_notebook[action_request.notebook_id].append(response)
        return by_notebook

    @override
    def get_attrs(
        self,
        item_list: Sequence[Notebook],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Notebook, dict[str, Any]]:
        attrs = super().get_attrs(item_list, user, **kwargs)

        blocks_by_notebook = self._blocks_by_notebook(item_list, user)
        action_requests_by_notebook = self._action_requests_by_notebook(item_list, user)

        project_ids_by_notebook: MutableMapping[int, list[int]] = defaultdict(list)
        for notebook_id, project_id in (
            NotebookProject.objects.filter(notebook__in=item_list)
            .order_by("project_id")
            .values_list("notebook_id", "project_id")
        ):
            project_ids_by_notebook[notebook_id].append(project_id)

        for notebook in item_list:
            attrs[notebook]["blocks"] = blocks_by_notebook[notebook.id]
            attrs[notebook]["project_ids"] = project_ids_by_notebook[notebook.id]
            attrs[notebook]["action_requests"] = action_requests_by_notebook[notebook.id]

        return attrs

    @override
    def serialize(
        self,
        obj: Notebook,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> NotebookDetailsSerializerResponse:
        resolved_source = obj.source
        source: NotebookSourceSerializerResponse = {
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
