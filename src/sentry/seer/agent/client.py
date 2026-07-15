from __future__ import annotations

import logging
import random
import time
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal, overload

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone as django_timezone
from django.utils.timezone import now
from pydantic import BaseModel
from rest_framework.request import Request
from urllib3 import BaseHTTPResponse

from sentry import features, options
from sentry.constants import ENABLE_SEER_CODING_DEFAULT, ObjectStatus
from sentry.hybridcloud.rpc.service import RpcException
from sentry.identity import default_manager as identity_manager
from sentry.identity.mcp import McpIdentityProvider
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.services.identity import identity_service
from sentry.integrations.types import MONITORING_PROVIDERS
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client_models import AgentRun, AgentRunWithPrs, SeerRunState
from sentry.seer.agent.client_utils import (
    AgentChatRequest,
    AgentReposRequest,
    AgentRunsRequest,
    AgentUpdateRequest,
    SeerFeatureRunRequest,
    collect_user_org_context,
    enqueue_seer_run,
    fetch_run_status,
    get_proxy_headers,
    make_agent_chat_request,
    make_agent_repos_request,
    make_agent_runs_request,
    make_agent_update_request,
    poll_until_done,
)
from sentry.seer.agent.coding_agent_handoff import launch_coding_agents
from sentry.seer.agent.custom_tool_utils import AgentTool, extract_tool_schema
from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.seer.agent.on_completion_hook import (
    AgentOnCompletionHook,
    extract_hook_definition,
)
from sentry.seer.models import SeerApiError, SeerPermissionError, SeerRepoDefinition
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.seer.utils import encrypt_access_token_for_seer
from sentry.tasks.seer.context_engine_index import build_service_map, index_org_project_knowledge
from sentry.tasks.seer.explorer_index import dispatch_explorer_index_projects
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.prompts import (
    get_prompt_activities_for_user,
    seer_monitoring_provider_dont_ask_feature,
)

logger = logging.getLogger(__name__)


def _trigger_explorer_indexes_if_needed(
    organization_id: int,
    has_explorer_index: bool | None,
    has_org_project_context: bool | None,
) -> None:
    """Trigger explorer indexing for the org if Seer reports missing indexes."""
    if options.get("seer.explorer_index.killswitch.enable"):
        logger.info("seer.explorer_index.killswitch.enable flag enabled, skipping")
        return

    logger.info(
        "Maybe trigger explorer index tasks",
        extra={
            "organization_id": organization_id,
            "has_explorer_index": has_explorer_index,
            "has_org_project_context": has_org_project_context,
        },
    )
    if has_explorer_index is False:
        projects = list(
            Project.objects.filter(
                organization_id=organization_id,
                status=ObjectStatus.ACTIVE,
            )
        )

        projects_batch = [(p.id, organization_id) for p in projects if p.flags.has_transactions]

        if projects_batch:
            for _ in dispatch_explorer_index_projects(iter(projects_batch), django_timezone.now()):
                pass

    if has_org_project_context is False:
        logger.info(
            "Dispatching context engine index tasks",
            extra={"organization_id": organization_id},
        )
        index_org_project_knowledge.apply_async(args=[organization_id])
        build_service_map.apply_async(args=[organization_id])


def _has_context_engine(
    organization: Organization, user: User | RpcUser | AnonymousUser | None
) -> bool:
    return True


def get_monitoring_provider_connections(
    organization: Organization, user_id: int
) -> list[dict[str, Any]]:
    """Fetch the user's monitoring provider identities and build connection dicts for Seer."""
    if not features.has("organizations:seer-infra-telemetry", organization):
        return []

    connections: list[dict[str, Any]] = []
    for provider_type in MONITORING_PROVIDERS:
        provider = identity_manager.get(provider_type)
        is_oauth_provider = isinstance(provider, OAuth2Provider)
        if not isinstance(provider, McpIdentityProvider):
            continue

        try:
            identities = identity_service.get_org_user_identities_by_provider_type(
                organization_id=organization.id, user_id=user_id, provider_type=provider_type
            )
        except RpcException:
            # Monitoring providers are optional enrichment. A control-silo RPC failure
            # shouldn't fail a run--just move on to the next provider.
            logger.warning(
                "seer.monitoring_providers.fetch_failed",
                extra={
                    "organization_id": organization.id,
                    "user_id": user_id,
                    "provider": provider_type,
                },
                exc_info=True,
            )
            continue

        for identity in identities:
            access_token = identity.data.get("access_token")
            if not access_token:
                continue
            urls = provider.build_mcp_urls(identity.data)
            if not urls:
                continue
            encrypted_access_token = encrypt_access_token_for_seer(access_token)
            if not encrypted_access_token:
                continue
            auth_method = "oauth" if is_oauth_provider else "pat"
            for url in urls:
                connections.append(
                    {
                        "provider_key": provider_type,
                        "url": url,
                        "encrypted_access_token": encrypted_access_token,
                        "identity_id": identity.id,
                        "auth_method": auth_method,
                    }
                )

    return connections


