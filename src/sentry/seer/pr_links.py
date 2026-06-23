"""Link a Seer run to a pull request it opened.

`SeerRunPullRequest` is the Sentry-side mirror of Seer's own run→PR association
(`DbPrIdToAutofixRunIdMapping`). The link is written from the shared on-completion
hook dispatcher (`call_on_completion_hook`) when a run finishes, reading the
completed run's `repo_pr_states` — so it covers every run that registers a
completion hook regardless of which hook class it uses (autofix, explorer agent,
etc.). A run that opens a PR without registering any completion hook is not
linked; such flows must set a completion hook.

The `PullRequest` find-or-create is keyed on `(organization, repository,
pr_number)`, so it converges on the same canonical row the SCM webhook and
PR-metrics attribution use, never a duplicate.
"""

from __future__ import annotations

import logging

from django.db.models import Q

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.seer.models.run import SeerRun, SeerRunPullRequest

logger = logging.getLogger(__name__)


def _resolve_repository(
    *, organization_id: int, repo_name: str, provider: str | None
) -> Repository | None:
    """Resolve the org-scoped active repo for a Seer-reported PR, or None.

    Matches by name within the org, optionally narrowed by provider (Seer sends
    the bare form; Sentry stores both the bare and ``integrations:``-prefixed
    shapes). Resolves only on an unambiguous single match — never guesses between
    same-named repos.
    """
    candidates = Repository.objects.filter(
        organization_id=organization_id,
        name=repo_name,
        status=ObjectStatus.ACTIVE,
    )

    normalized = (provider or "").lower().removeprefix("integrations:")
    if normalized and normalized != "unknown":
        candidates = candidates.filter(
            Q(provider=normalized) | Q(provider=f"integrations:{normalized}")
        )

    matches = list(candidates.order_by("id")[:2])
    return matches[0] if len(matches) == 1 else None


def link_seer_run_to_pull_request(
    *,
    organization: Organization,
    run_id: int,
    repo_name: str,
    provider: str | None,
    pr_number: int | str,
) -> SeerRunPullRequest | None:
    """Record a ``SeerRunPullRequest`` linking a Seer run to one pull request.

    ``run_id`` is Seer's ``DbRunState.id``; the run's ``SeerRun`` mirror is looked
    up by ``seer_run_state_id``. Idempotent on the ``(seer_run, pull_request)``
    unique constraint.

    Returns the link, or None when the SeerRun or repo can't be resolved.
    """
    log_context = {
        "organization_id": organization.id,
        "run_id": run_id,
        "repo_name": repo_name,
        "provider": provider,
        "pr_number": pr_number,
    }

    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=run_id
    ).first()
    if seer_run is None:
        logger.warning("seer.pr_link.run_not_found", extra=log_context)
        return None

    repository = _resolve_repository(
        organization_id=organization.id, repo_name=repo_name, provider=provider
    )
    if repository is None:
        logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
        return None

    pull_request, _ = PullRequest.objects.get_or_create(
        organization_id=organization.id,
        repository_id=repository.id,
        key=str(pr_number),
    )

    link, _ = SeerRunPullRequest.objects.get_or_create(
        seer_run=seer_run,
        pull_request=pull_request,
    )
    logger.info(
        "seer.pr_link.recorded",
        extra={**log_context, "pull_request_id": pull_request.id},
    )
    return link
