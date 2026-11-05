from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser
from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer
from sentry.notebooks.models import NotebookBlock, NotebookBlockExecutionStatus, NotebookBlockKind
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class InvestigationBlockExecutionSerializerResponse(TypedDict):
    id: str
    status: str
    executor: str
    schemaVersion: int
    startedAt: datetime | None
    completedAt: datetime | None
    error: Any


class InvestigationBlockSerializerResponse(TypedDict):
    """
    Notebook block. version is the block concurrency token; dependencies are block IDs and
    parameterKeys reference notebook parameters. output is the latest successful result and may
    remain available during a rerun; currentExecution describes the latest attempt. Poll
    execution details for transcript and pending input.
    """

    id: str
    position: int
    kind: str
    title: str
    content: str
    generationPrompt: str
    generatedContent: str
    output: Any
    outputStatus: str
    currentExecution: InvestigationBlockExecutionSerializerResponse | None
    config: dict[str, Any]
    display: dict[str, Any]
    dependencies: list[str]
    parameterKeys: list[str]
    version: int
    staleAt: datetime | None
    createdBy: str | None
    lastEditedBy: str | None


class InvestigationBlockSerializer(Serializer[InvestigationBlockSerializerResponse]):
    @override
    def get_attrs(
        self,
        item_list: Sequence[NotebookBlock],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[NotebookBlock, dict[str, Any]]:
        prefetch_related_objects(
            item_list,
            "current_execution",
            "result_execution",
        )

        return {block: {} for block in item_list}

    @override
    def serialize(
        self,
        obj: NotebookBlock,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationBlockSerializerResponse:
        execution = obj.current_execution
        if execution is None:
            output = None
            output_status = "notRun"
        else:
            visible_execution = (
                obj.result_execution if obj.kind == NotebookBlockKind.QUERY else execution
            )
            output = visible_execution.result if visible_execution is not None else None
            output_status = (
                "available"
                if execution.status == NotebookBlockExecutionStatus.COMPLETED
                else execution.status
            )

        return {
            "id": str(obj.id),
            "position": obj.position,
            "kind": obj.kind,
            "title": obj.title,
            "content": obj.content,
            "generationPrompt": obj.prompt,
            "generatedContent": obj.generated_content,
            "output": output,
            "outputStatus": output_status,
            "currentExecution": (
                {
                    "id": str(execution.id),
                    "status": execution.status,
                    "executor": execution.executor,
                    "schemaVersion": execution.result_schema_version,
                    "startedAt": execution.started_at,
                    "completedAt": execution.completed_at,
                    "error": execution.error,
                }
                if execution is not None
                else None
            ),
            "config": obj.config,
            "display": obj.display,
            "dependencies": [],
            "parameterKeys": [],
            "version": obj.version,
            "staleAt": obj.stale_at,
            "createdBy": str(obj.created_by_id) if obj.created_by_id is not None else None,
            "lastEditedBy": (
                str(obj.last_edited_by_id) if obj.last_edited_by_id is not None else None
            ),
        }