def get_available_monitoring_providers(
    organization: Organization,
    user_id: int,
) -> list[dict[str, Any]]:
    """
    Catalog of available monitoring providers that may or may not be connected to Seer.

    Omits any provider that the user has permanently dismissed ("don't ask again").
    Does not mark which providers are already connected.
    """
    if not features.has("organizations:seer-infra-telemetry", organization):
        return []

    feature_to_provider_map = {
        seer_monitoring_provider_dont_ask_feature(provider_type): provider_type
        for provider_type in MONITORING_PROVIDERS
    }
    dismissed_providers = {
        feature_to_provider_map[activity.feature]
        for activity in get_prompt_activities_for_user(
            [organization.id], user_id, list(feature_to_provider_map)
        )
        if activity.data.get("dismissed_ts")
    }

    available_providers: list[dict[str, Any]] = []
    for provider_type in MONITORING_PROVIDERS:
        if provider_type in dismissed_providers:
            continue

        provider = identity_manager.get(provider_type)
        is_oauth_provider = isinstance(provider, OAuth2Provider)
        if not isinstance(provider, McpIdentityProvider):
            continue

        available_providers.append(
            {
                "provider_key": provider_type,
                "auth_method": "oauth" if is_oauth_provider else "pat",
            }
        )

    return available_providers


