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


def iteration_prs_all_closed(organization: Organization, state: SeerRunState) -> bool:
    """True when the run has PRs and every one of them reads back as closed.

    A PR we cannot read (no number, repo gone, unsupported provider, API error)
    counts as open: a transient read failure should not silently drop an
    iteration's work.
    """
    checked_any = False

    for repo_name, pr_state in state.repo_pr_states.items():
        pr_number = pr_state.pr_number
        if pr_number is None:
            return False

        repo, _resolution = Repository.objects.resolve_active(
            organization_id=organization.id,
            name=repo_name,
            normalized_provider=None,
        )
        if repo is None:
            return False

        try:
            scm = make_scm(organization.id, repo.id, referrer="seer")
        except Exception:
            return False

        if not isinstance(scm, GetPullRequestProtocol):
            return False

        try:
            pull_request = scm_actions.get_pull_request(scm, str(pr_number))
        except Exception:
            return False

        if pull_request["data"]["state"] != "closed":
            return False

        checked_any = True

    return checked_any
