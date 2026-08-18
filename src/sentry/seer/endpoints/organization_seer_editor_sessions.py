from __future__ import annotations

import uuid
from typing import Any

import orjson
import sentry_sdk
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import agent_connection_pool
from sentry.seer.entrypoints.operator import SeerAgentOperator
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.entrypoints.vscode.entrypoint import VSCodeAgentEntrypoint
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.types.ratelimit import RateLimit, RateLimitCategory

VSCODE_SOURCE = SeerEntrypointKey.VSCODE.value
EDITOR_STATUS_BY_SEER_STATUS = {
    "processing": "running",
    "completed": "completed",
    "error": "failed",
    "awaiting_user_input": "waiting_for_user",
}


class EditorSessionPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"], "POST": ["org:read"]}


class EditorSessionSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, max_length=100_000)
    issueId = serializers.IntegerField(min_value=1)
    editorContext = serializers.JSONField(required=False, allow_null=True, default=None)


class EditorMessageSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, max_length=100_000)
    editorContext = serializers.JSONField(required=False, allow_null=True, default=None)


class EditorActionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["user_input_response"])
    inputId = serializers.CharField(allow_blank=False, max_length=256)
    responseData = serializers.JSONField()


def _require_editor_access(request: Request, organization: Organization) -> int:
    user_id = request.user.id
    if user_id is None:
        raise PermissionDenied("A user account is required for editor sessions.")
    if not SeerAgentOperator.has_access(
        organization=organization,
        entrypoint_key=SeerEntrypointKey.VSCODE,
        actor=request.user,
    ):
        raise PermissionDenied("Seer is not available for this organization.")
    return user_id


def _get_editor_run(
    *, organization: Organization, user_id: int, session_id: str
) -> tuple[SeerRun, SeerAgentRun] | Response:
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        return Response({"detail": "Invalid session ID."}, status=status.HTTP_400_BAD_REQUEST)

    run = (
        SeerRun.objects.filter(
            uuid=session_uuid,
            organization=organization,
            user_id=user_id,
            agent__source=VSCODE_SOURCE,
        )
        .select_related("agent")
        .first()
    )
    if run is None:
        return Response({"detail": "Editor session not found."}, status=status.HTTP_404_NOT_FOUND)
    return run, run.agent


def _context_to_string(context: Any) -> str | None:
    return orjson.dumps(context).decode() if context is not None else None


def _get_issue_url(run: SeerRun, agent_run: SeerAgentRun) -> str | None:
    if agent_run.group_id is None:
        return None
    group = Group.objects.filter(
        id=agent_run.group_id, project__organization_id=run.organization_id
    ).first()
    return group.get_absolute_url() if group is not None else None