class SeerAgentClient:
    """
    A simple client for the Seer Agent, our general debugging agent.

    This provides a class-based interface for Sentry developers to build agentic features
    with full Sentry context.

    Example usage:
    ```python
        from sentry.seer.agent.client import SeerAgentClient
        from pydantic import BaseModel

        # SIMPLE USAGE
        client = SeerAgentClient(organization, user)
        run_id = client.start_run("Analyze trace XYZ and find performance issues").seer_run_state_id
        state = client.get_run(run_id)

        # WITH ARTIFACTS
        class RootCause(BaseModel):
            cause: str
            confidence: float

        class Solution(BaseModel):
            description: str
            steps: list[str]

        client = SeerAgentClient(organization, user)

        # Step 1: Generate root cause artifact
        run_id = client.start_run(
            "Analyze why users see 500 errors",
            artifact_key="root_cause",
            artifact_schema=RootCause
        ).seer_run_state_id
        state = client.get_run(run_id, blocking=True)
        root_cause = state.get_artifact("root_cause", RootCause)

        # Step 2: Continue to generate solution (preserves root_cause)
        client.continue_run(
            run_id,
            "Propose a fix for this root cause",
            artifact_key="solution",
            artifact_schema=Solution
        )
        state = client.get_run(run_id, blocking=True)
        solution = state.get_artifact("solution", Solution)

        # WITH CUSTOM TOOLS
        from pydantic import BaseModel, Field
        from sentry.seer.agent.custom_tool_utils import AgentTool

        class DeploymentStatusParams(BaseModel):
            environment: str = Field(description="Environment name (e.g., 'production', 'staging')")
            service: str = Field(description="Service name")

        class DeploymentStatusTool(AgentTool[DeploymentStatusParams]):
            params_model = DeploymentStatusParams

            @classmethod
            def get_description(cls) -> str:
                return "Check if a service is deployed in an environment"

            @classmethod
            def execute(cls, organization, params: DeploymentStatusParams) -> str:
                return "deployed" if check_deployment(organization, params.environment, params.service) else "not deployed"

        client = SeerAgentClient(
            organization,
            user,
            custom_tools=[DeploymentStatusTool]
        )
        run_id = client.start_run("Check if payment-service is deployed in production").seer_run_state_id

        # WITH ON-COMPLETION HOOK
        from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook

        class NotifyOnComplete(AgentOnCompletionHook):
            @classmethod
            def execute(cls, organization: Organization, run_id: int) -> None:
                # Called when the agent completes (regardless of status)
                send_notification(organization, f"agent run {run_id} completed")

        client = SeerAgentClient(
            organization,
            user,
            on_completion=NotifyOnComplete
        )
        run_id = client.start_run("Analyze this issue").seer_run_state_id

        # WITH CODE EDITING AND PR CREATION
        client = SeerAgentClient(
            organization,
            user,
            enable_coding=True,  # Enable code editing tools
        )

        run_id = client.start_run("Fix the null pointer exception in auth.py").seer_run_state_id
        state = client.get_run(run_id, blocking=True)

        # Check if agent made code changes and if they need to be pushed
        has_changes, is_synced = state.has_code_changes()
        if has_changes and not is_synced:
            # Push changes to PR (creates new PR or updates existing)
            state = client.push_changes(run_id)

            # Get PR info for each repo
            for repo_name in state.get_diffs_by_repo().keys():
                pr_state = state.get_pr_state(repo_name)
                if pr_state and pr_state.pr_url:
                    print(f"PR created: {pr_state.pr_url}")

        # WITH EXTERNAL CODING AGENTS (e.g., Cursor)
        client = SeerAgentClient(organization, user)
        run_id = client.start_run("Analyze the authentication bug").seer_run_state_id
        state = client.get_run(run_id, blocking=True)

        result = client.launch_coding_agents(
            run_id=run_id,
            integration_id=cursor_integration_id,
            prompt="Fix the null pointer exception in auth.py. Focus on error handling.",
            repos=["getsentry/sentry"],
            branch_name_base="fix-auth-bug",
        )

        for success in result["successes"]:
            agent_url = success["coding_agent_state"].get("agent_url")
            print(f"Coding agent launched: {agent_url}")
    ```

        Args:
            organization: Sentry organization
            user: User for permission checks and user-specific context (can be User, RpcUser, AnonymousUser, or None)
            project: Optional project for project-scoped runs (e.g. autofix for an issue)
            group: Optional group/issue for issue-scoped runs (e.g. autofix for an issue)
            category_key: Optional category key for filtering/grouping runs (e.g., "bug-fixer", "trace-analyzer"). Must be provided together with category_value. Makes it easy to retrieve runs for your feature later.
            category_value: Optional category value for filtering/grouping runs (e.g., issue ID, trace ID). Must be provided together with category_key. Makes it easy to retrieve a specific run for your feature later.
            custom_tools: Optional list of `AgentTool` classes to make available as tools to the agent. Each tool must inherit from AgentTool, define a params_model (Pydantic BaseModel), and implement execute(). Tools are automatically given access to the organization context. Tool classes must be module-level (not nested classes).
            on_completion_hook: Optional `AgentOnCompletionHook` class to call when the agent completes. The hook's execute() method receives the organization and run ID. This is called whether or not the agent was successful. Hook classes must be module-level (not nested classes).
            intelligence_level: Optionally set the intelligence level of the agent. Higher intelligence gives better result quality at the cost of significantly higher latency and cost.
            is_interactive: Enable full interactive, human-like features of the agent. Only enable if you support *all* available interactions in Seer. An example use of this is the explorer chat in Sentry UI.
            enable_coding: Include code editing tools. When False, the agent cannot make code changes. Default is False. If enable_coding is True and the organization does not have the enable_seer_coding option, a SeerPermissionError will be raised.
            code_review_enabled: Expose the review_code_changes tool, which spawns a reviewer agent to check accumulated code edits before finalizing. Only useful alongside enable_coding. Default is False.
            max_iterations: Optional maximum number of agent iterations. Useful for lightweight/fast runs that don't need full exploration depth.
            enable_embeds: Allow the agent to emit rich inline embed widgets (e.g. formatted timestamps) as Markdoc tags. Only enable for surfaces that render these embeds (the Explorer chat in the Sentry UI). Disable for plaintext/markdown surfaces like Slack, where the tags would leak as raw text. Default is True.
    """

    def __init__(
        self,
        organization: Organization,
        user: User | RpcUser | AnonymousUser | None = None,
        project: Project | None = None,
        group: Group | None = None,
        category_key: str | None = None,
        category_value: str | None = None,
        custom_tools: list[type[AgentTool[Any]]] | None = None,
        on_completion_hook: type[AgentOnCompletionHook] | None = None,
        intelligence_level: Literal["low", "medium", "high"] = "medium",
        reasoning_effort: Literal["low", "medium", "high"] | None = None,
        is_interactive: bool = False,
        enable_coding: bool = False,
        enable_pr_context_tools: bool = False,
        enable_code_mode_tools: str = "off",
        code_review_enabled: bool = False,
        max_iterations: int | None = None,
        enable_embeds: bool = True,
    ):
        self.organization = organization
        self.user = user
        self.project = project
        self.group = group
        self.custom_tools = custom_tools or []
        self.on_completion_hook = on_completion_hook
        self.intelligence_level = intelligence_level
        self.reasoning_effort = reasoning_effort
        self.category_key = category_key
        self.category_value = category_value
        self.is_interactive = is_interactive
        self.enable_code_mode_tools = enable_code_mode_tools
        self.code_review_enabled = code_review_enabled
        self.max_iterations = max_iterations
        self.enable_embeds = enable_embeds

        if enable_coding and not organization.get_option("sentry:enable_seer_coding", True):
            raise SeerPermissionError("Seer coding is not enabled for this organization")

        self.enable_coding = enable_coding

        if enable_pr_context_tools and not features.has(
            "organizations:autofix-pr-iteration", organization, actor=user
        ):
            raise SeerPermissionError("PR context tools are not enabled for this organization")

        self.enable_pr_context_tools = enable_pr_context_tools

        self.viewer_context = self._build_viewer_context()

        # Validate that category_key and category_value are provided together
        if category_key == "" or category_value == "":
            raise ValueError("category_key and category_value cannot be empty strings")
        if bool(category_key) != bool(category_value):
            raise ValueError("category_key and category_value must be provided together")

        # Validate base Seer access on init (agent-specific flag checks are done at the endpoint level)
        has_access, error = has_seer_access_with_detail(organization, user)
        if not has_access:
            raise SeerPermissionError(error or "Access denied")

    def _build_viewer_context(self) -> SeerViewerContext:
        context = SeerViewerContext(organization_id=self.organization.id)
        if self.user and hasattr(self.user, "id") and self.user.id is not None:
            context["user_id"] = self.user.id
        return context

    def start_run(
        self,
        prompt: str,
        prompt_metadata: dict[str, str] | None = None,
        on_page_context: str | None = None,
        page_name: str | None = None,
        artifact_key: str | None = None,
        artifact_schema: type[BaseModel] | None = None,
        metadata: dict[str, Any] | None = None,
        request: Request | None = None,
        override_ce_enable: bool = True,
        ui_tools: str | None = None,
    ) -> SeerRun:
        """
        Start a new Seer Agent session.

        Args:
            prompt: The initial task/query for the agent
            on_page_context: Optional context from the user's screen
            artifact_key: Optional key to identify this artifact (required if artifact_schema is provided)
            artifact_schema: Optional Pydantic model to generate a structured artifact
            metadata: Optional metadata to store with the run (e.g., stopping_point). group_id is
                added automatically when the client was constructed with a group.
            request: Optional rest_framework Request object from endpoints.

        Returns:
            SeerRun: The mirror row for the run. Its seer_run_state_id is the id
            passed to get_run/continue_run and surfaced to clients.

        Raises:
            SeerApiError: If the Seer API request fails
            ValueError: If artifact_schema is provided without artifact_key
        """
        if bool(artifact_schema) != bool(artifact_key):
            raise ValueError("artifact_key and artifact_schema must be provided together")

        user_org_context = collect_user_org_context(self.user, self.organization, request=request)

        agent_run_options: dict[str, Any] = {
            "enable_coding": self.enable_coding,
            "enable_code_mode_tools": self.enable_code_mode_tools,
            "code_review_enabled": self.code_review_enabled,
            "enable_pr_context_tools": self.enable_pr_context_tools,
        }

        chat_body: AgentChatRequest = AgentChatRequest(
            organization_id=self.organization.id,
            query=prompt,
            run_id=None,
            insert_index=None,
            on_page_context=on_page_context,
            page_name=page_name,
            user_org_context=user_org_context,
            intelligence_level=self.intelligence_level,
            is_interactive=self.is_interactive,
            agent_run_options=agent_run_options,
            proxy_headers=get_proxy_headers() if self.enable_code_mode_tools != "off" else None,
        )

        if self.reasoning_effort is not None:
            chat_body["reasoning_effort"] = self.reasoning_effort

        if self.max_iterations is not None:
            chat_body["max_iterations"] = self.max_iterations

        if self.project:
            chat_body["project_id"] = self.project.id

        if prompt_metadata:
            chat_body["query_metadata"] = prompt_metadata

        # Add artifact key and schema if provided
        if artifact_key and artifact_schema:
            chat_body["artifact_key"] = artifact_key
            chat_body["artifact_schema"] = artifact_schema.schema()

        # Extract and add custom tool definitions
        if self.custom_tools:
            chat_body["custom_tools"] = [
                extract_tool_schema(tool).dict() for tool in self.custom_tools
            ]

        # Add on-completion hook if provided
        if self.on_completion_hook:
            chat_body["on_completion_hook"] = extract_hook_definition(
                self.on_completion_hook
            ).dict()

        if self.category_key and self.category_value:
            chat_body["category_key"] = self.category_key
            chat_body["category_value"] = self.category_value

        if self.group:
            metadata = {**(metadata or {}), "group_id": self.group.id}

        if metadata:
            chat_body["metadata"] = metadata

        if ui_tools:
            chat_body["ui_tools"] = ui_tools

        agent_run_options.update(
            self._build_agent_run_options(override_ce_enable=override_ce_enable)
        )

        user_id = (
            self.user.id
            if self.user and hasattr(self.user, "id") and self.user.id is not None
            else None
        )

        def _create_agent_run(run: SeerRun) -> None:
            source = self.category_key or ""
            if not source:
                logger.warning(
                    "seer_agent_run.missing_source",
                    extra={
                        "organization_id": self.organization.id,
                        "seer_run_id": run.id,
                        "user_id": user_id,
                    },
                )
            SeerAgentRun.objects.create(
                run=run,
                title=prompt[:255] + "…" if len(prompt) > 256 else prompt,
                source=source,
                project=self.project,
                group=self.group,
                extras=({"category_value": self.category_value} if self.category_value else {}),
            )

        return enqueue_seer_run(
            organization=self.organization,
            run_type=SeerRunType.EXPLORER,
            body=chat_body,
            on_run_created=_create_agent_run,
            viewer_context=self.viewer_context,
            user_id=user_id,
            referrer=metadata.get("referrer") if metadata else None,
            flush=True,
        )

    def start_feature_run(
        self,
        feature_id: str,
        payload: dict[str, Any],
        title: str,
        flush: bool = True,
        extras: dict[str, Any] | None = None,
        on_run_created: Callable[[SeerRun], None] | None = None,
    ) -> SeerRun:
        """Dispatch a run to a registered Seer feature by feature_id via the
        SEER_RUN_CREATE outbox. The feature builds its own agent run from
        `payload`; the result is pushed back via deliver_feature_result.
        Also creates a SeerAgentRun mirror (source=feature_id, title=title)
        so the run shows up in the Explorer session-history listing.

        on_run_created(run), if given, runs in the same transaction as the
        SeerRun + outbox — use it to link associated rows atomically (e.g. a
        caller's record that the result delivery correlates back to).

        flush=True (default): drain inline; dispatch failure surfaces
        synchronously (mirror -> FAILED, raises SeerApiError, no retry).

        flush=False: leave the row for the async outbox runner to drain and
        retry. Use for background callers (e.g. night shift).
        """
        user_id = (
            self.user.id
            if self.user and hasattr(self.user, "id") and self.user.id is not None
            else None
        )

        def _create_agent_run(run: SeerRun) -> None:
            SeerAgentRun.objects.create(
                run=run,
                title=title[:255] + "…" if len(title) > 256 else title,
                source=feature_id,
                project=self.project,
                group=self.group,
                extras=extras or {},
            )
            if on_run_created is not None:
                on_run_created(run)

        return enqueue_seer_run(
            organization=self.organization,
            run_type=SeerRunType.FEATURE_RUN,
            on_run_created=_create_agent_run,
            body=SeerFeatureRunRequest(
                feature_id=feature_id,
                payload=payload,
                agent_run_options=self._build_agent_run_options(),
            ),
            viewer_context=self.viewer_context,
            user_id=user_id,
            referrer=feature_id,
            flush=flush,
        )

    def _build_agent_run_options(self, override_ce_enable: bool = True) -> dict[str, Any]:
        """Resolve org-flag-driven agent run options, shared by start_run and start_feature_run."""
        opts: dict[str, Any] = {}

        if _has_context_engine(self.organization, self.user):
            if random.random() < options.get("seer.explorer.context-engine-rollout"):
                opts["is_context_engine_enabled"] = True

        if features.has(
            "organizations:seer-explorer-context-engine-allow-fe-override",
            self.organization,
            actor=self.user,
        ):
            opts["is_context_engine_enabled"] = override_ce_enable

        if features.has(
            "organizations:seer-agent-source-code-search",
            self.organization,
            actor=self.user,
        ):
            opts["enable_frontend_code_search"] = True

        if features.has(
            "organizations:seer-use-agent-sandbox",
            self.organization,
            actor=self.user,
        ):
            opts["use_agent_sandbox"] = True

        if features.has(
            "organizations:seer-explorer-thinking-summary",
            self.organization,
            actor=self.user,
        ):
            opts["enable_tool_summary"] = True

        if self.enable_embeds and features.has(
            "organizations:seer-explorer-embeds",
            self.organization,
            actor=self.user,
        ):
            opts["embed_widgets"] = get_embed_widgets(self.organization, self.user)

        if features.has(
            "organizations:seer-explorer-stream",
            self.organization,
            actor=self.user,
        ):
            opts["enable_streaming"] = True

        return opts

    def continue_run(
        self,
        run_id: int,
        prompt: str,
        prompt_metadata: dict[str, str] | None = None,
        insert_index: int | None = None,
        on_page_context: str | None = None,
        page_name: str | None = None,
        artifact_key: str | None = None,
        artifact_schema: type[BaseModel] | None = None,
        ui_tools: str | None = None,
        request: Request | None = None,
    ) -> int:
        """
        Continue an existing Seer Agent session. This allows you to add follow-up queries to an ongoing conversation.

        Args:
            run_id: The run ID from start_run()
            prompt: The follow-up task/query for the agent
            insert_index: Optional index to insert the message at (triggers rethink from that point)
            on_page_context: Optional context from the user's screen
            artifact_key: Optional key for a new artifact to generate in this step
            artifact_schema: Optional Pydantic model for the new artifact (required if artifact_key is provided)

        Returns:
            int: The run ID (same as input)

        Raises:
            SeerApiError: If the Seer API request fails
            ValueError: If artifact_schema is provided without artifact_key
        """
        if bool(artifact_schema) != bool(artifact_key):
            raise ValueError("artifact_key and artifact_schema must be provided together")

        agent_run_options: dict[str, Any] = {
            "enable_coding": self.enable_coding,
            "enable_code_mode_tools": self.enable_code_mode_tools,
            "code_review_enabled": self.code_review_enabled,
            "enable_pr_context_tools": self.enable_pr_context_tools,
        }

        chat_body: AgentChatRequest = AgentChatRequest(
            organization_id=self.organization.id,
            query=prompt,
            run_id=run_id,
            insert_index=insert_index,
            on_page_context=on_page_context,
            page_name=page_name,
            is_interactive=self.is_interactive,
            agent_run_options=agent_run_options,
            proxy_headers=get_proxy_headers() if self.enable_code_mode_tools != "off" else None,
        )

        if prompt_metadata:
            chat_body["query_metadata"] = prompt_metadata

        # Add artifact key and schema if provided
        if artifact_key and artifact_schema:
            chat_body["artifact_key"] = artifact_key
            chat_body["artifact_schema"] = artifact_schema.schema()

        if ui_tools:
            chat_body["ui_tools"] = ui_tools

        # Add connected and available monitoring providers for runs with user context.
        if self.user and not isinstance(self.user, AnonymousUser):
            monitoring_provider_connections = get_monitoring_provider_connections(
                self.organization, self.user.id
            )
            if monitoring_provider_connections:
                chat_body["monitoring_providers"] = monitoring_provider_connections

            available_monitoring_providers = get_available_monitoring_providers(
                self.organization,
                self.user.id,
            )
            if available_monitoring_providers:
                chat_body["available_monitoring_providers"] = available_monitoring_providers

        # No random rollout here — Seer ANDs this with the persisted value from start_run,
        # so the start_run coin flip is the single source of truth.
        if _has_context_engine(self.organization, self.user):
            agent_run_options["is_context_engine_enabled"] = True

        if features.has(
            "organizations:seer-agent-source-code-search",
            self.organization,
            actor=self.user,
        ):
            agent_run_options["enable_frontend_code_search"] = True

        if features.has(
            "organizations:seer-use-agent-sandbox",
            self.organization,
            actor=self.user,
        ):
            agent_run_options["use_agent_sandbox"] = True

        if features.has(
            "organizations:seer-explorer-thinking-summary",
            self.organization,
            actor=self.user,
        ):
            agent_run_options["enable_tool_summary"] = True

        if self.enable_embeds and features.has(
            "organizations:seer-explorer-embeds",
            self.organization,
            actor=self.user,
        ):
            agent_run_options["embed_widgets"] = get_embed_widgets(self.organization, self.user)

        if features.has(
            "organizations:seer-explorer-stream",
            self.organization,
            actor=self.user,
        ):
            agent_run_options["enable_streaming"] = True

        response = make_agent_chat_request(chat_body, viewer_context=self.viewer_context)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        result = response.json()

        SeerRun.objects.filter(seer_run_state_id=run_id).update(last_triggered_at=now())

        return result["run_id"]

    def get_run(
        self,
        run_id: int,
        blocking: bool = False,
        poll_interval: float = 2.0,
        poll_timeout: float = 600.0,
    ) -> SeerRunState:
        """
        Get the status/result of a Seer Agent session.

        Args:
            run_id: The run ID returned from start_run()
            blocking: If True, blocks until the run completes (with polling)
            poll_interval: Seconds between polls when blocking=True
            poll_timeout: Maximum seconds to wait when blocking=True

        Returns:
            SeerRunState: State object with blocks, status, and reconstructed artifacts.

        Raises:
            SeerApiError: If the Seer API request fails
            TimeoutError: If polling exceeds poll_timeout when blocking=True
        """
        if blocking:
            state = poll_until_done(
                run_id,
                self.organization,
                poll_interval,
                poll_timeout,
                viewer_context=self.viewer_context,
            )
        else:
            state = fetch_run_status(run_id, self.organization, viewer_context=self.viewer_context)

        return state

    @overload
    def get_runs(
        self,
        category_key: str | None = ...,
        category_value: str | None = ...,
        offset: int | None = ...,
        limit: int | None = ...,
        project_ids: list[int] | None = ...,
        expand: Literal["prs"] = ...,
        only_current_user: bool = ...,
        start: datetime | None = ...,
        end: datetime | None = ...,
        query: str | None = ...,
    ) -> list[AgentRunWithPrs]: ...

    @overload
    def get_runs(
        self,
        category_key: str | None = ...,
        category_value: str | None = ...,
        offset: int | None = ...,
        limit: int | None = ...,
        project_ids: list[int] | None = ...,
        expand: None = ...,
        only_current_user: bool = ...,
        start: datetime | None = ...,
        end: datetime | None = ...,
        query: str | None = ...,
    ) -> list[AgentRun]: ...

    def get_runs(
        self,
        category_key: str | None = None,
        category_value: str | None = None,
        offset: int | None = None,
        limit: int | None = None,
        project_ids: list[int] | None = None,
        expand: Literal["prs"] | None = None,
        only_current_user: bool = True,
        start: datetime | None = None,
        end: datetime | None = None,
        query: str | None = None,
    ) -> list[AgentRunWithPrs] | list[AgentRun]:
        """
        Get a list of Seer Agent runs for the organization with optional filters.

        Args:
            category_key: Optional category key to filter by (e.g., "bug-fixer")
            category_value: Optional category value to filter by (e.g., "issue-123")
            offset: Optional offset for pagination
            limit: Optional limit for pagination
            expand: Optional string to include additional fields
            only_current_user: Optional to filter runs by current user

        Returns:
            List of runs matching the filters, sorted by most recent first.
            Returns AgentRunWithPrs when expand="prs", AgentRun otherwise.

        Raises:
            SeerApiError: If the Seer API request fails
        """
        runs_body: AgentRunsRequest = AgentRunsRequest(
            organization_id=self.organization.id,
        )

        # Add optional filters
        if (
            only_current_user
            and self.user
            and hasattr(self.user, "id")
            and self.user.id is not None
        ):
            runs_body["user_id"] = int(self.user.id)
        if category_key is not None:
            runs_body["category_key"] = category_key
        if category_value is not None:
            runs_body["category_value"] = category_value
        if offset is not None:
            runs_body["offset"] = offset
        if project_ids is not None:
            runs_body["project_ids"] = project_ids
        if limit is not None:
            runs_body["limit"] = limit
        if expand is not None:
            runs_body["expand"] = expand
        if start is not None:
            runs_body["start"] = start
        if end is not None:
            runs_body["end"] = end
        if query is not None:
            runs_body["query"] = query

        response = make_agent_runs_request(runs_body, viewer_context=self.viewer_context)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        result = response.json()

        Model = AgentRunWithPrs if expand == "prs" else AgentRun
        runs = [Model(**run) for run in result.get("data", [])]
        return runs

    def get_repos(self, run_id: int) -> BaseHTTPResponse:
        body = AgentReposRequest(
            run_id=run_id,
            organization_id=self.organization.id,
        )
        return make_agent_repos_request(body, viewer_context=self.viewer_context)

    def push_changes(
        self,
        run_id: int,
        repo_name: str | None = None,
        blocking: bool = True,
        pr_description_suffix: str | None = None,
        ready_for_review: bool = True,
        poll_interval: float = 2.0,
        poll_timeout: float = 120.0,
    ) -> SeerRunState | None:
        """
        Push code changes to PR(s) and wait for completion.

        Creates new PRs or updates existing ones with current file patches.
        Polls until all PR operations complete.

        Args:
            run_id: The run ID
            repo_name: Specific repo to push, or None for all repos with changes
            poll_interval: Seconds between polls
            poll_timeout: Maximum seconds to wait

        Returns:
            SeerRunState: Final state with PR info

        Raises:
            TimeoutError: If polling exceeds timeout
            SeerApiError: If the Seer API request fails
            SeerPermissionError: If code generation is disabled for the organization
        """
        if not self.organization.get_option(
            "sentry:enable_seer_coding", default=ENABLE_SEER_CODING_DEFAULT
        ):
            raise SeerPermissionError("Code generation is disabled for this organization")

        # Trigger PR creation
        payload: dict[str, Any] = {
            "type": "create_pr",
            "ready_for_review": ready_for_review,
            # Include an idempotency key in the request so that if
            # the request is retried by anything, it will not create duplicate PRs
            # This is regenerated per attempt to permit retries.
            "idempotency_key": uuid.uuid4().hex,
        }
        if repo_name:
            payload["repo_name"] = repo_name
        if pr_description_suffix:
            payload["pr_description_suffix"] = pr_description_suffix
        if self.on_completion_hook:
            payload["on_completion_hook"] = extract_hook_definition(self.on_completion_hook).dict()
        update_body = AgentUpdateRequest(
            run_id=run_id,
            organization_id=self.organization.id,
            payload=payload,
        )
        response = make_agent_update_request(update_body, viewer_context=self.viewer_context)
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        if not blocking:
            return None

        # Poll until PR creation completes
        start_time = time.time()

        while True:
            state = fetch_run_status(run_id, self.organization, viewer_context=self.viewer_context)

            # Check if any PRs are still being created
            any_creating = any(
                pr.pr_creation_status == "creating" for pr in state.repo_pr_states.values()
            )

            if not any_creating:
                return state

            if time.time() - start_time > poll_timeout:
                raise TimeoutError(f"PR creation timed out after {poll_timeout}s")

            time.sleep(poll_interval)

    def launch_coding_agents(
        self,
        run_id: int,
        integration_id: int | None,
        prompt: str,
        repos: list[SeerRepoDefinition],
        branch_name_base: str = "seer",
        auto_create_pr: bool = False,
        provider: str | None = None,
        user_id: int | None = None,
        issue_short_id: str | None = None,
        issue_url: str | None = None,
    ) -> dict[str, list]:
        """
        Launch coding agents for an agent run.

        This triggers coding agents (e.g., Cursor) to work on code changes.
        The caller provides the prompt and target repos.

        Args:
            run_id: The agent run ID (used to store coding agent state)
            integration_id: The coding agent integration ID (for org-installed integrations)
            prompt: The instruction/prompt for the coding agent
            repos: List of SeerRepoDefinition objects with full repo metadata
            branch_name_base: Base name for the branch (random suffix will be added)
            auto_create_pr: Whether to automatically create a PR when agent finishes
            provider: The coding agent provider (e.g., 'github_copilot') - alternative to integration_id
            user_id: The user ID (required for user-authenticated providers like GitHub Copilot)
            issue_short_id: Optional Sentry issue short ID for coding agent session naming
            issue_url: Optional full URL to the Sentry issue for linking in PRs

        Returns:
            Dictionary with 'successes' and 'failures' lists
        """
        return launch_coding_agents(
            organization=self.organization,
            integration_id=integration_id,
            run_id=run_id,
            prompt=prompt,
            repos=repos,
            branch_name_base=branch_name_base,
            auto_create_pr=auto_create_pr,
            provider=provider,
            user_id=user_id,
            issue_short_id=issue_short_id,
            issue_url=issue_url,
        )
