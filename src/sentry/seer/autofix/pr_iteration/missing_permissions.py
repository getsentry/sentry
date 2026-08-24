"""Refuse to iterate on a Seer PR when the GitHub App can't do the work.

PR iteration reads CI logs and pushes commits through the org's GitHub App
installation. When that installation is missing a permission the app now
requires, every one of those tool calls fails and the run goes quiet with no
explanation on the PR. The same missing-permission state already drives the
out-of-date banner in the integrations UI; this checks it again at the moment
we're about to start an iteration and, when something is missing, posts one
comment telling the user what to accept instead of iterating.

Dedupe is a ``SeerRun.extras`` marker keyed by repo full name rather than a
GitHub search for our own comment, so repeated failing check suites cost no
extra API calls. The marker is sticky per run+repo: once the user has been
told, later iterations on the same run stay silent until the permissions are
accepted (at which point the check passes and no marker is consulted).
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from django.utils import timezone

from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.github_perms import (
    MissingGithubPermissions,
    get_missing_permissions_by_repo,
)
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MISSING_PERMISSIONS_EXTRA = "missing_permissions"


def get_missing_permissions_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, MISSING_PERMISSIONS_EXTRA, repo_name)


def record_missing_permissions_marker(
    seer_run: SeerRun, repo_name: str, *, missing_scopes: list[str], pr_id: int | None
) -> None:
    record_run_marker(
        seer_run,
        MISSING_PERMISSIONS_EXTRA,
        repo_name,
        {
            "commented_at": timezone.now().isoformat(),
            "missing_scopes": missing_scopes,
            "pr_id": pr_id,
        },
    )


def _scopes_tag(missing_scopes: Iterable[str]) -> str:
    """Stable metrics-tag rendering of a set of missing scopes.

    Sorted and deduped so the same set is always one time series, and joined on
    "-" rather than "," because dogstatsd separates tags with commas on the wire.
    """
    return "-".join(sorted(set(missing_scopes))) or "none"


def _comment_body(installation_id: str) -> str:
    url = f"https://github.com/settings/installations/{installation_id}/permissions/update"
    return (
        "⚠️ **Seer needs additional GitHub permissions**\n\n"
        "Seer wants to keep iterating on this pull request to get CI passing, but the "
        "Sentry GitHub App installation is missing permissions it needs to read the failing "
        "checks and push a fix.\n\n"
        f"Review and accept the updated permissions to let Seer continue: {url}"
    )


def repos_missing_permissions(
    organization: Organization, state: SeerRunState
) -> dict[str, MissingGithubPermissions]:
    """Missing-permission info for each repo this run has an open PR in."""
    repo_names = [
        repo_name
        for repo_name, pr_state in state.repo_pr_states.items()
        if pr_state.pr_number is not None
    ]
    return get_missing_permissions_by_repo(organization, repo_names)


def _post_comment(
    organization: Organization,
    repo_name: str,
    pr_number: int,
    info: MissingGithubPermissions,
    log_extra: dict[str, Any],
) -> bool:
    scopes_tag = _scopes_tag(info.missing_scopes)
    try:
        client = info.integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment(
            repo_name, str(pr_number), {"body": _comment_body(info.installation_id)}
        )
    except Exception:
        metrics.incr(
            "autofix.pr_iteration.missing_permissions.comment_failed",
            tags={"missing_scopes": scopes_tag},
        )
        logger.exception(
            "autofix.pr_iteration.missing_permissions.comment_failed",
            extra=log_extra,
        )
        return False
    return True


def block_iteration_for_missing_permissions(
    *, organization: Organization, run_id: int, state: SeerRunState
) -> bool:
    """True when the iteration should not run because the GitHub App is missing
    permissions. Comments on each affected PR the first time we hit this.

    Fails open: a lookup error here leaves iteration alone rather than
    silently stopping a run that might have worked.
    """
    log_extra: dict[str, Any] = {"organization_id": organization.id, "run_id": run_id}
    try:
        missing_by_repo = repos_missing_permissions(organization, state)
    except Exception:
        logger.exception("autofix.pr_iteration.missing_permissions.check_failed", extra=log_extra)
        return False

    if not missing_by_repo:
        return False

    metrics.incr(
        "autofix.pr_iteration.missing_permissions.blocked",
        tags={
            "missing_scopes": _scopes_tag(
                scope for info in missing_by_repo.values() for scope in info.missing_scopes
            )
        },
    )
    logger.info(
        "autofix.pr_iteration.missing_permissions.blocked",
        extra={
            **log_extra,
            "repo_ids": sorted(
                info.repository_id for info in missing_by_repo.values() if info.repository_id
            ),
        },
    )

    seer_run = SeerRun.objects.filter(seer_run_state_id=run_id, organization=organization).first()

    for repo_name, info in missing_by_repo.items():
        pr_state = state.repo_pr_states.get(repo_name)
        if pr_state is None or pr_state.pr_number is None:
            continue
        pr_number = pr_state.pr_number

        repo_log_extra = {
            **log_extra,
            "repo_id": info.repository_id,
            "integration_id": info.integration.id,
            "pr_id": pr_state.pr_id,
        }
        if seer_run is None:
            # Legacy runs predating SeerRun mirroring have no row to dedupe
            # against; staying silent beats commenting on every failing suite.
            logger.info("autofix.pr_iteration.missing_permissions.no_seer_run", extra=log_extra)
            break

        if get_missing_permissions_marker(seer_run, repo_name) is not None:
            continue

        if not _post_comment(organization, repo_name, pr_number, info, repo_log_extra):
            continue

        record_missing_permissions_marker(
            seer_run,
            repo_name,
            missing_scopes=info.missing_scopes,
            pr_id=pr_state.pr_id,
        )
        metrics.incr(
            "autofix.pr_iteration.missing_permissions.commented",
            tags={"missing_scopes": _scopes_tag(info.missing_scopes)},
        )
        logger.info(
            "autofix.pr_iteration.missing_permissions.commented",
            extra={**repo_log_extra, "missing_scopes": info.missing_scopes},
        )

    return True
