from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING, Literal

from django.utils import timezone

from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.seer.autofix.issue_summary import (
    get_issue_summary_cache_key,
    get_issue_summary_lock_key,
)
from sentry.seer.autofix.utils import (
    has_project_connected_repos,
    is_issue_eligible_for_seer_automation,
    is_seer_scanner_rate_limited,
)
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.utils.locking.manager import LockManager

SeerAutomationSkipReason = Literal[
    "already_has_fixability_score",
    "already_triggered",
    "automation_already_dispatched",
    "fixability_too_low",
    "issue_too_old",
    "lock_already_held",
    "no_connected_repos",
    "not_eligible",
    "rate_limited",
    "summary_already_cached",
    "summary_already_dispatched",
]


def get_default_seer_automation_skip_reason(
    group: Group,
    locks: LockManager,
) -> SeerAutomationSkipReason | None:
    """Return skip reason for the default (non-seat-based) automation path, or None if eligible."""
    if group.seer_fixability_score is not None:
        return "already_has_fixability_score"

    if not is_issue_eligible_for_seer_automation(group):
        return "not_eligible"

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
    if group.times_seen_with_pending < 10:
        cache_key = get_issue_summary_cache_key(group.id)
        if cache.get(cache_key) is not None:
            return "summary_already_cached"

        if not is_issue_eligible_for_seer_automation(group):
            return "not_eligible"

        summary_dispatch_cache_key = f"seer-summary-dispatched:{group.id}"
        if not cache.add(summary_dispatch_cache_key, True, timeout=30):
            return "summary_already_dispatched"

        if is_seer_scanner_rate_limited(group.project, group.organization):
            return "rate_limited"

        return None

    # Event count >= 10: run automation
    if group.seer_autofix_last_triggered is not None:
        return "already_triggered"

    if group.first_seen < (timezone.now() - timedelta(days=14)):
        return "issue_too_old"

    if group.seer_fixability_score is not None:
        if (
            group.seer_fixability_score < FixabilityScoreThresholds.MEDIUM.value
            and not group.issue_type.always_trigger_seer_automation
        ):
            return "fixability_too_low"

    if not is_issue_eligible_for_seer_automation(group):
        return "not_eligible"

    automation_dispatch_cache_key = f"seer-automation-dispatched:{group.id}"
    if not cache.add(automation_dispatch_cache_key, True, timeout=300):
        return "automation_already_dispatched"

    if not has_project_connected_repos(group.organization.id, group.project.id):
        return "no_connected_repos"

    # Check if we need a summary first and are rate limited
    cache_key = get_issue_summary_cache_key(group.id)
    if cache.get(cache_key) is None:
        if is_seer_scanner_rate_limited(group.project, group.organization):
            return "rate_limited"

    return None
