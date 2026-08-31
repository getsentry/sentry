"""Refuse to iterate on a Seer PR when the GitHub App can't do the work.

PR iteration reads CI logs and pushes commits through the org's GitHub App
installation. When that installation is missing a permission the app now
requires, every one of those tool calls fails and the run goes quiet with no
explanation on the PR. The same missing-permission state already drives the
out-of-date banner in the integrations UI; this checks it again the moment
feedback lands in the queue and, when something is missing, queues one comment
telling the user what to accept instead of scheduling the iteration.

Only the lookup is inline, because the gate's answer decides whether to
schedule. The comment itself is a task: its GitHub call would otherwise run
inside a webhook task's processing deadline and inside the synchronous autofix
endpoint, and it holds a lock across that call. The task retries on
``UnableToAcquireLock`` rather than waiting, so a losing activation requeues
instead of parking a worker.

The check runs at queue time rather than consume time so the comment lands
while the user is still looking at the failing PR: a consume can be deferred
an hour behind an incomplete check-run sweep, and a notice that late is worse
than useless. Queue time is also the *only* place this is checked — consume
and the on-completion hook deliberately trust that whatever scheduled them
passed through here first, rather than paying for the lookup again.

Dedupe is a ``SeerRun.extras`` marker keyed by repo full name rather than a
GitHub search for our own comment, so repeated failing check suites cost no
extra API calls. The marker is sticky per run+repo: once the user has been
told, later iterations on the same run stay silent until the permissions are
accepted (at which point the check passes and no marker is consulted).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from django.utils import timezone

from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.github_perms import (
    MissingGithubPermissions,
    get_github_missing_permissions,
    get_missing_permissions_by_repo,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

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


def _comment_body(url: str) -> str:
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
    log_ctx: PrIterationLogContext,
    log_fields: dict[str, Any],
) -> bool:
    scopes_tag = _scopes_tag(info.missing_scopes)
    url = info.installation_url
    if url is None:
        # Org-owned installs need the account login to build the path; without
        # it the link would 404, and a comment with a dead link is worse than
        # none. The blocked-iteration log still records that we stopped.
        log_ctx.error(
            "autofix.pr_iteration.missing_permissions.no_installation_url",
            exc_info=False,
            account_type=info.integration.metadata.get("account_type"),
            **log_fields,
        )
        return False
    try:
        client = info.integration.get_installation(organization_id=organization.id).get_client()
        client.create_comment(repo_name, str(pr_number), {"body": _comment_body(url)})
    except Exception:
        metrics.incr(
            "autofix.pr_iteration.missing_permissions.comment_failed",
            tags={"missing_scopes": scopes_tag},
        )
        log_ctx.error("autofix.pr_iteration.missing_permissions.comment_failed", **log_fields)
        return False
    return True


def get_blocking_permissions(
    *, organization: Organization, state: SeerRunState, log_ctx: PrIterationLogContext
) -> dict[str, MissingGithubPermissions]:
    """Missing-permission info per repo, empty when nothing blocks the iteration.

    Fails open: a lookup error here leaves iteration alone rather than
    silently stopping a run that might have worked.
    """
    try:
        missing_by_repo = repos_missing_permissions(organization, state)
    except Exception:
        log_ctx.error("autofix.pr_iteration.missing_permissions.check_failed")
        return {}

    if not missing_by_repo:
        return {}

    metrics.incr(
        "autofix.pr_iteration.missing_permissions.blocked",
        tags={
            "missing_scopes": _scopes_tag(
                scope for info in missing_by_repo.values() for scope in info.missing_scopes
            )
        },
    )
    log_ctx.info(
        "autofix.pr_iteration.missing_permissions.blocked",
        repo_ids=sorted(
            info.repository_id for info in missing_by_repo.values() if info.repository_id
        ),
    )
    return missing_by_repo


def _skip(log_ctx: PrIterationLogContext, reason: str, **log_fields: Any) -> None:
    log_ctx.info("autofix.pr_iteration.missing_permissions.skipped", reason=reason, **log_fields)


def block_iteration_for_missing_permissions(
    *,
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    log_ctx: PrIterationLogContext,
) -> bool:
    """True when the iteration should not run because the GitHub App is missing
    permissions. Queues one comment per affected PR the first time we hit this.
    """
    missing_by_repo = get_blocking_permissions(
        organization=organization, state=state, log_ctx=log_ctx
    )
    if not missing_by_repo:
        return False

    _queue_missing_permissions_comments(
        organization=organization,
        run_id=run_id,
        state=state,
        missing_by_repo=missing_by_repo,
        log_ctx=log_ctx,
    )
    return True


def _queue_missing_permissions_comments(
    *,
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    missing_by_repo: dict[str, MissingGithubPermissions],
    log_ctx: PrIterationLogContext,
) -> None:
    from sentry.tasks.seer.pr_iteration import comment_on_missing_permissions

    seer_run = SeerRun.objects.filter(seer_run_state_id=run_id, organization=organization).first()
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have no row to dedupe
        # against; staying silent beats commenting on every failing suite.
        _skip(log_ctx, "no_seer_run")
        return

    for repo_name, info in missing_by_repo.items():
        pr_state = state.repo_pr_states.get(repo_name)
        if pr_state is None or pr_state.pr_number is None:
            continue

        # Cheap pre-check so the steady state never enqueues: the task
        # re-checks under its lock, which is what actually dedupes.
        if get_missing_permissions_marker(seer_run, repo_name) is not None:
            continue

        comment_on_missing_permissions.delay(
            run_id=run_id,
            organization_id=organization.id,
            repo_name=repo_name,
            pr_number=pr_state.pr_number,
            pr_id=pr_state.pr_id,
            integration_id=info.integration.id,
        )


def post_missing_permissions_comment(
    *,
    organization: Organization,
    run_id: int,
    repo_name: str,
    pr_number: int,
    pr_id: int | None,
    integration_id: int,
    log_ctx: PrIterationLogContext,
) -> None:
    """Post the single "accept these permissions" comment for a run+repo.

    Runs in a task so the GitHub call stays off the request and check-suite
    paths that decide the gate. Propagates ``UnableToAcquireLock`` so the task
    retries with backoff rather than parking a worker on a blocking acquire.

    Exhausting those retries is the only way a user never hears about the
    missing permissions, and taskworker already reports it: this taskname with
    ``status:failure`` on ``taskworker.worker.execute_task``.
    """
    log_fields: dict[str, Any] = {
        "integration_id": integration_id,
        "scm_repo_full_name": repo_name,
        "pr_id": pr_id,
    }
    seer_run = SeerRun.objects.filter(seer_run_state_id=run_id, organization=organization).first()
    if seer_run is None:
        _skip(log_ctx, "no_seer_run", **log_fields)
        return

    if get_missing_permissions_marker(seer_run, repo_name) is not None:
        _skip(log_ctx, "already_commented", **log_fields)
        return

    info = get_github_missing_permissions(integration_id)
    if info is None or not info.missing_scopes:
        # Accepted between the gate and this task: nothing left to ask for.
        _skip(log_ctx, "permissions_resolved", **log_fields)
        return

    lock = locks.get(
        f"autofix:pr_iteration:missing_permissions:{seer_run.id}:{repo_name}",
        duration=30,
        name="autofix_pr_missing_permissions",
    )
    with lock.acquire():
        try:
            seer_run.refresh_from_db()
        except SeerRun.DoesNotExist:
            _skip(log_ctx, "run_deleted", **log_fields)
            return

        # The race the lock exists for: another activation commented while we
        # were queued.
        if get_missing_permissions_marker(seer_run, repo_name) is not None:
            _skip(log_ctx, "raced", **log_fields)
            return

        if not _post_comment(organization, repo_name, pr_number, info, log_ctx, log_fields):
            return

        record_missing_permissions_marker(
            seer_run,
            repo_name,
            missing_scopes=info.missing_scopes,
            pr_id=pr_id,
        )

    metrics.incr(
        "autofix.pr_iteration.missing_permissions.commented",
        tags={"missing_scopes": _scopes_tag(info.missing_scopes)},
    )
    log_ctx.info(
        "autofix.pr_iteration.missing_permissions.commented",
        missing_scopes=info.missing_scopes,
        **log_fields,
    )
