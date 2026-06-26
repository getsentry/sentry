"""Shared utilities for the PR Merge Live Metrics pipeline."""

from __future__ import annotations

from datetime import datetime

from django.db.models import Q

from sentry import features
from sentry.models.commit import Commit
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest, PullRequestActivity, PullRequestActivityType
from sentry.seer.seer_setup import has_seer_access


def is_activity_tracking_enabled(organization: Organization) -> bool:
    """Whether PR activity rows should be written for this organization.

    Both the feature flag rollout and Seer access are required: activity data
    feeds the judge path which is only meaningful for Seer-enabled orgs.
    """
    return features.has("organizations:pr-metrics-activity", organization) and has_seer_access(
        organization
    )


def iso_or_none(value: datetime | None) -> str | None:
    """Serialize a persisted datetime to an ISO-8601 string, or None.

    Shared by the analytics row and the Seer judge request, which both encode the
    PR's optional timestamps the same way.
    """
    return value.isoformat() if value is not None else None


# Branch-prefix → provider hint. Claude-delegated PRs are opened by the Sentry
# GitHub app (no distinct author), so the branch prefix is the only usable signal.
DELEGATED_AGENT_BRANCH_PREFIXES: dict[str, str] = {
    "claude_code": "claude/",
    "github_copilot": "copilot/",
}

# GitHub bot login → provider hint. Copilot opens PRs as a distinct bot user;
# other providers rely on the branch prefix above.
DELEGATED_AGENT_AUTHOR_LOGINS: dict[str, str] = {
    "copilot-swe-agent[bot]": "github_copilot",
}


def _commit_shas_from_activity(pull_request: PullRequest) -> set[str]:
    """SHAs reachable from SYNCHRONIZED activity, stopping at any force push.

    Walks the SYNCHRONIZED chain newest→oldest. A force push is detected
    when an event's after_sha doesn't continue from the expected point;
    traversal stops there. Returns an empty set when there are no events.

    Known limitation — undetectable squash force-push:
    A squash-and-force-push of the most recent commits produces a
    ``synchronize`` event with ``before=<previous_head>`` and
    ``after=<new_squashed_commit>``.  Because ``before`` equals the previous
    HEAD, the chain appears unbroken and the old (now-squashed) SHAs are
    included in the result alongside the new squashed SHA.  This cannot be
    detected from the webhook payload alone; distinguishing a squash from a
    regular push would require commit-graph data (e.g. verifying that
    ``after`` is a descendant of ``before``).

    By contrast, a force-push that *removes intermediate commits* (i.e. the
    new ``before`` jumps back past the previous HEAD) creates a gap in the
    chain that IS correctly detected and halts traversal.
    """
    payloads = list(
        PullRequestActivity.objects.filter(
            pull_request=pull_request,
            event_type=PullRequestActivityType.SYNCHRONIZED,
        )
        .order_by("-date_added", "-id")
        .values_list("payload", flat=True)
    )

    if not payloads:
        return set()

    first_sha = payloads[0].get("after_sha") or ""
    first_expected = payloads[0].get("before_sha") or ""
    if len(payloads) == 1:
        return {first_sha} if first_sha else set()

    shas: set[str] = {first_sha}
    expected_after: str | None = first_expected

    for payload in payloads[1:]:  # newest → oldest
        after_sha = payload.get("after_sha") or ""
        before_sha = payload.get("before_sha") or ""
        if not after_sha:
            break
        elif after_sha != expected_after:
            # Gap in chain — force push rewrote history before this point.
            break
        else:
            shas.add(after_sha)
        if not before_sha:
            # Can't verify further without a before_sha.
            expected_after = None
            break
        expected_after = before_sha

    return shas


def resolved_group_ids(pull_request: PullRequest) -> list[int]:
    """Group IDs this PR resolves, from the resolving GroupLink rows.

    Includes groups linked directly to the PR and groups linked to commits
    reachable from SYNCHRONIZED activity (stopping at any force push). Both
    lookup paths are merged into a single GroupLink query.

    Sorted for a deterministic ordering; empty when the PR resolves no issues.
    """
    pr_filter = Q(
        linked_type=GroupLink.LinkedType.pull_request,
        relationship=GroupLink.Relationship.resolves,
        linked_id=pull_request.id,
    )

    shas = _commit_shas_from_activity(pull_request)
    if shas:
        commit_ids = Commit.objects.filter(
            repository_id=pull_request.repository_id,
            key__in=shas,
        ).values("id")
        combined = pr_filter | Q(
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id__in=commit_ids,
        )
    else:
        combined = pr_filter

    return sorted(GroupLink.objects.filter(combined).values_list("group_id", flat=True).distinct())
