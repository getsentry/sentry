from __future__ import annotations

import logging
import time
from typing import Any, Literal

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from pydantic import BaseModel

from sentry.models.organization import Organization
from sentry.seer.explorer.client_models import ExplorerRun, SeerRunState
from sentry.seer.explorer.client_utils import (
    collect_user_org_context,
    fetch_run_status,
    has_seer_explorer_access_with_detail,
    poll_until_done,
)
from sentry.seer.explorer.custom_tool_utils import ExplorerTool, extract_tool_schema
from sentry.seer.explorer.on_completion_hook import (
    ExplorerOnCompletionHook,
    extract_hook_definition,
)
from sentry.seer.models import SeerPermissionError
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User

logger = logging.getLogger(__name__)


class SeerExplorerClient:
    """
    A simple client for Seer Explorer, our general debugging agent.

    This provides a class-based interface for Sentry developers to build agentic features
    with full Sentry context.

    Example usage:
    ```python
        from sentry.seer.explorer.client import SeerExplorerClient
        from pydantic import BaseModel

        # SIMPLE USAGE
        client = SeerExplorerClient(organization, user)
        run_id = client.start_run("Analyze trace XYZ and find performance issues")
        state = client.get_run(run_id)

        # WITH ARTIFACTS
        class RootCause(BaseModel):
            cause: str
            confidence: float

        class Solution(BaseModel):
            description: str
            steps: list[str]

        client = SeerExplorerClient(organization, user)

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
        from sentry.seer.explorer.custom_tool_utils import ExplorerTool

        class DeploymentStatusParams(BaseModel):
            environment: str = Field(description="Environment name (e.g., 'production', 'staging')")
            service: str = Field(description="Service name")

        class DeploymentStatusTool(ExplorerTool[DeploymentStatusParams]):
            params_model = DeploymentStatusParams

            @classmethod
            def get_description(cls) -> str:
                return "Check if a service is deployed in an environment"

            @classmethod
            def execute(cls, organization, params: DeploymentStatusParams) -> str:
                return "deployed" if check_deployment(organization, params.environment, params.service) else "not deployed"

        client = SeerExplorerClient(
            organization,
            user,
            custom_tools=[DeploymentStatusTool]
        )
        run_id = client.start_run("Check if payment-service is deployed in production")

        # WITH ON-COMPLETION HOOK
        from sentry.seer.explorer.on_completion_hook import ExplorerOnCompletionHook

        class NotifyOnComplete(ExplorerOnCompletionHook):
            @classmethod
            def execute(cls, organization: Organization, run_id: int) -> None:
                # Called when the agent completes (regardless of status)
                send_notification(organization, f"Explorer run {run_id} completed")

        client = SeerExplorerClient(
            organization,
            user,
            on_completion=NotifyOnComplete
        )
        run_id = client.start_run("Analyze this issue")

        # WITH CODE EDITING AND PR CREATION
        client = SeerExplorerClient(
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
    ```

        Args:
            organization: Sentry organization
            user: User for permission checks and user-specific context (can be User, AnonymousUser, or None)
            category_key: Optional category key for filtering/grouping runs (e.g., "bug-fixer", "trace-analyzer"). Must be provided together with category_value. Makes it easy to retrieve runs for your feature later.
            category_value: Optional category value for filtering/grouping runs (e.g., issue ID, trace ID). Must be provided together with category_key. Makes it easy to retrieve a specific run for your feature later.
            custom_tools: Optional list of `ExplorerTool` classes to make available as tools to the agent. Each tool must inherit from ExplorerTool, define a params_model (Pydantic BaseModel), and implement execute(). Tools are automatically given access to the organization context. Tool classes must be module-level (not nested classes).
            on_completion_hook: Optional `ExplorerOnCompletionHook` class to call when the agent completes. The hook's execute() method receives the organization and run ID. This is called whether or not the agent was successful. Hook classes must be module-level (not nested classes).
            intelligence_level: Optionally set the intelligence level of the agent. Higher intelligence gives better result quality at the cost of significantly higher latency and cost.
            is_interactive: Enable full interactive, human-like features of the agent. Only enable if you support *all* available interactions in Seer. An example use of this is the explorer chat in Sentry UI.
            enable_coding: Enable code editing tools. When disabled, the agent cannot make code changes. Default is False.
    """

    def __init__(
        self,
        organization: Organization,
        user: User | AnonymousUser | None = None,
        category_key: str | None = None,
        category_value: str | None = None,
        custom_tools: list[type[ExplorerTool[Any]]] | None = None,
        on_completion_hook: type[ExplorerOnCompletionHook] | None = None,
        intelligence_level: Literal["low", "medium", "high"] = "medium",
        is_interactive: bool = False,
        enable_coding: bool = False,
    ):
        self.organization = organization
        self.user = user
        self.custom_tools = custom_tools or []
        self.on_completion_hook = on_completion_hook
        self.intelligence_level = intelligence_level
        self.category_key = category_key
        self.category_value = category_value
        self.is_interactive = is_interactive
        self.enable_coding = enable_coding

        # Validate that category_key and category_value are provided together
        if category_key == "" or category_value == "":
            raise ValueError("category_key and category_value cannot be empty strings")
        if bool(category_key) != bool(category_value):
            raise ValueError("category_key and category_value must be provided together")

        # Validate access on init
        has_access, error = has_seer_explorer_access_with_detail(organization, user)
        if not has_access:
            raise SeerPermissionError(error or "Access denied")

    def start_run(
        self,
        prompt: str,
        on_page_context: str | None = None,
        artifact_key: str | None = None,
        artifact_schema: type[BaseModel] | None = None,
        metadata: dict[str, Any] | None = None,
        conduit_channel_id: str | None = None,
        conduit_url: str | None = None,
    ) -> int:
        """
        Start a new Seer Explorer session.

        Args:
            prompt: The initial task/query for the agent
            on_page_context: Optional context from the user's screen
            artifact_key: Optional key to identify this artifact (required if artifact_schema is provided)
            artifact_schema: Optional Pydantic model to generate a structured artifact
            metadata: Optional metadata to store with the run (e.g., stopping_point, group_id)
            conduit_channel_id: Optional Conduit channel ID for streaming
            conduit_url: Optional Conduit URL for streaming

        Returns:
            int: The run ID that can be used to fetch results or continue the conversation

        Raises:
            requests.HTTPError: If the Seer API request fails
            ValueError: If artifact_schema is provided without artifact_key
        """
        if bool(artifact_schema) != bool(artifact_key):
            raise ValueError("artifact_key and artifact_schema must be provided together")

        path = "/v1/automation/explorer/chat"

        payload: dict[str, Any] = {
            "organization_id": self.organization.id,
            "query": prompt,
            "run_id": None,
            "insert_index": None,
            "on_page_context": on_page_context,
            "user_org_context": collect_user_org_context(self.user, self.organization),
            "intelligence_level": self.intelligence_level,
            "is_interactive": self.is_interactive,
            "enable_coding": self.enable_coding,
        }

        # Add artifact key and schema if provided
        if artifact_key and artifact_schema:
            payload["artifact_key"] = artifact_key
            payload["artifact_schema"] = artifact_schema.schema()

        # Extract and add custom tool definitions
        if self.custom_tools:
            payload["custom_tools"] = [
                extract_tool_schema(tool).dict() for tool in self.custom_tools
            ]

        # Add on-completion hook if provided
        if self.on_completion_hook:
            payload["on_completion_hook"] = extract_hook_definition(self.on_completion_hook).dict()

        if self.category_key and self.category_value:
            payload["category_key"] = self.category_key
            payload["category_value"] = self.category_value

        if metadata:
            payload["metadata"] = metadata

        # Add conduit params for streaming if provided
        if conduit_channel_id and conduit_url:
            payload["conduit_channel_id"] = conduit_channel_id
            payload["conduit_url"] = conduit_url

        body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()
        result = response.json()
        return result["run_id"]

    def continue_run(
        self,
        run_id: int,
        prompt: str,
        insert_index: int | None = None,
        on_page_context: str | None = None,
        artifact_key: str | None = None,
        artifact_schema: type[BaseModel] | None = None,
        conduit_channel_id: str | None = None,
        conduit_url: str | None = None,
    ) -> int:
        """
        Continue an existing Seer Explorer session. This allows you to add follow-up queries to an ongoing conversation.

        Args:
            run_id: The run ID from start_run()
            prompt: The follow-up task/query for the agent
            insert_index: Optional index to insert the message at (triggers rethink from that point)
            on_page_context: Optional context from the user's screen
            artifact_key: Optional key for a new artifact to generate in this step
            artifact_schema: Optional Pydantic model for the new artifact (required if artifact_key is provided)
            conduit_channel_id: Optional Conduit channel ID for streaming
            conduit_url: Optional Conduit URL for streaming

        Returns:
            int: The run ID (same as input)

        Raises:
            requests.HTTPError: If the Seer API request fails
            ValueError: If artifact_schema is provided without artifact_key
        """
        if bool(artifact_schema) != bool(artifact_key):
            raise ValueError("artifact_key and artifact_schema must be provided together")

        path = "/v1/automation/explorer/chat"

        payload: dict[str, Any] = {
            "organization_id": self.organization.id,
            "query": prompt,
            "run_id": run_id,
            "insert_index": insert_index,
            "on_page_context": on_page_context,
            "is_interactive": self.is_interactive,
            "enable_coding": self.enable_coding,
        }

        # Add artifact key and schema if provided
        if artifact_key and artifact_schema:
            payload["artifact_key"] = artifact_key
            payload["artifact_schema"] = artifact_schema.schema()

        # Add conduit params for streaming if provided
        if conduit_channel_id and conduit_url:
            payload["conduit_channel_id"] = conduit_channel_id
            payload["conduit_url"] = conduit_url

        body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()
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
        Get the status/result of a Seer Explorer session.

        Args:
            run_id: The run ID returned from start_run()
            blocking: If True, blocks until the run completes (with polling)
            poll_interval: Seconds between polls when blocking=True
            poll_timeout: Maximum seconds to wait when blocking=True

        Returns:
            SeerRunState: State object with blocks, status, and reconstructed artifacts.

        Raises:
            requests.HTTPError: If the Seer API request fails
            TimeoutError: If polling exceeds poll_timeout when blocking=True
        """
        if blocking:
            state = poll_until_done(run_id, self.organization, poll_interval, poll_timeout)
        else:
            state = fetch_run_status(run_id, self.organization)

        return state

    def get_runs(
        self,
        category_key: str | None = None,
        category_value: str | None = None,
        offset: int | None = None,
        limit: int | None = None,
    ) -> list[ExplorerRun]:
        """
        Get a list of Seer Explorer runs for the organization with optional filters.

        This function supports flexible filtering by user_id (from client), category_key,
        or category_value. At least one filter should be provided to avoid returning all runs.

        Args:
            category_key: Optional category key to filter by (e.g., "bug-fixer")
            category_value: Optional category value to filter by (e.g., "issue-123")
            offset: Optional offset for pagination
            limit: Optional limit for pagination

        Returns:
            list[ExplorerRun]: List of runs matching the filters, sorted by most recent first

        Raises:
            requests.HTTPError: If the Seer API request fails
        """
        path = "/v1/automation/explorer/runs"

        payload: dict[str, Any] = {
            "organization_id": self.organization.id,
        }

        # Add optional filters
        if self.user and hasattr(self.user, "id"):
            payload["user_id"] = self.user.id
        if category_key is not None:
            payload["category_key"] = category_key
        if category_value is not None:
            payload["category_value"] = category_value
        if offset is not None:
            payload["offset"] = offset
        if limit is not None:
            payload["limit"] = limit

        body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()
        result = response.json()

        runs = [ExplorerRun(**run) for run in result.get("data", [])]
        return runs

    def push_changes(
        self,
        run_id: int,
        repo_name: str | None = None,
        poll_interval: float = 2.0,
        poll_timeout: float = 120.0,
    ) -> SeerRunState:
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
            requests.HTTPError: If the Seer API request fails
        """
        # Trigger PR creation
        path = "/v1/automation/explorer/update"
        payload = {
            "run_id": run_id,
            "payload": {
                "type": "create_pr",
                "repo_name": repo_name,
            },
        }
        body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )
        response.raise_for_status()

        # Poll until PR creation completes
        start_time = time.time()

        while True:
            state = fetch_run_status(run_id, self.organization)

            # Check if any PRs are still being created
            any_creating = any(
                pr.pr_creation_status == "creating" for pr in state.repo_pr_states.values()
            )

            if not any_creating:
                return state

            if time.time() - start_time > poll_timeout:
                raise TimeoutError(f"PR creation timed out after {poll_timeout}s")

            time.sleep(poll_interval)
