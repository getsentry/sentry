from __future__ import annotations

import logging
import uuid
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.autofix_examples import AutofixExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log import (
    publish_action,
    resolve_action_actor,
    resolve_action_source,
)
from sentry.issues.action_log.types import TriggerAutofixAction
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.autofix_agent import (
    UNKNOWN_RUN_ID_FOR_GROUP,
    AutofixStep,
    NoSeerQuotaException,
    get_autofix_agent_state,
    get_autofix_run_state,
    get_iterations,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.coding_agent import (
    poll_claude_code_agents,
    poll_github_copilot_agents,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.github_perms import (
    get_out_of_date_github_permissions,
)
from sentry.seer.autofix.pr_iteration.feedback_queue import (
    enqueue_autofix_feedback,
    peek_queued_autofix_feedback,
)
from sentry.seer.autofix.pr_iteration.types import Feedback
from sentry.seer.autofix.types import (
    AutofixHandoffResponse,
    AutofixPostResponse,
    AutofixStateResponse,
    GithubAppPermissionsWarning,
)
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    CodingAgentProviderType,
)
from sentry.seer.endpoints.utils import get_seer_run, resolve_seer_run
from sentry.seer.models import SeerPermissionError
from sentry.tasks.seer.pr_iteration import consume_queued_autofix_feedback
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils.http import is_mcp_request

logger = logging.getLogger(__name__)

SEER_PERMISSION_DENIED = "You are not authorized to perform this action"


def _is_unknown_run_id_error(error: SeerPermissionError) -> bool:
    return getattr(error, "message", None) == UNKNOWN_RUN_ID_FOR_GROUP


def _parse_autofix_referrer(raw: str | None, request: Request) -> AutofixReferrer:
    if raw is None:
        # Fall back to the request origin: requests from the Sentry MCP server are
        # attributed to MCP, everything else to the generic endpoint referrer.
        if is_mcp_request(request):
            return AutofixReferrer.MCP
        return AutofixReferrer.GROUP_AUTOFIX_ENDPOINT
    try:
        return AutofixReferrer(raw)
    except ValueError:
        logger.warning("group_ai_autofix.unknown_referrer", extra={"referrer": raw})
        return AutofixReferrer.UNKNOWN


class ExplorerAutofixRequestSerializer(CamelSnakeSerializer):
    """Serializer for the agent-based autofix requests."""

    step = serializers.ChoiceField(
        required=False,
        choices=[
            "root_cause",
            "solution",
            "code_changes",
            "pr_iteration",
            "open_pr",
            "coding_agent_handoff",
        ],
        default="root_cause",
        help_text="Which autofix step to run.",
    )
    stopping_point = serializers.ChoiceField(
        required=False,
        choices=["root_cause", "solution", "code_changes", "open_pr"],
        help_text="Where the issue fix process should stop. If not provided, will run to root cause.",
    )
    run_id = serializers.IntegerField(
        required=False,
        help_text=(
            "**Deprecated** in favor of sentry_run_id; retained for backward "
            "compatibility. The existing run's numeric Seer id to continue. If "
            "neither run_id nor sentry_run_id is provided, starts a new run."
        ),
    )
    sentry_run_id = serializers.UUIDField(
        required=False,
        help_text=(
            "Existing run's UUID to continue. Preferred over run_id, and takes "
            "precedence when both are given."
        ),
    )
    integration_id = serializers.IntegerField(
        required=False,
        help_text="Coding agent integration ID. Required for coding_agent_handoff step (unless provider is specified).",
    )
    provider = serializers.CharField(
        required=False,
        help_text="Coding agent provider (e.g., 'github_copilot'). Alternative to integration_id for user-authenticated providers.",
    )
    user_context = serializers.CharField(
        required=False,
        max_length=1000,
        help_text="Optional user context to append to the step prompt.",
        allow_blank=True,
    )
    repo_name = serializers.CharField(
        required=False,
        help_text="Optional repository name for which to create the pull request. Do not pass a repository name to create pull requests in all relevant repositories.",
    )
    insert_index = serializers.IntegerField(
        required=False,
        help_text="Block index to insert at. When provided, truncates blocks after this point for retry-from-step.",
    )
    referrer = serializers.CharField(
        required=False,
        help_text="Referrer identifying where the issue fix was triggered from.",
    )

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        stopping_point = data.get("stopping_point", None)
        # Stopping points take precedence and forces full automation from `root_cause`
        if stopping_point:
            data["step"] = "root_cause"
        return data


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class GroupAutofixEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=25, window=60),
                RateLimitCategory.USER: RateLimit(limit=25, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60 * 60),  # 1 hour
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=1024, window=60),
                RateLimitCategory.USER: RateLimit(limit=1024, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=8192, window=60),
            },
        }
    )

    @extend_schema(
        operation_id="startOrganizationIssueAutofix",
        summary="Start Seer Issue Fix",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        request=ExplorerAutofixRequestSerializer,
        responses={
            202: inline_sentry_response_serializer("AutofixPostResponse", AutofixPostResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=AutofixExamples.AUTOFIX_POST_RESPONSE,
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-autofix",
        url_names=["sentry-api-0-group-autofix"],
    )
    def post(
        self, request: Request, group: Group
    ) -> (
        Response[AutofixPostResponse]
        | Response[AutofixHandoffResponse]
        | Response[None]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[str]
    ):
        """
        Trigger a Seer Issue Fix run for a specific issue.

        The issue fix process can:
        - Identify the root cause of the issue
        - Propose a solution
        - Generate code changes
        - Create a pull request with the fix

        The process runs asynchronously, and you can get the state using the GET endpoint.
        """
        serializer = ExplorerAutofixRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        step = data.get("step", "root_cause")
        stopping_point = data.get("stopping_point")

        # Prefer sentry_run_id (a uuid.UUID) over numeric run_id; None = new run.
        sentry_run_id_param: uuid.UUID | None = data.get("sentry_run_id")
        run_ref: str | int | None = (
            str(sentry_run_id_param) if sentry_run_id_param is not None else data.get("run_id")
        )

        resolved_run_id: int | None = None
        resolved_sentry_run_id: str | None = None
        if run_ref is not None:
            resolved = resolve_seer_run(run_ref, group.organization, for_continue=True)
            if isinstance(resolved, Response):
                return resolved
            resolved_run_id = resolved.seer_run_state_id
            resolved_sentry_run_id = resolved.uuid

        is_autofix_kickoff = resolved_run_id is None
        user_context = data.get("user_context")

        referrer = _parse_autofix_referrer(data.get("referrer"), request)

        run_id: int
        sentry_run_id: str | None

        match step:
            case "coding_agent_handoff":
                integration_id = data.get("integration_id")
                provider = data.get("provider")

                if resolved_run_id is None or (not integration_id and not provider):
                    return Response(
                        {
                            "detail": "run_id and either integration_id or provider are required for coding_agent_handoff"
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if integration_id and provider:
                    return Response(
                        {"detail": "Cannot specify both integration_id and provider"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    handoff_result: AutofixHandoffResponse = trigger_coding_agent_handoff(
                        group=group,
                        run_id=resolved_run_id,
                        referrer=referrer,
                        integration_id=integration_id,
                        provider=provider,
                        user_id=request.user.id if request.user else None,
                        auto_create_pr=True,
                    )
                except SeerPermissionError as e:
                    if _is_unknown_run_id_error(e):
                        return Response(status=status.HTTP_404_NOT_FOUND)

                    raise PermissionDenied(SEER_PERMISSION_DENIED)

                return Response(handoff_result, status=status.HTTP_202_ACCEPTED)
            case "open_pr":
                if resolved_run_id is None:
                    return Response(
                        {"detail": "run_id is required for open_pr"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    trigger_push_changes(
                        group,
                        resolved_run_id,
                        referrer=referrer,
                        repo_name=data.get("repo_name"),
                    )
                except SeerPermissionError:
                    return Response(status=status.HTTP_404_NOT_FOUND)

                run_id, sentry_run_id = resolved_run_id, resolved_sentry_run_id
            case "pr_iteration":
                if resolved_run_id is None:
                    return Response(
                        {"detail": "run_id is required for pr_iteration"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not features.has("organizations:autofix-pr-iteration", group.organization):
                    return Response(
                        {"detail": "PR iteration is not enabled for this organization"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not user_context:
                    return Response(
                        {"detail": "feedback is required for pr_iteration"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    run_state = get_autofix_run_state(group, resolved_run_id)
                except SeerPermissionError:
                    raise PermissionDenied(SEER_PERMISSION_DENIED)

                if not run_state.repo_pr_states:
                    return Response(
                        {"detail": "Cannot iterate on a PR before one has been created"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                serialized_users = user_service.serialize_many(
                    filter={"user_ids": [request.user.id]},
                )
                feedback = Feedback(
                    text=user_context,
                    source={
                        "type": "user-ui",
                        "user_id": request.user.id,
                        "user": serialized_users[0] if serialized_users else None,
                    },
                )

                enqueue_autofix_feedback(
                    run_id=resolved_run_id,
                    organization_id=group.organization.id,
                    group_id=group.id,
                    feedback=feedback,
                    referrer=referrer,
                )

                consume_queued_autofix_feedback.apply_async(
                    kwargs={
                        "run_id": resolved_run_id,
                        "organization_id": group.organization.id,
                        "group_id": group.id,
                    }
                )

                run_id, sentry_run_id = resolved_run_id, resolved_sentry_run_id

            case _:
                try:
                    run_id = trigger_autofix_agent(
                        group=group,
                        step=AutofixStep(step),
                        referrer=referrer,
                        stopping_point=(
                            AutofixStoppingPoint(stopping_point) if stopping_point else None
                        ),
                        run_id=resolved_run_id,
                        user_context=user_context,
                        insert_index=data.get("insert_index"),
                    )
                except NoSeerQuotaException:
                    return Response(
                        "No budget for Seer Autofix.", status=status.HTTP_402_PAYMENT_REQUIRED
                    )
                except SeerPermissionError as e:
                    if _is_unknown_run_id_error(e):
                        return Response(status=status.HTTP_404_NOT_FOUND)
                    raise PermissionDenied(SEER_PERMISSION_DENIED)

                if is_autofix_kickoff:
                    publish_action(
                        TriggerAutofixAction(),
                        source=resolve_action_source(request),
                        group_id=group.id,
                        project=group.project,
                        actor=resolve_action_actor(request),
                    )
                    run = get_seer_run(run_id, group.organization)
                    sentry_run_id = str(run.uuid) if run else None
                else:
                    sentry_run_id = resolved_sentry_run_id

        kickoff_body = {
            "run_id": run_id,
            "sentry_run_id": sentry_run_id,
        }
        return Response(kickoff_body, status=status.HTTP_202_ACCEPTED)

    @extend_schema(
        operation_id="getOrganizationIssueAutofixState",
        summary="Retrieve Seer Issue Fix State",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        responses={
            200: inline_sentry_response_serializer("AutofixStateResponse", AutofixStateResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=AutofixExamples.AUTOFIX_GET_RESPONSE,
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-autofix",
        url_names=["sentry-api-0-group-autofix"],
    )
    def get(self, request: Request, group: Group) -> Response[AutofixStateResponse]:
        """
        Retrieve the current detailed state of an issue fix process for a specific issue including:

        - Current status
        - Steps performed and their outcomes
        - Repository information and permissions
        - Root Cause Analysis
        - Proposed Solution
        - Generated code changes

        This endpoint although documented is still experimental and the payload may change in the future.
        """
        try:
            state = get_autofix_agent_state(group.organization, group.id)
        except SeerPermissionError as e:
            raise PermissionDenied(str(e))

        if state is None:
            return Response({"autofix": None})

        if state.coding_agents and request.user.id:
            agent_providers = {a.provider for a in state.coding_agents.values()}
            if CodingAgentProviderType.GITHUB_COPILOT_AGENT in agent_providers:
                poll_github_copilot_agents(
                    coding_agents=state.coding_agents,
                    user_id=request.user.id,
                    organization_id=group.organization.id,
                    run_id=state.run_id,
                )
            if CodingAgentProviderType.CLAUDE_CODE_AGENT in agent_providers:
                poll_claude_code_agents(
                    coding_agents=state.coding_agents,
                    organization_id=group.organization.id,
                    run_id=state.run_id,
                )

        run = get_seer_run(state.run_id, group.organization)
        blocks = [block.dict() for block in state.blocks]
        iteration_blocks = [
            block for iteration in get_iterations(state) for block in iteration.blocks
        ]
        missing_perms = get_out_of_date_github_permissions(group.organization, iteration_blocks)
        warnings = [
            GithubAppPermissionsWarning(
                repo_name=repo_name,
                installation_id=info.installation_id,
            ).dict()
            for repo_name, info in missing_perms.items()
        ]
        queued_feedback = [
            item.feedback.dict() for item in peek_queued_autofix_feedback(state.run_id)
        ]
        return Response(
            {
                "autofix": {
                    "run_id": state.run_id,
                    "sentry_run_id": str(run.uuid) if run else None,
                    "status": state.status,
                    "blocks": blocks,
                    "updated_at": state.updated_at,
                    "pending_user_input": (
                        state.pending_user_input.dict() if state.pending_user_input else None
                    ),
                    "repo_pr_states": {
                        repo: pr_state.dict() for repo, pr_state in state.repo_pr_states.items()
                    },
                    "coding_agents": {
                        agent_id: agent.dict() for agent_id, agent in state.coding_agents.items()
                    },
                    "pr_iteration_enabled": features.has(
                        "organizations:autofix-pr-iteration", group.organization
                    ),
                    "queued_feedback": queued_feedback,
                    "warnings": warnings,
                }
            }
        )
