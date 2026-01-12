from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.autofix_examples import AutofixExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.autofix import trigger_autofix
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    get_autofix_explorer_state,
    trigger_autofix_explorer,
)
from sentry.seer.autofix.types import AutofixPostResponse, AutofixStateResponse
from sentry.seer.autofix.utils import AutofixStoppingPoint, get_autofix_state
from sentry.seer.models import SeerPermissionError
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


class AutofixRequestSerializer(CamelSnakeSerializer):
    event_id = serializers.CharField(
        required=False,
        help_text="Run issue fix on a specific event. If not provided, the recommended event for the issue will be used.",
    )
    instruction = serializers.CharField(
        required=False,
        help_text="Optional custom instruction to guide the issue fix process.",
        allow_blank=True,
    )
    pr_to_comment_on_url = serializers.URLField(
        required=False, help_text="URL of a pull request where the issue fix should add comments."
    )
    stopping_point = serializers.ChoiceField(
        required=False,
        choices=["root_cause", "solution", "code_changes", "open_pr"],
        help_text="Where the issue fix process should stop. If not provided, will run to root cause.",
    )


class ExplorerAutofixRequestSerializer(CamelSnakeSerializer):
    """Serializer for Explorer-based autofix requests."""

    step = serializers.ChoiceField(
        required=False,
        choices=["root_cause", "solution", "code_changes", "impact_assessment", "triage"],
        default="root_cause",
        help_text="Which autofix step to run.",
    )
    run_id = serializers.IntegerField(
        required=False,
        help_text="Existing run ID to continue. If not provided, starts a new run.",
    )


