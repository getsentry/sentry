from __future__ import annotations

import logging
from collections.abc import Collection, Iterable, Iterator
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.utils.github_permissions import (
    get_github_permissions_update_url,
    get_missing_github_app_permissions,
)
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import SEER_GITHUB_PROVIDERS

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import MemoryBlock, SeerRunState, ToolCall

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MissingGithubPermissions:
    integration: RpcIntegration
    # Empty when the installation has every required permission.
    missing_scopes: list[str]
    # Set when this was resolved from a Repository row, so callers can log an id
    # instead of the repo's full name.
    repository_id: int | None = None

    @property
    def installation_id(self) -> str:
        """GitHub App installation id (Integration.external_id)."""
        return str(self.integration.external_id)

    @property
    def installation_url(self) -> str | None:
        """Page where the user reviews and accepts the installation's updated
        permissions. Org-owned installs live under a different namespace than
        user-owned ones, so this branches on the account type. None when the
        install's account is unknown and the path can't be built."""
        return get_github_permissions_update_url(
            str(self.integration.external_id),
            self.integration.metadata.get("account_type"),
            self.integration.name,
        )


def get_github_missing_permissions(integration_id: int) -> MissingGithubPermissions | None:
    """Required GitHub App permissions the installation for `integration_id` is
    missing. Returns None if the integration no longer exists."""
    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        return None

    missing = get_missing_github_app_permissions(integration.metadata)
    return MissingGithubPermissions(
        integration=integration,
        missing_scopes=[permission["expected"]["scope"] for permission in (missing or [])],
    )


# Key set in a tool result's ToolLink.params when the tool call errored (mirrors
# seer's ERROR_KEY in seer.automation.explorer.models).
_TOOL_ERROR_KEY = "is_error"


def _failed_tool_calls(block: MemoryBlock) -> Iterator[ToolCall]:
    """The ToolCalls in `block` whose execution errored.

    tool_links is index-aligned with tool_results (see seer's explorer_agent),
    and each tool_result carries the id of the tool_call it answered, so a failed
    link at index j maps back to its originating tool_call.
    """
    links = block.tool_links or []
    results = block.tool_results or []
    calls_by_id = {call.id: call for call in (block.message.tool_calls or []) if call.id}
    for i, link in enumerate(links):
        if link is None or link.params.get(_TOOL_ERROR_KEY) is not True:
            continue
        result = results[i] if i < len(results) else None
        if result is None:
            continue
        call = calls_by_id.get(result.tool_call_id)
        if call is not None:
            yield call


def failed_tool_calls(blocks: Iterable[MemoryBlock]) -> list[ToolCall]:
    """Tool calls in ``blocks`` whose matching tool link is marked ``is_error``."""
    calls: list[ToolCall] = []
    for block in blocks:
        calls.extend(_failed_tool_calls(block))
    return calls


def get_blocked_pr_iteration_permissions(
    organization: Organization, state: SeerRunState, *, has_actionable_feedback: bool
) -> dict[str, MissingGithubPermissions]:
    """Repos whose open PR we are refusing to iterate on for missing permissions.

    Deliberately narrow, because the warning tells the user we wanted to fix
    their CI and could not:

    * ``has_actionable_feedback`` — feedback we would have consumed is sitting
      in the run's queue. Without it there is nothing we were going to do, so a
      missing permission is not yet costing the user anything.
    * a repo only counts once its PR exists (``pr_number``); before that there
      is no CI for us to have failed to fix.

    Mirrors what ``block_iteration_for_missing_permissions`` gates on, so the
    warning appears exactly when an iteration is actually blocked.
    """
    if not has_actionable_feedback:
        return {}

    repo_names = [
        repo_name
        for repo_name, pr_state in state.repo_pr_states.items()
        if pr_state.pr_number is not None
    ]
    if not repo_names:
        return {}

    return get_missing_permissions_by_repo(organization, repo_names)


def get_missing_permissions_by_repo(
    organization: Organization, repo_names: Collection[str]
) -> dict[str, MissingGithubPermissions]:
    """Map each of `repo_names` whose GitHub App install is missing a required
    permission to what it is missing. Repos with a complete install, no active
    org-scoped GitHub repository row, or no integration are absent.
    """
    if not repo_names:
        return {}

    # Org-scoped so a run can only surface permissions for repos in its own org.
    repos = (
        Repository.objects.filter(
            organization_id=organization.id,
            provider__in=SEER_GITHUB_PROVIDERS,
            name__in=list(repo_names),
            status=ObjectStatus.ACTIVE,
        )
        .order_by("name", "integration_id")
        .values_list("name", "id", "integration_id")
    )

    missing_by_repo: dict[str, MissingGithubPermissions] = {}
    for repo_name, repository_id, integration_id in repos:
        if not isinstance(integration_id, int):
            continue

        perms = get_github_missing_permissions(integration_id)
        if perms is not None and perms.missing_scopes:
            missing_by_repo[repo_name] = replace(perms, repository_id=repository_id)

    return missing_by_repo
