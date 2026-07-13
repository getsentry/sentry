from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.utils.github_permissions import get_missing_github_app_permissions
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import SEER_GITHUB_PROVIDERS
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import MemoryBlock, SeerRunState, ToolCall

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MissingGithubPermissions:
    integration: RpcIntegration
    # Empty when the installation has every required permission.
    missing_scopes: list[str]

    @property
    def installation_id(self) -> str:
        """GitHub App installation id (Integration.external_id)."""
        return str(self.integration.external_id)


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


def blocks_have_failed_tool_call(blocks: Iterable[MemoryBlock]) -> bool:
    """True if any tool call in the given blocks errored (ToolLink.params[is_error])."""
    for block in blocks:
        for link in block.tool_links or []:
            if link is not None and link.params.get(_TOOL_ERROR_KEY) is True:
                return True
    return False


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


def _repo_name_from_tool_call(call: ToolCall) -> str | None:
    """The repo a tool call targeted, from its `repo_name` arg (None if absent)."""
    try:
        args = json.loads(call.args)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(args, dict):
        return None

    repo_name = args.get("repo_name")
    return repo_name if isinstance(repo_name, str) and repo_name else None


def repos_with_failed_tool_calls(blocks: Iterable[MemoryBlock]) -> set[str]:
    """Repo names that a failed tool call in the given blocks was made against.

    Answers: "the tool calls that failed were made against what repo?"

    Limitation: a failure is only attributed to a repo when the tool call carries
    a `repo_name` arg. Errored tool responses drop their metadata (params is just
    {is_error: True}), so we recover the repo from the call args instead — which
    only works for repo-scoped tools. That's fine here: we're building this for
    the PR context tools (summarize_failed_ci_logs, get_pr_*), which all take
    `repo_name` as a required arg. A failed non-repo tool yields no repo.
    """
    repos: set[str] = set()
    for block in blocks:
        for call in _failed_tool_calls(block):
            repo_name = _repo_name_from_tool_call(call)
            if repo_name:
                repos.add(repo_name)
    return repos


def get_out_of_date_github_permissions(
    organization: Organization, blocks: Sequence[MemoryBlock]
) -> dict[str, MissingGithubPermissions]:
    """
    An objective of this function is to only return repos that we know we should
    notify on, since we likely ran into a failure with the github app permissions for that
    repo.

    We don't want to surface out of date github permissions for a repo that we didn't
    fail a tool call on, since we don't want to comment on the PR if we don't have a
    good reason to.

    This is only relevant when it comes to notifying the user that there are out of date
    github app permissions by commenting on the PR.

    Pseudocode:

        repos = {}
        # 1. Which repos did a failed tool call target? (repos_with_failed_tool_calls)
        for block in blocks:
            for call in block.tool_calls:
                if not call.failed:
                    continue
                repo = json.loads(call.args).get("repo_name")

                # all the tools we care about commenting on, have the repo name as an arg
                # so we should only hit this case if the tool call is unrelated to github app
                # perms
                if repo:
                    repos.add(repo)

        if not repos:
            return {}

        # 2. Map those repo names to their GitHub integration (org-scoped, active).
        for (repo, integration_id) in Repository.filter(org, github, active, name in repos):
            # 3. Ask GitHub which required app permissions that install is missing.
            perms = get_github_missing_permissions(integration_id)
            if perms.missing_scopes:
                result[repo] = perms

        return result
    """
    repo_names = repos_with_failed_tool_calls(blocks)
    if not repo_names:
        return {}

    # Org-scoped so a run can only surface permissions for repos in its own org.
    repo_integration_ids = Repository.objects.filter(
        organization_id=organization.id,
        provider__in=SEER_GITHUB_PROVIDERS,
        name__in=repo_names,
        status=ObjectStatus.ACTIVE,
    ).values_list("name", "integration_id")

    missing_by_repo: dict[str, MissingGithubPermissions] = {}
    for repo_name, integration_id in repo_integration_ids:
        if not isinstance(integration_id, int):
            continue

        perms = get_github_missing_permissions(integration_id)
        if perms is not None and perms.missing_scopes:
            missing_by_repo[repo_name] = perms

    return missing_by_repo


def comment_on_out_of_date_github_permissions(
    organization: Organization,
    state: SeerRunState,
    missing_by_repo: Mapping[str, MissingGithubPermissions],
) -> list[str]:
    """Post an issue comment on each repo's PR explaining that the GitHub App
    installation is missing permissions Seer needs, linking the user to accept
    them. Returns the repo names a comment was successfully posted for.
    """
    commented: list[str] = []
    for repo_name, info in missing_by_repo.items():
        pr_state = state.repo_pr_states.get(repo_name)
        if pr_state is None or pr_state.pr_number is None:
            continue

        integration = info.integration
        url = f"https://github.com/settings/installations/{info.installation_id}/permissions/update"
        body = (
            "⚠️ **Seer needs additional GitHub permissions**\n\n"
            "A Seer autofix tool failed because the Sentry GitHub App installation is "
            "missing permissions. For the best experience using Seer, please review and "
            f"accept the updated permissions: {url}"
        )
        try:
            client = integration.get_installation(organization_id=organization.id).get_client()
            client.create_comment(repo_name, str(pr_state.pr_number), {"body": body})
        except Exception:
            logger.exception(
                "autofix.permissions_comment.post_failed",
                extra={"organization_id": organization.id, "repo_name": repo_name},
            )
            continue

        commented.append(repo_name)

    return commented
