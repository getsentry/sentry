from __future__ import annotations

from typing import TYPE_CHECKING, Literal, Union

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.utils.locking.manager import LockManager

SeerAutomationIneligibilityReason = Literal[
    "not_eligible.issue_category_ineligible",
    "not_eligible.gen_ai_feature_disabled",
    "not_eligible.ai_features_hidden",
    "not_eligible.scanner_not_enabled",
    "not_eligible.no_budget",
]

SeerAutomationSkipReason = Union[
    Literal[
        "already_has_fixability_score",
        "lock_already_held",
        "rate_limited",
    ],
    SeerAutomationIneligibilityReason,
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
