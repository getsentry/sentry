"""Link Seer runs to the pull requests they open.

Seer's ``seer.pr_created`` event reports the PRs an autofix/explorer run opened.
This module turns each reported PR into a ``SeerRunPullRequest`` row so a run can
be mapped to its PR(s) (and vice versa) directly from the Sentry ORM.

This is deliberately independent of the PR-metrics attribution pipeline: it has
its own feature flag and best-effort semantics, and it reads nothing from that
module. The ``PullRequest`` find-or-create here is keyed on
``(organization, repository, pr_number)``, so it converges on the same canonical
row that attribution and the SCM webhook use — only ever one row per PR.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

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

    # Fetch up to 2 to detect ambiguity — the same name can exist under multiple
    # providers (e.g. github & gitlab) within one org.
    matches = list(candidates.order_by("id")[:2])
    return matches[0] if len(matches) == 1 else None


def link_seer_run_to_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int,
) -> None:
    """Record a ``SeerRunPullRequest`` for each PR a Seer run reported opening.

    ``run_id`` is Seer's ``DbRunState.id`` (matching ``SeerRun.seer_run_state_id``).
    The ``SeerRun`` mirror is attached when it already exists; otherwise the link
    is created with a null FK and only the ``seer_run_state_id``.

    Best-effort: each PR is handled independently and failures are logged and
    swallowed so one bad entry never drops the rest of the batch.
    """
    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=run_id
    ).first()

    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")

        log_context = {
            "organization_id": organization.id,
            "run_id": run_id,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("seer.pr_link.missing_fields", extra=log_context)
            continue

        try:
            repository = _resolve_repository(
                organization_id=organization.id, repo_name=repo_name, provider=provider
            )
            if repository is None:
                logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
                continue

            # Keyed on (org, repo, pr_number); converges on the same canonical PR
            # row used by attribution and the SCM webhook. May be a shell row (no
            # title/body) if we beat the SCM `opened` webhook — never overwritten.
            pull_request, _ = PullRequest.objects.get_or_create(
                organization_id=organization.id,
                repository_id=repository.id,
                key=str(pr_number),
            )

            SeerRunPullRequest.objects.get_or_create(
                seer_run_state_id=run_id,
                pull_request=pull_request,
                defaults={"seer_run": seer_run},
            )
        except Exception:
            logger.exception("seer.pr_link.failed", extra=log_context)
            continue

        logger.info(
            "seer.pr_link.recorded",
            extra={**log_context, "pull_request_id": pull_request.id},
        )
