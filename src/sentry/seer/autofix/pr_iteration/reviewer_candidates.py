"""Reviewer candidates for a Seer-authored PR.

Requesting the whole owning team rebuilds the bystander effect, so the
review-request flow asks one specific person. This module computes who that
should be — today the run's triggering user, resolved to a GitHub login —
as a ranked candidate list where each entry carries its source as
provenance, so we can measure which source's reviewers actually respond.

The list is computed lazily at decision time (identity links go stale, and
most green events never reach a request) and persisted on ``SeerRun`` so
later re-request logic can fall back to the next candidate without
recomputing.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Collection, Mapping
from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from sentry.models.organization import Organization
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.seer.utils import get_github_username_for_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Provenance labels stored per candidate and used as metric tag values.
SOURCE_TRIGGERING_USER = "triggering_user"

# SeerRun.extras key holding the computed candidates, keyed by repo full name
# (a run can open PRs in several repos). Each marker records the ranked list
# with provenance so re-request logic can fall back without recomputing.
REVIEWER_CANDIDATES_EXTRA = "reviewer_candidates"


@dataclass(frozen=True)
class ReviewerCandidate:
    """A GitHub login we could ask for review, and which source proposed it."""

    login: str
    source: str


def get_reviewer_candidates_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, REVIEWER_CANDIDATES_EXTRA, repo_name)


def record_reviewer_candidates_marker(
    seer_run: SeerRun,
    repo_name: str,
    *,
    head_sha: str,
    candidates: list[ReviewerCandidate],
) -> None:
    record_run_marker(
        seer_run,
        REVIEWER_CANDIDATES_EXTRA,
        repo_name,
        {
            "computed_at": timezone.now().isoformat(),
            "head_sha": head_sha,
            "candidates": [{"login": c.login, "source": c.source} for c in candidates],
        },
    )


def collect_reviewer_candidates(
    *,
    organization: Organization,
    seer_run: SeerRun,
    exclude_logins: Collection[str] = (),
    log_extra: Mapping[str, Any],
) -> list[ReviewerCandidate]:
    """The ranked reviewer candidates for a Seer PR, best first.

    Bots, ``exclude_logins`` (e.g. the PR author), and duplicates are dropped;
    a login proposed by several sources keeps its highest-ranked provenance.
    A source that errors is skipped so one flaky lookup can't empty the list.
    """
    excluded = {login.lower() for login in exclude_logins}
    candidates: list[ReviewerCandidate] = []
    seen: set[str] = set()

    def resolve_source(source: str, resolve: Callable[[], list[str]]) -> None:
        try:
            logins = resolve()
        except Exception:
            metrics.incr(
                "autofix.pr_iteration.reviewer_candidates.source_failed", tags={"source": source}
            )
            logger.warning(
                "autofix.pr_iteration.reviewer_candidates.source_failed",
                extra={**log_extra, "source": source},
                exc_info=True,
            )
            return
        # Sizes each source's resolution rate — e.g. how often a triggering
        # user exists but has no mappable GitHub identity.
        metrics.incr(
            "autofix.pr_iteration.reviewer_candidates.source_resolved",
            tags={"source": source, "found": str(bool(logins)).lower()},
        )
        for login in logins:
            key = login.lower()
            if key in seen or key in excluded or _is_bot_login(login):
                continue
            seen.add(key)
            candidates.append(ReviewerCandidate(login=login, source=source))

    resolve_source(SOURCE_TRIGGERING_USER, lambda: _triggering_user_logins(seer_run, organization))
    return candidates


def _is_bot_login(login: str) -> bool:
    # GitHub app identities ("dependabot[bot]").
    return login.lower().endswith("[bot]")


def _triggering_user_logins(seer_run: SeerRun, organization: Organization) -> list[str]:
    if seer_run.user_id is None:
        # System runs (e.g. Night Shift) have no triggering user to ask.
        return []
    user = user_service.get_user(user_id=seer_run.user_id)
    if user is None:
        return []
    login = get_github_username_for_user(user, organization.id, referrer="pr_reviewer_candidates")
    return [login] if login else []
