"""Shared utilities for the PR Merge Live Metrics pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import cast

from django.db.models import Q
from django.utils import timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.models.commit import Commit
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestLifecycleState,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.activity_doc import ActivityDoc, commit_shas_from_doc
from sentry.seer.models import SeerAgentRun, SeerRunPullRequest

_PR_ACTIVITY_ATTRIBUTION_BUFFER = timedelta(hours=30)


def is_activity_tracking_enabled(
    organization: Organization,
    pr: PullRequest | None = None,
    *,
    for_terminal_event: bool = False,
) -> bool:
    """Whether PR activity rows should be written for this organization (and PR).

    Gated on the feature flag rollout only — Seer access is not required,
    since activity is collected for all attribution types including MCP.

    When ``pr`` is supplied, two additional per-PR checks apply in order:

    1. If the PR's ``state`` is ``SUPERSEDED``, no further activity is needed —
       this short-circuits without any extra DB queries. ``CLOSED``/``MERGED`` are
       deliberately *not* short-circuited: the shared
       ``PullRequestEventWebhook._handle`` upsert stamps the terminal state
       *before* the webhook-event processors run, so within the very delivery
       that closed the PR the row already reads terminal — yet the event that
       records *who* closed it must still be written. The trade-off is that a
       stray event on an already-terminal PR may also be recorded until the
       verdict is claimed — an accepted cost for capturing the closer.

    2. A verdict check runs next: activity remains enabled while the verdict is
       null or ``WAITING_EVENT_COOLDOWN`` so late check events can be captured.
       All other non-null verdicts (including terminal verdicts and
       ``JUDGE_IN_PROGRESS``) stop further activity.

    3. A time-based buffer gate applies last:
       - Within ``_PR_ACTIVITY_ATTRIBUTION_BUFFER`` (30 h) of ``pr.date_added``,
         activity is always collected — no attribution row is required yet.
       - After that window, activity is collected only when the PR has at
         least one valid ``PullRequestAttribution`` row (``is_valid=True``).

    ``for_terminal_event`` marks a close/merge/reopen webhook: it skips the state
    and verdict short-circuits (steps 1-2), leaving only the feature flag and the
    buffer / attribution gate. Two distinct situations need it:

    - Same delivery: the state stamp above means a close/merge event always sees
      its own PR as terminal already (and a SUPERSEDED PR can still be genuinely
      closed, which must record the closer).
    - Later delivery: verdicts are claimed by the deferred emission task
      *outside* the webhook flow, so a reopen — or a re-close during/after
      judging — arrives after the claim. No intra-webhook processor reordering
      can help that case, which is why this bypass exists instead.

    The gates are meant to stop *post*-terminal accumulation, not the terminal
    event itself.
    """
    if not features.has("organizations:pr-metrics-activity", organization):
        return False

    if pr is not None:
        if not for_terminal_event:
            if pr.state == PullRequestLifecycleState.SUPERSEDED:
                return False
            verdict = (
                PullRequestMetrics.objects.filter(pull_request=pr)
                .values_list("verdict", flat=True)
                .first()
            )
            if verdict is not None and verdict != PullRequestVerdict.WAITING_EVENT_COOLDOWN:
                return False
        if timezone.now() - pr.date_added <= _PR_ACTIVITY_ATTRIBUTION_BUFFER:
            return True
        return PullRequestAttribution.objects.filter(
            pull_request=pr,
            is_valid=True,
        ).exists()

    return True


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


def org_has_coding_agent_for_provider(organization: Organization, provider_hint: str) -> bool:
    """Return True if the org has at least one active integration for the given provider."""
    integrations = integration_service.get_integrations(
        organization_id=organization.id,
        providers=[provider_hint],
        org_integration_status=ObjectStatus.ACTIVE,
    )
    return len(integrations) > 0


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


def load_activity_document(pull_request: PullRequest) -> ActivityDoc | None:
    """The PR's reduced activity document, or None when it's on the legacy store.

    The presence of the 1:1 ``PullRequestActivityLog`` row is the per-PR routing
    signal every reader uses: a row → read the document; no row → read the legacy
    ``PullRequestActivity`` rows. Mirrors the write-time routing, so a PR is read
    from whichever store it was written to.

    A row whose document was never folded — a read racing the first fold, or a
    pre-fix orphan from a fold that failed after the row was created — carries the
    model's ``{}`` default with no ``version``. That is not a document: treat it as
    absent (return None) so readers fall back to the legacy store instead of
    computing zeroed metrics from a phantom, empty document.
    """
    row = PullRequestActivityLog.objects.filter(pull_request=pull_request).first()
    if row is None:
        return None
    if not (row.data and row.data.get("version")):
        return None
    return cast(ActivityDoc, row.data)


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

    doc = load_activity_document(pull_request)
    if doc is not None:
        shas = commit_shas_from_doc(doc, pull_request.head_commit_sha)
    else:
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


@dataclass(frozen=True)
class SeerRunPullRequestLink:
    """The Seer run (and, if applicable, delegated coding agent) that opened a PR,
    resolved from the local ``SeerRunPullRequest`` link.
    """

    run_id: int | None
    group_id: int | None
    coding_agent_provider: str | None
    coding_agent_id: str | None


def seer_run_pull_request_link(pull_request: PullRequest) -> SeerRunPullRequestLink | None:
    """The ``SeerRunPullRequest`` link for this PR, resolved to its run/group/agent
    provider, or ``None`` if the PR has no such link.

    That link is written by the on_completion_hook-driven ``seer.pr_created`` flow
    (``process_autofix_updates`` -> ``link_seer_run_pull_requests``) for Seer-native
    PRs, and by ``sync_coding_agent_status`` for PRs opened by a delegated coding
    agent (Cursor/GitHub Copilot/Claude Code) -- distinguished by a non-null
    ``coding_agent_handoff``. It may not exist yet at the "opened" webhook if
    neither flow has landed; the "closed" re-check in ``handle_attribution`` (and
    the deferred-emission re-check in ``run_deferred_emission``) covers that case.
    """
    link = (
        SeerRunPullRequest.objects.select_related("seer_run__agent", "coding_agent_handoff")
        .filter(pull_request=pull_request)
        .first()
    )
    if link is None:
        return None

    run_id = link.seer_run.seer_run_state_id
    try:
        group_id = link.seer_run.agent.group_id
    except SeerAgentRun.DoesNotExist:
        group_id = None

    coding_agent_provider = (
        link.coding_agent_handoff.provider if link.coding_agent_handoff is not None else None
    )
    coding_agent_id = (
        link.coding_agent_handoff.agent_id if link.coding_agent_handoff is not None else None
    )

    return SeerRunPullRequestLink(
        run_id=run_id,
        group_id=group_id,
        coding_agent_provider=coding_agent_provider,
        coding_agent_id=coding_agent_id,
    )


def seer_run_link_for_pull_request(pull_request: PullRequest) -> tuple[list[int], int | None]:
    """Group id and run id for the Seer run that opened this PR, via the local
    ``SeerRunPullRequest`` link.

    Thin wrapper around ``seer_run_pull_request_link`` for callers that only need
    group ids/run id (e.g. the webhook-side ``SENTRY_APP`` author attribution) and
    don't care whether the PR was opened by a delegated coding agent.
    """
    link = seer_run_pull_request_link(pull_request)
    if link is None:
        return [], None

    return ([link.group_id] if link.group_id is not None else []), link.run_id
