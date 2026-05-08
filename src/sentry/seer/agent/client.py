from __future__ import annotations

import logging
import random
import time
from datetime import datetime
from typing import Any, Literal, overload

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone as django_timezone
from pydantic import BaseModel
from rest_framework.request import Request

from sentry import features, options
from sentry.constants import ENABLE_SEER_CODING_DEFAULT, ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client_models import AgentRun, AgentRunWithPrs, SeerRunState
from sentry.seer.agent.client_utils import (
    AgentChatRequest,
    AgentRunsRequest,
    AgentUpdateRequest,
    collect_user_org_context,
    fetch_run_status,
    get_proxy_headers,
    make_agent_chat_request,
    make_agent_runs_request,
    make_agent_update_request,
    poll_until_done,
)
from sentry.seer.agent.coding_agent_handoff import launch_coding_agents
from sentry.seer.agent.custom_tool_utils import AgentTool, extract_tool_schema
from sentry.seer.agent.on_completion_hook import (
    AgentOnCompletionHook,
    extract_hook_definition,
)
from sentry.seer.models import SeerApiError, SeerPermissionError, SeerRepoDefinition
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.seer.context_engine_index import build_service_map, index_org_project_knowledge
from sentry.tasks.seer.explorer_index import dispatch_explorer_index_projects
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)


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
        run_id = client.start_run("Analyze trace XYZ and find performance issues")
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
        )
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
        run_id = client.start_run("Check if payment-service is deployed in production")

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
        run_id = client.start_run("Analyze this issue")

        # WITH CODE EDITING AND PR CREATION
        client = SeerAgentClient(
            organization,
            user,
            enable_coding=True,  # Enable code editing tools
        )

        run_id = client.start_run("Fix the null pointer exception in auth.py")
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
        run_id = client.start_run("Analyze the authentication bug")
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
            category_key: Optional category key for filtering/grouping runs (e.g., "bug-fixer", "trace-analyzer"). Must be provided together with category_value. Makes it easy to retrieve runs for your feature later.
            category_value: Optional category value for filtering/grouping runs (e.g., issue ID, trace ID). Must be provided together with category_key. Makes it easy to retrieve a specific run for your feature later.
            custom_tools: Optional list of `AgentTool` classes to make available as tools to the agent. Each tool must inherit from AgentTool, define a params_model (Pydantic BaseModel), and implement execute(). Tools are automatically given access to the organization context. Tool classes must be module-level (not nested classes).
            on_completion_hook: Optional `AgentOnCompletionHook` class to call when the agent completes. The hook's execute() method receives the organization and run ID. This is called whether or not the agent was successful. Hook classes must be module-level (not nested classes).
            intelligence_level: Optionally set the intelligence level of the agent. Higher intelligence gives better result quality at the cost of significantly higher latency and cost.
            is_interactive: Enable full interactive, human-like features of the agent. Only enable if you support *all* available interactions in Seer. An example use of this is the explorer chat in Sentry UI.
            enable_coding: Include code editing tools. When False, the agent cannot make code changes. Default is False. If enable_coding is True and the organization does not have the enable_seer_coding option, a SeerPermissionError will be raised.
            max_iterations: Optional maximum number of agent iterations. Useful for lightweight/fast runs that don't need full exploration depth.
    """

    def __init__(
        self,
        organization: Organization,
        user: User | RpcUser | AnonymousUser | None = None,
        project: Project | None = None,
        category_key: str | None = None,
        category_value: str | None = None,
        custom_tools: list[type[AgentTool[Any]]] | None = None,
        on_completion_hook: type[AgentOnCompletionHook] | None = None,
        intelligence_level: Literal["low", "medium", "high"] = "medium",
        reasoning_effort: Literal["low", "medium", "high"] | None = None,
        is_interactive: bool = False,
        enable_coding: bool = False,
        enable_code_mode_tools: str = "off",
        max_iterations: int | None = None,
    ):
        self.organization = organization
        self.user = user
        self.project = project
        self.custom_tools = custom_tools or []
        self.on_completion_hook = on_completion_hook
        self.intelligence_level = intelligence_level
        self.reasoning_effort = reasoning_effort
        self.category_key = category_key
        self.category_value = category_value
        self.is_interactive = is_interactive
        self.enable_code_mode_tools = enable_code_mode_tools
        self.max_iterations = max_iterations

        if enable_coding and not organization.get_option("sentry:enable_seer_coding", True):
            raise SeerPermissionError("Seer coding is not enabled for this organization")

        self.enable_coding = enable_coding

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
    ) -> int:
        """
        Start a new Seer Agent session.

        Args:
            prompt: The initial task/query for the agent
            on_page_context: Optional context from the user's screen
            artifact_key: Optional key to identify this artifact (required if artifact_schema is provided)
            artifact_schema: Optional Pydantic model to generate a structured artifact
            metadata: Optional metadata to store with the run (e.g., stopping_point, group_id)
            request: Optional rest_framework Request object from endpoints.

        Returns:
            int: The run ID that can be used to fetch results or continue the conversation

        Raises:
            SeerApiError: If the Seer API request fails
            ValueError: If artifact_schema is provided without artifact_key
        """
        if bool(artifact_schema) != bool(artifact_key):
            raise ValueError("artifact_key and artifact_schema must be provided together")

        user_org_context = collect_user_org_context(self.user, self.organization, request=request)

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
            enable_coding=self.enable_coding,
            enable_code_mode_tools=self.enable_code_mode_tools,
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

        if metadata:
            chat_body["metadata"] = metadata

        if ui_tools:
            chat_body["ui_tools"] = ui_tools

        if features.has(
            "organizations:seer-explorer-context-engine", self.organization, actor=self.user
        ):
            if random.random() < options.get("seer.explorer.context-engine-rollout"):
                chat_body["is_context_engine_enabled"] = True

        if features.has(
            "organizations:seer-explorer-context-engine-allow-fe-override",
            self.organization,
            actor=self.user,
        ):
            chat_body["is_context_engine_enabled"] = override_ce_enable

        response = make_agent_chat_request(chat_body, viewer_context=self.viewer_context)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        result = response.json()

        try:
            self._maybe_trigger_explorer_index_for_new_run(
                result.get("has_explorer_index"),
                result.get("has_org_project_context"),
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        return result["run_id"]

    def _maybe_trigger_explorer_index_for_new_run(
        self,
        has_explorer_index: bool | None,
        has_org_project_context: bool | None,
    ) -> None:
        """Trigger explorer indexing for the org if Seer reports missing indexes."""
        if options.get("seer.explorer_index.killswitch.enable"):
            logger.info("seer.explorer_index.killswitch.enable flag enabled, skipping")
            return

        if has_explorer_index is not None and not has_explorer_index:
            projects = list(
                Project.objects.filter(
                    organization_id=self.organization.id,
                    status=ObjectStatus.ACTIVE,
                )
            )

            projects_batch = [
                (p.id, self.organization.id) for p in projects if p.flags.has_transactions
            ]

            if projects_batch:
                for _ in dispatch_explorer_index_projects(
                    iter(projects_batch), django_timezone.now()
                ):
                    pass

        if (
            has_org_project_context is not None
            and not has_org_project_context
            and options.get("explorer.context_engine_indexing.enable")
        ):
            index_org_project_knowledge.apply_async(args=[self.organization.id])
            build_service_map.apply_async(args=[self.organization.id])

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

        chat_body: AgentChatRequest = AgentChatRequest(
            organization_id=self.organization.id,
            query=prompt,
            run_id=run_id,
            insert_index=insert_index,
            on_page_context=on_page_context,
            page_name=page_name,
            is_interactive=self.is_interactive,
            enable_coding=self.enable_coding,
            enable_code_mode_tools=self.enable_code_mode_tools,
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

        # No random rollout here — Seer ANDs this with the persisted value from start_run,
        # so the start_run coin flip is the single source of truth.
        if features.has(
            "organizations:seer-explorer-context-engine",
            self.organization,
            actor=self.user,
        ):
            chat_body["is_context_engine_enabled"] = True

        response = make_agent_chat_request(chat_body, viewer_context=self.viewer_context)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        result = response.json()
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

        response = make_agent_runs_request(runs_body, viewer_context=self.viewer_context)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        result = response.json()

        Model = AgentRunWithPrs if expand == "prs" else AgentRun
        runs = [Model(**run) for run in result.get("data", [])]
        return runs

    def push_changes(
        self,
        run_id: int,
        repo_name: str | None = None,
        blocking: bool = True,
        pr_description_suffix: str | None = None,
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
        payload: dict[str, Any] = {"type": "create_pr"}
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
        )