def _editor_response(
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


def _serialize_editor_state(
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
    return _editor_response(
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


class EditorSessionEndpointBase(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (EditorSessionPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=25, window=60),
                RateLimitCategory.USER: RateLimit(limit=25, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60 * 60),
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=100, window=60),
                RateLimitCategory.USER: RateLimit(limit=100, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
            },
        }
    )

    def validate_run_project_access(
        self,
        *,
        request: Request,
        organization: Organization,
        agent_run: SeerAgentRun,
    ) -> None:
        if agent_run.project_id is not None:
            self.get_projects(
                request=request,
                organization=organization,
                project_ids={agent_run.project_id},
            )


@cell_silo_endpoint
class OrganizationSeerEditorSessionsEndpoint(EditorSessionEndpointBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        user_id = _require_editor_access(request, organization)
        serializer = EditorSessionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        group = None
        issue_id = serializer.validated_data["issueId"]
        group = Group.objects.filter(id=issue_id, project__organization_id=organization.id).first()
        if group is None:
            return Response({"detail": "Issue not found."}, status=status.HTTP_404_NOT_FOUND)
        self.get_projects(
            request=request, organization=organization, project_ids={group.project_id}
        )

        category_value = str(uuid.uuid4())
        entrypoint = VSCodeAgentEntrypoint(organization_id=organization.id, user_id=user_id)
        run_id = SeerAgentOperator(entrypoint).trigger_agent(
            organization=organization,
            user=request.user,
            prompt=serializer.validated_data["message"],
            on_page_context=_context_to_string(serializer.validated_data.get("editorContext")),
            category_key=VSCODE_SOURCE,
            category_value=category_value,
            group=group,
        )
        if run_id is None:
            return Response({"detail": "Failed to start editor session."}, status=500)

        run = (
            SeerRun.objects.filter(
                organization=organization,
                user_id=user_id,
                seer_run_state_id=run_id,
                agent__source=VSCODE_SOURCE,
            )
            .select_related("agent")
            .first()
        )
        if run is None:
            return Response({"detail": "Failed to create editor session."}, status=500)
        return Response(
            _editor_response(run, run.agent, status="running"),
            status=status.HTTP_201_CREATED,
        )


@cell_silo_endpoint
class OrganizationSeerEditorSessionDetailsEndpoint(EditorSessionEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization, session_id: str) -> Response:
        user_id = _require_editor_access(request, organization)
        resolved = _get_editor_run(
            organization=organization, user_id=user_id, session_id=session_id
        )
        if isinstance(resolved, Response):
            return resolved
        run, agent_run = resolved
        self.validate_run_project_access(
            request=request, organization=organization, agent_run=agent_run
        )
        if run.mirror_status == SeerRunMirrorStatus.FAILED:
            return Response(
                _editor_response(
                    run,
                    agent_run,
                    status="failed",
                    errors=["Seer could not start this session."],
                )
            )
        if run.seer_run_state_id is None:
            return Response(_editor_response(run, agent_run, status="pending"))

        try:
            state = SeerAgentClient(organization, request.user).get_run(run.seer_run_state_id)
        except SeerApiError as error:
            sentry_sdk.capture_exception(error)
            return Response({"detail": "Failed to fetch editor session."}, status=502)
        return Response(_serialize_editor_state(run, agent_run, state))


@cell_silo_endpoint
class OrganizationSeerEditorSessionMessagesEndpoint(EditorSessionEndpointBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, session_id: str) -> Response:
        user_id = _require_editor_access(request, organization)
        resolved = _get_editor_run(
            organization=organization, user_id=user_id, session_id=session_id
        )
        if isinstance(resolved, Response):
            return resolved
        run, agent_run = resolved
        self.validate_run_project_access(
            request=request, organization=organization, agent_run=agent_run
        )
        if run.seer_run_state_id is None:
            return Response(
                {"detail": "This session is still being created; retry shortly."}, status=409
            )

        serializer = EditorMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        category_value = agent_run.extras.get("category_value")
        if not isinstance(category_value, str):
            return Response({"detail": "Editor session metadata is invalid."}, status=500)

        entrypoint = VSCodeAgentEntrypoint(organization_id=organization.id, user_id=user_id)
        continued_run_id = SeerAgentOperator(entrypoint).trigger_agent(
            organization=organization,
            user=request.user,
            prompt=serializer.validated_data["message"],
            on_page_context=_context_to_string(serializer.validated_data.get("editorContext")),
            category_key=VSCODE_SOURCE,
            category_value=category_value,
            group=None,
            run_id=run.seer_run_state_id,
        )
        if continued_run_id != run.seer_run_state_id:
            return Response({"detail": "Failed to continue editor session."}, status=500)
        return Response(_editor_response(run, agent_run, status="running"), status=202)


@cell_silo_endpoint
class OrganizationSeerEditorSessionActionsEndpoint(EditorSessionEndpointBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, session_id: str) -> Response:
        user_id = _require_editor_access(request, organization)
        resolved = _get_editor_run(
            organization=organization, user_id=user_id, session_id=session_id
        )
        if isinstance(resolved, Response):
            return resolved
        run, agent_run = resolved
        self.validate_run_project_access(
            request=request, organization=organization, agent_run=agent_run
        )
        if run.seer_run_state_id is None:
            return Response(
                {"detail": "This session is still being created; retry shortly."}, status=409
            )

        serializer = EditorActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        action = serializer.validated_data
        payload = {
            "type": "user_input_response",
            "input_id": action["inputId"],
            "response_data": action["responseData"],
        }

        response = make_signed_seer_api_request(
            agent_connection_pool,
            "/v1/automation/explorer/update",
            orjson.dumps(
                {
                    "run_id": run.seer_run_state_id,
                    "organization_id": organization.id,
                    "payload": payload,
                }
            ),
        )
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        return Response(_editor_response(run, agent_run, status="running"), status=202)
