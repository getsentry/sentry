from __future__ import annotations

import logging
from typing import Any, Literal

import orjson
import requests
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from pydantic import BaseModel, ValidationError

from sentry.models.organization import Organization
from sentry.seer.explorer.client_models import ExplorerRun, SeerRunState
from sentry.seer.explorer.client_utils import (
    collect_user_org_context,
    fetch_run_status,
    has_seer_explorer_access_with_detail,
    poll_until_done,
)
from sentry.seer.explorer.custom_tool_utils import ExplorerTool, extract_tool_schema
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
        class BugAnalysis(BaseModel):
            issue_count: int
            severity: str
            recommendations: list[str]

        client = SeerExplorerClient(organization, user, artifact_schema=BugAnalysis)
        run_id = client.start_run("Analyze recent 500 errors")
        state = client.get_run(run_id, blocking=True)

        # Artifact is automatically reconstructed as BugAnalysis instance at runtime
        if state.artifact:
            artifact = cast(BugAnalysis, state.artifact)
            print(f"Found {artifact.issue_count} issues")

        # WITH CUSTOM TOOLS
        from sentry.seer.explorer.custom_tool_utils import ExplorerTool, ExplorerToolParam, StringType

        class DeploymentStatusTool(ExplorerTool):
            @classmethod
            def get_description(cls):
                return "Check if a service is deployed in an environment"

            @classmethod
            def get_params(cls):
                return [
                    ExplorerToolParam(
                        name="environment",
                        description="Environment name (e.g., 'production', 'staging')",
                        type=StringType(),
                    ),
                    ExplorerToolParam(
                        name="service",
                        description="Service name",
                        type=StringType(),
                    ),
                ]

            @classmethod
            def execute(cls, organization, **kwargs):
                return "deployed" if check_deployment(organization, kwargs["environment"], kwargs["service"]) else "not deployed"

        client = SeerExplorerClient(
            organization,
            user,
            custom_tools=[DeploymentStatusTool]
        )
        run_id = client.start_run("Check if payment-service is deployed in production")
    ```

        Args:
            organization: Sentry organization
            user: User for permission checks and user-specific context (can be User, AnonymousUser, or None)
            category_key: Optional category key for filtering/grouping runs (e.g., "bug-fixer", "trace-analyzer"). Must be provided together with category_value. Makes it easy to retrieve runs for your feature later.
            category_value: Optional category value for filtering/grouping runs (e.g., issue ID, trace ID). Must be provided together with category_key. Makes it easy to retrieve a specific run for your feature later.
            artifact_schema: Optional Pydantic model to generate a structured artifact at the end of the run
            custom_tools: Optional list of `ExplorerTool` objects to make available as tools to the agent. Each tool must inherit from ExplorerTool and implement get_params() and execute(). Tools are automatically given access to the organization context. Tool classes must be module-level (not nested classes).
            intelligence_level: Optionally set the intelligence level of the agent. Higher intelligence gives better result quality at the cost of significantly higher latency and cost.
            is_interactive: Enable full interactive, human-like features of the agent. Only enable if you support *all* available interactions in Seer. An example use of this is the explorer chat in Sentry UI.
    """

    def __init__(
        self,
        organization: Organization,
        user: User | AnonymousUser | None = None,
        category_key: str | None = None,
        category_value: str | None = None,
        artifact_schema: type[BaseModel] | None = None,
        custom_tools: list[type[ExplorerTool]] | None = None,
        intelligence_level: Literal["low", "medium", "high"] = "medium",
        is_interactive: bool = False,
    ):
        self.organization = organization
        self.user = user
        self.artifact_schema = artifact_schema
        self.custom_tools = custom_tools or []
        self.intelligence_level = intelligence_level
        self.category_key = category_key
        self.category_value = category_value
        self.is_interactive = is_interactive

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
    ) -> int:
        """
        Start a new Seer Explorer session.

        Args:
            prompt: The initial task/query for the agent
            on_page_context: Optional context from the user's screen

        Returns:
            int: The run ID that can be used to fetch results or continue the conversation

        Raises:
            requests.HTTPError: If the Seer API request fails
        """
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
        }

        # Add artifact schema if provided
        if self.artifact_schema:
            payload["artifact_schema"] = self.artifact_schema.schema()

        # Extract and add custom tool definitions
        if self.custom_tools:
            payload["custom_tools"] = [
                extract_tool_schema(tool).dict() for tool in self.custom_tools
            ]

        if self.category_key and self.category_value:
            payload["category_key"] = self.category_key
            payload["category_value"] = self.category_value

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
    ) -> int:
        """
        Continue an existing Seer Explorer session. This allows you to add follow-up queries to an ongoing conversation.

        Args:
            run_id: The run ID from start_run()
            prompt: The follow-up task/query for the agent
            insert_index: Optional index to insert the message at
            on_page_context: Optional context from the user's screen

        Returns:
            int: The run ID (same as input)

        Raises:
            requests.HTTPError: If the Seer API request fails
        """
        path = "/v1/automation/explorer/chat"

        payload: dict[str, Any] = {
            "organization_id": self.organization.id,
            "query": prompt,
            "run_id": run_id,
            "insert_index": insert_index,
            "on_page_context": on_page_context,
            "is_interactive": self.is_interactive,
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

        If artifact_schema was provided in the constructor and an artifact was generated,
        it will be automatically reconstructed as a typed Pydantic instance.

        Args:
            run_id: The run ID returned from start_run()
            blocking: If True, blocks until the run completes (with polling)
            poll_interval: Seconds between polls when blocking=True
            poll_timeout: Maximum seconds to wait when blocking=True

        Returns:
            SeerRunState: State object with blocks, status, and optionally reconstructed artifact

        Raises:
            requests.HTTPError: If the Seer API request fails
            TimeoutError: If polling exceeds poll_timeout when blocking=True
        """
        if blocking:
            state = poll_until_done(run_id, self.organization, poll_interval, poll_timeout)
        else:
            state = fetch_run_status(run_id, self.organization)

        # Automatically parse raw_artifact into typed artifact if schema was provided
        if state.raw_artifact and self.artifact_schema:
            try:
                state.artifact = self.artifact_schema.parse_obj(state.raw_artifact)
                state.raw_artifact = None  # clear now that it's not needed
            except ValidationError as e:
                # Log but don't fail - keep artifact as None
                state.artifact = None
                sentry_sdk.capture_exception(e, level="warning")

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