@region_silo_endpoint
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

    def _should_use_explorer(self, request: Request, organization: Organization) -> bool:
        """Check if explorer mode should be used based on query params and feature flags."""
        if request.GET.get("mode") != "explorer":
            return False

        if not features.has("organizations:seer-explorer", organization, actor=request.user):
            return False

        if not features.has("organizations:autofix-on-explorer", organization, actor=request.user):
            return False

        return True

    @extend_schema(
        operation_id="Start Seer Issue Fix",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        request=AutofixRequestSerializer,
        responses={
            202: inline_sentry_response_serializer("AutofixPostResponse", AutofixPostResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=AutofixExamples.AUTOFIX_POST_RESPONSE,
    )
    def post(self, request: Request, group: Group) -> Response:
        """
        Trigger a Seer Issue Fix run for a specific issue.

        The issue fix process can:
        - Identify the root cause of the issue
        - Propose a solution
        - Generate code changes
        - Create a pull request with the fix

        The process runs asynchronously, and you can get the state using the GET endpoint.
        """
        if self._should_use_explorer(request, group.organization):
            return self._post_explorer(request, group)
        return self._post_legacy(request, group)

    def _post_explorer(self, request: Request, group: Group) -> Response:
        """Handle POST for Explorer-based autofix."""
        serializer = ExplorerAutofixRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        try:
            run_id = trigger_autofix_explorer(
                group=group,
                step=AutofixStep(data.get("step", "root_cause")),
                run_id=data.get("run_id"),
            )
            return Response({"run_id": run_id}, status=202)
        except SeerPermissionError as e:
            raise PermissionDenied(str(e))

    def _post_legacy(self, request: Request, group: Group) -> Response:
        """Handle POST for legacy autofix."""
        serializer = AutofixRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        stopping_point = data.get("stopping_point")
        stopping_point = AutofixStoppingPoint(stopping_point) if stopping_point else None

        return trigger_autofix(
            group=group,
            # This event_id is the event that the user is looking at when they click the "Fix" button
            event_id=data.get("event_id"),
            user=request.user,
            instruction=data.get("instruction"),
            pr_to_comment_on_url=data.get("pr_to_comment_on_url"),
            stopping_point=stopping_point,
        )

    @extend_schema(
        operation_id="Retrieve Seer Issue Fix State",
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
    def get(self, request: Request, group: Group) -> Response:
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
        if self._should_use_explorer(request, group.organization):
            return self._get_explorer(request, group)
        return self._get_legacy(request, group)

    def _get_explorer(self, request: Request, group: Group) -> Response:
        """Handle GET for Explorer-based autofix."""
        try:
            state = get_autofix_explorer_state(group.organization, group.id)
        except SeerPermissionError as e:
            raise PermissionDenied(str(e))

        if state is None:
            return Response({"autofix": None})

        # Return the Explorer state directly - frontend will handle the format
        return Response(
            {
                "autofix": {
                    "run_id": state.run_id,
                    "status": state.status,
                    "blocks": [block.dict() for block in state.blocks],
                    "updated_at": state.updated_at,
                    "pending_user_input": (
                        state.pending_user_input.dict() if state.pending_user_input else None
                    ),
                    "repo_pr_states": {
                        repo: pr_state.dict() for repo, pr_state in state.repo_pr_states.items()
                    },
                }
            }
        )

    def _get_legacy(self, request: Request, group: Group) -> Response:
        """Handle GET for legacy autofix."""
        access_check_cache_key = f"autofix_access_check:{group.id}"
        access_check_cache_value = cache.get(access_check_cache_key)

        check_repo_access = False
        if not access_check_cache_value:
            check_repo_access = True

        is_user_watching = request.GET.get("isUserWatching", False)

        try:
            autofix_state = get_autofix_state(
                group_id=group.id,
                organization_id=group.organization.id,
                check_repo_access=check_repo_access,
                is_user_fetching=bool(is_user_watching),
            )
        except SeerPermissionError:
            logger.exception(
                "group_ai_autofix.get.seer_permission_error",
                extra={"group_id": group.id, "organization_id": group.organization.id},
            )

            raise PermissionDenied("You are not authorized to access this autofix state")

        if check_repo_access:
            cache.set(access_check_cache_key, True, timeout=60)  # 1 minute timeout

        response_state: dict[str, Any] | None = None

        if autofix_state:
            response_state = autofix_state.dict()
            user_ids = autofix_state.actor_ids
            if user_ids:
                users = user_service.serialize_many(
                    filter={"user_ids": user_ids, "organization_id": request.organization.id},
                    as_user=request.user,
                )

                users_map = {user["id"]: user for user in users}

                response_state["users"] = users_map

            project = group.project
            repositories = []

            autofix_codebase_state = response_state.get("codebases", {})

            repo_code_mappings: dict[str, RepositoryProjectPathConfig] = {}
            if project:
                code_mappings = get_sorted_code_mapping_configs(project=project)
                for mapping in code_mappings:
                    if mapping.repository.external_id:
                        repo_code_mappings[mapping.repository.external_id] = mapping

            for repo_external_id, repo_state in autofix_codebase_state.items():
                retrieved_mapping: RepositoryProjectPathConfig | None = repo_code_mappings.get(
                    repo_external_id, None
                )

                if not retrieved_mapping:
                    continue

                mapping_repo: Repository = retrieved_mapping.repository

                repositories.append(
                    {
                        "integration_id": mapping_repo.integration_id,
                        "url": mapping_repo.url,
                        "external_id": repo_external_id,
                        "name": mapping_repo.name,
                        "provider": mapping_repo.provider,
                        "default_branch": retrieved_mapping.default_branch,
                        "is_readable": repo_state.get("is_readable", None),
                        "is_writeable": repo_state.get("is_writeable", None),
                    }
                )

            response_state["repositories"] = repositories

            # Remove unnecessary or sensitive data to reduce returned payload size
            for key in ["usage", "signals"]:
                response_state.pop(key, None)
            for request_key in ["issue", "trace_tree", "profile", "issue_summary", "logs"]:
                if "request" in response_state and request_key in response_state["request"]:
                    del response_state["request"][request_key]

        return Response({"autofix": response_state})
