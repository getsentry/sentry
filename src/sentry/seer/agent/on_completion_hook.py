from __future__ import annotations

import importlib
import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from sentry import options
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.pr_links import link_seer_run_to_pull_request

logger = logging.getLogger(__name__)


class OnCompletionHookDefinition(BaseModel):
    """Definition of an on-completion hook to pass to Seer."""

    module_path: str


class AgentOnCompletionHook(ABC):
    """Base class for the agent on-completion hooks.

    Hooks are called when an agent run completes (regardless of status).

    Example:
        class MyCompletionHook(AgentOnCompletionHook):
            @classmethod
            def execute(cls, organization: Organization, run_id: int) -> None:
                # Do something when the run completes
                notify_user(organization, run_id)

        # Pass to client
        client = SeerAgentClient(
            organization,
            user,
            on_completion_hook=MyCompletionHook
        )
    """

    @classmethod
    @abstractmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        """Execute the hook when the agent completes.

        Args:
            organization: The organization context
            run_id: The ID of the completed run
        """
        ...

    @classmethod
    def get_module_path(cls) -> str:
        """Get the full module path for this hook class."""
        if not hasattr(cls, "__module__") or not hasattr(cls, "__name__"):
            raise ValueError(f"Hook class {cls} must have __module__ and __name__ attributes")
        if not cls.__module__ or not cls.__name__:
            raise ValueError(f"Hook class {cls} has empty __module__ or __name__")
        return f"{cls.__module__}.{cls.__name__}"


def extract_hook_definition(
    hook_class: type[AgentOnCompletionHook],
) -> OnCompletionHookDefinition:
    """Extract hook definition from an AgentOnCompletionHook class."""
    # Enforce module-level classes only (no nested classes)
    if "." in hook_class.__qualname__:
        raise ValueError(
            f"Hook class {hook_class.__name__} must be a module-level class. "
            f"Nested classes are not supported. (qualname: {hook_class.__qualname__})"
        )

    return OnCompletionHookDefinition(module_path=hook_class.get_module_path())


def call_on_completion_hook(
    *,
    module_path: str,
    organization_id: int,
    run_id: int,
    state: dict | None = None,
    allowed_prefixes: tuple[str, ...] = ("sentry.",),
) -> None:
    """Dynamically import and call an on-completion hook class.

    Args:
        module_path: Full module path to the hook class (e.g., "sentry.api.MyHook")
        organization_id: Organization ID to load and pass to the hook
        run_id: The run ID that completed
        state: The completed run's serialized state, if Seer pushed it; lets us
            skip re-querying Seer for PR linking.
        allowed_prefixes: Tuple of allowed module path prefixes for security
    """
    # Only allow imports from approved package prefixes
    if not any(module_path.startswith(prefix) for prefix in allowed_prefixes):
        raise ValueError(
            f"Module path must start with one of {allowed_prefixes}, got: {module_path}"
        )

    # Load the organization
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        raise ValueError(f"Organization with id {organization_id} does not exist")

    _link_run_pull_requests(organization, run_id, state)

    # Split module path and class name
    parts = module_path.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid module path: {module_path}")

    module_name, class_name = parts

    # Import the hook class
    try:
        module = importlib.import_module(module_name)
        hook_class = getattr(module, class_name)
    except (ImportError, AttributeError) as e:
        raise ValueError(f"Could not import {module_path}: {e}")

    # Validate it's an AgentOnCompletionHook subclass
    if not isinstance(hook_class, type) or not issubclass(hook_class, AgentOnCompletionHook):
        raise ValueError(f"{module_path} must be a class that inherits from AgentOnCompletionHook")

    # Execute the hook
    hook_class.execute(organization, run_id)


def _link_run_pull_requests(
    organization: Organization, run_id: int, state: dict | None
) -> None:
    """Record a SeerRunPullRequest for each PR the completed run opened.

    Uses the run state Seer pushed with the hook call; falls back to querying Seer
    when it wasn't provided.
    """
    if options.get("seer.run-pr-link.killswitch.enabled"):
        return

    try:
        run_state = SeerRunState(**state) if state is not None else fetch_run_status(run_id, organization)
    except Exception:
        logger.exception(
            "seer.pr_link.state_unavailable",
            extra={"run_id": run_id, "organization_id": organization.id},
        )
        return

    for pr_state in run_state.repo_pr_states.values():
        if pr_state.pr_number is None:
            continue
        try:
            link_seer_run_to_pull_request(
                organization=organization,
                seer_run_state_id=run_id,
                repo_name=pr_state.repo_name,
                provider=None,
                pr_number=pr_state.pr_number,
            )
        except Exception:
            logger.exception(
                "seer.pr_link.failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
