from __future__ import annotations

import uuid
from typing import Any

import orjson
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.entrypoints.operator import SeerAgentOperator
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.models.run import SeerAgentRun, SeerRun

EDITOR_STATUS_BY_SEER_STATUS = {
    "processing": "running",
    "completed": "completed",
    "error": "failed",
    "awaiting_user_input": "waiting_for_user",
}


def validate_vscode_access(request: Request, organization: Organization) -> int:
    user_id = request.user.id
    if user_id is None:
        raise PermissionDenied("A user account is required for editor sessions.")
    if not SeerAgentOperator.has_access(
        organization=organization, entrypoint_key=SeerEntrypointKey.VSCODE
    ):
        raise PermissionDenied("Seer is not available for this organization.")
    return user_id


def create_session_id() -> str:
    return str(uuid.uuid4())


def get_run_from_session_id(organization: Organization, user_id: int, session_id: str) -> SeerRun:
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise serializers.ValidationError("Invalid session ID.")

    run = (
        SeerRun.objects.filter(
            uuid=session_uuid,
            organization=organization,
            user_id=user_id,
            agent__source=SeerEntrypointKey.VSCODE.value,
        )
        .select_related("agent")
        .first()
    )
    if run is None:
        raise serializers.ValidationError("Chat session not found.")
    return run


def format_editor_context(context: Any) -> str | None:
    return orjson.dumps(context).decode() if context is not None else None


def _get_issue_url(run: SeerRun, agent_run: SeerAgentRun) -> str | None:
    if agent_run.group_id is None:
        return None
    group = Group.objects.filter(
        id=agent_run.group_id, project__organization_id=run.organization_id
    ).first()
    return group.get_absolute_url() if group is not None else None


def editor_response(
    run: SeerRun,
    agent_run: SeerAgentRun,
    *,
    status: str,
    messages: list[dict[str, Any]] | None = None,
    pending_input: dict[str, Any] | None = None,
    patches: list[dict[str, Any]] | None = None,
    artifacts: list[dict[str, Any]] | None = None,
    errors: list[str] | None = None,
    pull_request_urls: list[str] | None = None,
    updated_at: str | None = None,
) -> dict[str, Any]:
    response_errors = errors or []
    return {
        "id": str(run.uuid),
        "status": status,
        "messages": messages or [],
        "pendingInput": pending_input,
        "patches": patches or [],
        "artifacts": artifacts or [],
        "errors": response_errors,
        "error": response_errors[0] if response_errors else None,
        "links": {
            "issue": _get_issue_url(run, agent_run),
            "pullRequests": pull_request_urls or [],
        },
        "updatedAt": updated_at or run.last_triggered_at.isoformat(),
    }


def serialize_editor_state(
    run: SeerRun, agent_run: SeerAgentRun, state: SeerRunState
) -> dict[str, Any]:
    messages = [
        {
            "id": block.id,
            "role": block.message.role,
            "content": block.message.content or "",
            "timestamp": block.timestamp,
            "loading": block.loading,
        }
        for block in state.blocks
        if block.message.role in {"user", "assistant"}
    ]

    artifacts_by_key = state.get_artifacts()
    artifacts = [
        {"key": artifact.key, "data": artifact.data, "reason": artifact.reason}
        for artifact in artifacts_by_key.values()
    ]
    patches = [
        {
            "repository": repository,
            "path": file_patch.patch.path,
            "type": file_patch.patch.type,
            "diff": file_patch.diff,
            "added": file_patch.patch.added,
            "removed": file_patch.patch.removed,
        }
        for repository, file_patches in state.get_diffs_by_repo().items()
        for file_patch in file_patches
    ]

    errors = [
        pr_state.pr_creation_error
        for pr_state in state.repo_pr_states.values()
        if pr_state.pr_creation_error
    ]
    if state.status == "error" and not errors:
        errors.append("Seer could not complete this session.")

    pull_request_urls = [
        pr_state.pr_url for pr_state in state.repo_pr_states.values() if pr_state.pr_url
    ]
    pending_input = state.pending_user_input
    return editor_response(
        run,
        agent_run,
        status=EDITOR_STATUS_BY_SEER_STATUS[state.status],
        messages=messages,
        pending_input=(
            {
                "id": pending_input.id,
                "type": pending_input.input_type,
                "data": pending_input.data,
            }
            if pending_input is not None
            else None
        ),
        patches=patches,
        artifacts=artifacts,
        errors=errors,
        pull_request_urls=pull_request_urls,
        updated_at=state.updated_at,
    )
