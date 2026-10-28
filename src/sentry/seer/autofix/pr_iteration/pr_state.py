"""Read the live state of the pull requests an Autofix run opened.

Closing a PR is how someone tells Seer to stop working on it. Both ends of an
iteration ask here: the consume task before it spends an agent run, and the
completion hook before it pushes what that run produced.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal

from django.utils.text import slugify
from scm import actions as scm_actions
from scm.manager import SourceCodeManager
from scm.types import GetCommitProtocol, GetPullRequestProtocol, PullRequest

from sentry import options
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.constants import PR_ITERATION_PROVIDER_SLUG
from sentry.seer.autofix.pr_iteration.identity import is_ad_hoc_run
from sentry.utils import metrics

PR_CLOSED_METRIC = "autofix.pr_iteration.pr_closed"

# Where we caught it: before the agent run, or before the push. The only tag on
# the metric, and closed so it stays two time series.
PrClosedGate = Literal["consume", "push"]


def record_pr_closed(gate: PrClosedGate) -> None:
    metrics.incr(PR_CLOSED_METRIC, tags={"gate": gate})


def _live_pull_requests(
    organization_id: int, state: SeerRunState
) -> Iterator[tuple[SourceCodeManager, RepoPRState, PullRequest]]:
    """Each PR on the run we can read back, with its live state from SCM.

    A PR we cannot read (no number, repo gone, unsupported provider, API error)
    is passed over.
    """
    for repo_name, pr_state in state.repo_pr_states.items():
        pr_number = pr_state.pr_number
        if pr_number is None:
            continue

        repo, _resolution = Repository.objects.resolve_active(
            organization_id=organization_id,
            name=repo_name,
            normalized_provider=PR_ITERATION_PROVIDER_SLUG,
        )
        if repo is None:
            continue

        try:
            scm = make_scm(organization_id, repo.id, referrer="seer")
        except Exception:
            continue

        if not isinstance(scm, GetPullRequestProtocol):
            continue

        try:
            pull_request = scm_actions.get_pull_request(scm, str(pr_number))
        except Exception:
            continue

        yield scm, pr_state, pull_request["data"]


def iteration_prs_any_closed(organization: Organization, state: SeerRunState) -> bool:
    """True when any PR on the run reads back as closed.

    One closed PR stops the whole run: an iteration pushes to every repo at
    once, so there is no way to serve the open PRs while leaving the closed one
    alone.

    A PR we cannot read is passed over: a transient read failure should not
    silently drop an iteration's work.
    """
    return any(
        pull_request["state"] == "closed"
        for _, _, pull_request in _live_pull_requests(organization.id, state)
    )


def iteration_prs_any_external_head(organization_id: int, state: SeerRunState) -> bool:
    """True when any PR on the run has a head commit Seer didn't push.

    Like a closed PR, one is enough: an iteration pushes to every repo at once.
    A PR we cannot read is passed over, since the push itself still refuses to
    overwrite commits it didn't make.

    Ad-hoc iterations push from their own Seer runs, so this run's recorded
    ``commit_sha`` never sees those pushes. For ad-hoc runs, a head our GitHub
    App committed also counts as Seer's.
    """
    ad_hoc = is_ad_hoc_run(state)
    for scm, pr_state, pull_request in _live_pull_requests(organization_id, state):
        head_sha = pull_request["head"]["sha"]
        if not head_sha or not pr_state.commit_sha or head_sha == pr_state.commit_sha:
            continue
        if ad_hoc and _is_app_commit(scm, head_sha):
            continue
        return True
    return False


def _is_app_commit(scm: SourceCodeManager, sha: str) -> bool:
    """Whether our GitHub App made the commit, as opposed to just naming it as author.

    Any commit carrying the App's noreply email is attributed to the App's login.
    GitHub only signs a commit when it picked the author itself, so a verified
    commit by the App's login came from the App's own credentials.
    """
    if not isinstance(scm, GetCommitProtocol):
        return False
    try:
        commit = scm_actions.get_commit(scm, sha)
    except Exception:
        return False
    app_login = f"{slugify(options.get('github-app.name'))}[bot]"
    verification = commit["raw"]["data"].get("commit", {}).get("verification") or {}
    return commit["data"].get("author_login") == app_login and verification.get("verified") is True
