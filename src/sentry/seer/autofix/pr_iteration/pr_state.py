"""Read the live state of the pull requests an Autofix run opened.

Closing a PR is how someone tells Seer to stop working on it. Both ends of an
iteration ask here: the consume task before it spends an agent run, and the
completion hook before it pushes what that run produced.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal

from scm import actions as scm_actions
from scm.types import GetPullRequestProtocol, PullRequest

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.constants import PR_ITERATION_PROVIDER_SLUG
from sentry.utils import metrics

PR_CLOSED_METRIC = "autofix.pr_iteration.pr_closed"

# Where we caught it: before the agent run, or before the push. The only tag on
# the metric, and closed so it stays two time series.
PrClosedGate = Literal["consume", "push"]


def record_pr_closed(gate: PrClosedGate) -> None:
    metrics.incr(PR_CLOSED_METRIC, tags={"gate": gate})


def _live_pull_requests(
    organization_id: int, state: SeerRunState
) -> Iterator[tuple[RepoPRState, PullRequest]]:
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

        yield pr_state, pull_request["data"]


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
        for _, pull_request in _live_pull_requests(organization.id, state)
    )


def iteration_prs_any_external_head(organization_id: int, state: SeerRunState) -> bool:
    """True when any PR on the run has a head commit Seer didn't push.

    Like a closed PR, one is enough: an iteration pushes to every repo at once.
    A PR we cannot read is passed over, since the push itself still refuses to
    overwrite commits it didn't make.
    """
    for pr_state, pull_request in _live_pull_requests(organization_id, state):
        head_sha = pull_request["head"]["sha"]
        if head_sha and pr_state.commit_sha and head_sha != pr_state.commit_sha:
            return True
    return False
