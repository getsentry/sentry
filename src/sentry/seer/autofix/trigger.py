from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING, Literal

from django.utils import timezone

from sentry.seer.autofix.constants import (
    AUTOFIX_AUTOMATION_OCCURRENCE_THRESHOLD,
    FixabilityScoreThresholds,
)
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.utils.locking.manager import LockManager

SeerAutomationSkipReason = Literal[
    "already_has_fixability_score",
    "already_triggered",
    "already_triggered_explorer",
    "automation_already_dispatched",
    "fixability_too_low",
    "issue_too_old",
    "lock_already_held",
    "no_connected_repos",
    "not_eligible.ai_features_hidden",
    "not_eligible.gen_ai_feature_disabled",
    "not_eligible.issue_category_ineligible",
    "not_eligible.no_budget",
    "not_eligible.scanner_not_enabled",
    "rate_limited",
    "summary_already_cached",
    "summary_already_dispatched",
]


SeerAutomationIneligibilityReason = Literal[
    "not_eligible.issue_category_ineligible",
    "not_eligible.gen_ai_feature_disabled",
    "not_eligible.ai_features_hidden",
    "not_eligible.scanner_not_enabled",
    "not_eligible.no_budget",
]


def get_seer_automation_ineligibility_reason(
    group: Group,
) -> SeerAutomationIneligibilityReason | None:
    """Return the reason an issue is ineligible for Seer automation, or None if eligible."""
    from sentry import features, quotas
    from sentry.constants import DataCategory
    from sentry.seer.autofix.utils import is_issue_category_eligible

    if not is_issue_category_eligible(group):
        return "not_eligible.issue_category_ineligible"

    if not features.has("organizations:gen-ai-features", group.organization):
        return "not_eligible.gen_ai_feature_disabled"

    gen_ai_allowed = not group.organization.get_option("sentry:hide_ai_features")
    if not gen_ai_allowed:
        return "not_eligible.ai_features_hidden"

    project = group.project
    if (
        not project.get_option("sentry:seer_scanner_automation")
        and not group.issue_type.always_trigger_seer_automation
    ):
        return "not_eligible.scanner_not_enabled"

    has_budget: bool = quotas.backend.check_seer_quota(
        org_id=group.organization.id, data_category=DataCategory.SEER_SCANNER
    )
    if not has_budget:
        return "not_eligible.no_budget"

    return None


def is_issue_eligible_for_seer_automation(group: Group) -> bool:
    """Check if Seer automation is allowed for a given group based on permissions and issue type."""
    return get_seer_automation_ineligibility_reason(group) is None


def get_default_seer_automation_skip_reason(
    group: Group,
    locks: LockManager,
) -> SeerAutomationSkipReason | None:
    """Return skip reason for the default (non-seat-based) automation path, or None if eligible."""
    from sentry.seer.autofix.issue_summary import get_issue_summary_lock_key
    from sentry.seer.autofix.utils import (
        is_seer_scanner_rate_limited,
    )

    # Only run on issues with no existing scan
    if group.seer_fixability_score is not None:
        return "already_has_fixability_score"

    ineligibility_reason = get_seer_automation_ineligibility_reason(group)
    if ineligibility_reason is not None:
        return ineligibility_reason

    # Don't run if there's already a task in progress for this issue
    lock_key, lock_name = get_issue_summary_lock_key(group.id)
    lock = locks.get(lock_key, duration=1, name=lock_name)
    if lock.locked():
        return "lock_already_held"

    if is_seer_scanner_rate_limited(group.project, group.organization):
        return "rate_limited"

    return None


def get_seat_based_seer_automation_skip_reason(
    group: Group,
) -> SeerAutomationSkipReason | None:
    """Return skip reason for the seat-based automation path, or None if eligible."""
    from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key
    from sentry.seer.autofix.utils import (
        has_project_connected_repos,
        is_seer_scanner_rate_limited,
    )

    # If event count < threshold, only generate summary (no automation)
    if group.times_seen_with_pending < AUTOFIX_AUTOMATION_OCCURRENCE_THRESHOLD:
        # Check if summary exists in cache
        cache_key = get_issue_summary_cache_key(group.id)
        if cache.get(cache_key) is not None:
            return "summary_already_cached"

        # Early returns for eligibility checks (cheap checks first)
        ineligibility_reason = get_seer_automation_ineligibility_reason(group)
        if ineligibility_reason is not None:
            return ineligibility_reason

        # Atomically set cache to prevent duplicate summary generation
        summary_dispatch_cache_key = f"seer-summary-dispatched:{group.id}"
        if not cache.add(summary_dispatch_cache_key, True, timeout=30):
            return "summary_already_dispatched"  # Another process already dispatched summary generation

        # Rate limit check must be last, after cache.add succeeds, to avoid wasting quota
        if is_seer_scanner_rate_limited(group.project, group.organization):
            return "rate_limited"

        return None

    # Event count >= threshold: run automation
    # Long-term check to avoid re-running
    if group.seer_autofix_last_triggered is not None:
        return "already_triggered"

    if group.seer_explorer_autofix_last_triggered is not None:
        return "already_triggered_explorer"

    # Don't run automation on old issues
    if group.first_seen < (timezone.now() - timedelta(days=14)):
        return "issue_too_old"

    # Will not run issues if they are not fixable at MEDIUM threshold
    if group.seer_fixability_score is not None:
        if (
            group.seer_fixability_score < FixabilityScoreThresholds.MEDIUM.value
            and not group.issue_type.always_trigger_seer_automation
        ):
            return "fixability_too_low"

    # Early returns for eligibility checks (cheap checks first)
    ineligibility_reason = get_seer_automation_ineligibility_reason(group)
    if ineligibility_reason is not None:
        return ineligibility_reason

    # Atomically set cache to prevent duplicate dispatches (returns False if key exists)
    automation_dispatch_cache_key = f"seer-automation-dispatched:{group.id}"
    if not cache.add(automation_dispatch_cache_key, True, timeout=300):
        return "automation_already_dispatched"  # Another process already dispatched automation

    # Check if project has connected repositories - requirement for new pricing
    if not has_project_connected_repos(group.organization.id, group.project.id):
        return "no_connected_repos"

    return None
