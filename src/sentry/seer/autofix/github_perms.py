from __future__ import annotations

import logging
from collections.abc import Collection, Iterable, Iterator
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.utils.github_permissions import (
    get_github_permissions_update_url,
    get_missing_github_app_permissions,
    is_permissions_snapshot_stale,
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
    # Required permissions the installation does not hold. Never empty: an
    # install with everything it needs is not reported as missing anything.
    missing_scopes: list[str]
    # The Repository row this was resolved for, so callers can log an id
    # instead of the repo's full name.
    repository_id: int

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
    resolved: set[str] = set()
    for repo_name, repository_id, integration_id in repos:
        resolved.add(repo_name)

        if not isinstance(integration_id, int):
            _warn_unresolved(organization, "no_integration_id", repository_id=repository_id)
            continue

        integration = integration_service.get_integration(integration_id=integration_id)
        if integration is None:
            _warn_unresolved(
                organization,
                "integration_not_found",
                repository_id=repository_id,
                integration_id=integration_id,
            )
            continue

        integration = _with_fresh_permissions(organization, integration, repository_id)
        if integration is None:
            continue

        missing = get_missing_github_app_permissions(integration.metadata)
        missing_scopes = [permission["expected"]["scope"] for permission in (missing or [])]
        if missing_scopes:
            missing_by_repo[repo_name] = MissingGithubPermissions(
                integration=integration, missing_scopes=missing_scopes, repository_id=repository_id
            )

    for repo_name in set(repo_names) - resolved:
        _warn_unresolved(organization, "no_repository_row", scm_repo_full_name=repo_name)

    return missing_by_repo


def _with_fresh_permissions(
    organization: Organization, integration: RpcIntegration, repository_id: int
) -> RpcIntegration | None:
    """`integration` with a permissions snapshot recent enough to judge, or None.

    A snapshot older than the app's permissions change was read against the old
    required set, so it cannot say whether this install is missing anything now.
    Mint a fresh installation token and re-read instead of commenting off it.

    This is self-limiting rather than a per-call cost: the refresh rewrites
    ``last_refresh_at``, so an integration takes this path once and every later
    call short-circuits on the first line.

    None when the refresh fails or the snapshot is still stale afterwards. The
    caller reads that as "nothing missing", which is deliberate -- staying quiet
    beats telling someone to accept permissions we cannot confirm they lack.
    """
    if not is_permissions_snapshot_stale(integration.metadata):
        return integration

    try:
        refreshed = integration_service.refresh_github_permissions(
            integration_id=integration.id, organization_id=organization.id
        )
    except Exception:
        # Minting the token talks to GitHub, so this fails for reasons that have
        # nothing to do with permissions. Treat it as "cannot tell" rather than
        # letting a GitHub blip fail the task that called us.
        refreshed = None

    if refreshed is None or is_permissions_snapshot_stale(refreshed.metadata):
        _warn_unresolved(
            organization,
            "stale_permissions_snapshot",
            repository_id=repository_id,
            integration_id=integration.id,
            refreshed=refreshed is not None,
        )
        return None

    logger.info(
        "autofix.github_perms.permissions_refreshed",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id,
            "repository_id": repository_id,
        },
    )
    return refreshed


def _warn_unresolved(organization: Organization, reason: str, **fields: object) -> None:
    """A repo the run is working in that we cannot check permissions for.

    Warning, not info: the caller silently treats these as "nothing missing", so
    without a log a user never hearing about a permission they need looks
    identical to a healthy install.
    """
    logger.warning(
        "autofix.github_perms.repo_unresolved",
        extra={"organization_id": organization.id, "reason": reason, **fields},
    )
