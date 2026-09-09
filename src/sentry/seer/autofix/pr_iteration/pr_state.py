"""Read the live state of the pull requests an Autofix run opened.

Closing a PR is how someone tells Seer to stop working on it. Both ends of an
iteration ask here: the consume task before it spends an agent run, and the
completion hook before it pushes what that run produced.
"""

from __future__ import annotations

from scm import actions as scm_actions
from scm.types import GetPullRequestProtocol

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import SeerRunState


def iteration_prs_any_closed(organization: Organization, state: SeerRunState) -> bool:
    """True when any PR on the run reads back as closed.

    One closed PR stops the whole run: an iteration pushes to every repo at
    once, so there is no way to serve the open PRs while leaving the closed one
    alone.

    A PR we cannot read (no number, repo gone, unsupported provider, API error)
    is passed over: a transient read failure should not silently drop an
    iteration's work.
    """
    for repo_name, pr_state in state.repo_pr_states.items():
        pr_number = pr_state.pr_number
        if pr_number is None:
            continue

        repo, _resolution = Repository.objects.resolve_active(
            organization_id=organization.id,
            name=repo_name,
            normalized_provider=None,
        )
        if repo is None:
            continue

        try:
            scm = make_scm(organization.id, repo.id, referrer="seer")
        except Exception:
            continue

        if not isinstance(scm, GetPullRequestProtocol):
            continue

        try:
            pull_request = scm_actions.get_pull_request(scm, str(pr_number))
        except Exception:
            continue

        if pull_request["data"]["state"] == "closed":
            return True

    return False
