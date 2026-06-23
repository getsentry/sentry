"""Link a Seer run to a pull request it opened."""

from __future__ import annotations

import logging

from django.db.models import Q

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.seer.models.run import SeerRun, SeerRunPullRequest

logger = logging.getLogger(__name__)


def link_seer_run_to_pull_request(
    *,
    organization: Organization,
    seer_run_state_id: int,
    repo_name: str,
    provider: str | None,
    pr_number: int | str,
) -> SeerRunPullRequest | None:
    """Record a ``SeerRunPullRequest``, or None if the run or repo can't be resolved."""
    log_context = {
        "organization_id": organization.id,
        "seer_run_state_id": seer_run_state_id,
        "repo_name": repo_name,
        "provider": provider,
        "pr_number": pr_number,
    }

    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=seer_run_state_id
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
    link, _ = SeerRunPullRequest.objects.get_or_create(seer_run=seer_run, pull_request=pull_request)
    logger.info("seer.pr_link.recorded", extra={**log_context, "pull_request_id": pull_request.id})
    return link


def _resolve_repository(
    *, organization_id: int, repo_name: str, provider: str | None
) -> Repository | None:
    """Resolve the org's active repo by name (narrowed by provider); None unless exactly one matches."""
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
