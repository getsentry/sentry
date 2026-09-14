from unittest import mock

import pytest

from sentry.integrations.utils.github_permission_tiers import (
    BASELINE_TIER,
    TIERS,
    _baseline_tier_reqs,
    get_missing_permission_tiers,
    get_permission_tiers,
)

REQUIRED_PERMISSIONS = {
    "actions": "write",
    "administration": "read",
    "checks": "write",
    "code_quality": "read",
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "repository_hooks": "write",
    "security_events": "read",
    "statuses": "write",
}

UP_TO_DATE = REQUIRED_PERMISSIONS

MISSING_PR_ITERATION = {
    "administration": "read",
    "checks": "write",
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "repository_hooks": "write",
    "statuses": "write",
}

MISSING_AUTOFIX_PRS = {**MISSING_PR_ITERATION, "contents": "read"}

MISSING_CODE_REVIEW = {
    "administration": "read",
    "contents": "read",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "repository_hooks": "write",
}

MISSING_PR_COMMENTS = {**MISSING_CODE_REVIEW, "pull_requests": "read"}

ALL_KEYS = [
    "pr_iteration",
    "autofix_pull_requests",
    "code_review",
    "pull_request_comments",
    "baseline",
]


def _keys(permissions, required=None):
    tiers = get_permission_tiers(permissions, required or REQUIRED_PERMISSIONS)
    return [tier.key for tier in tiers]


@pytest.mark.parametrize(
    ("permissions", "expected"),
    [
        (UP_TO_DATE, []),
        (MISSING_PR_ITERATION, ALL_KEYS[:1]),
        (MISSING_AUTOFIX_PRS, ALL_KEYS[:2]),
        (MISSING_CODE_REVIEW, ALL_KEYS[:3]),
        (MISSING_PR_COMMENTS, ALL_KEYS[:4]),
        ({}, ALL_KEYS),
    ],
)
def test_tiers_for_production_permission_sets(permissions, expected) -> None:
    assert _keys(permissions) == expected


def test_scopes_beyond_what_any_tier_asks_for_are_ignored() -> None:
    assert _keys({**UP_TO_DATE, "packages": "write", "pages": "admin"}) == []


def test_a_level_above_the_watermark_still_satisfies_the_tier() -> None:
    assert _keys({**UP_TO_DATE, "contents": "admin"}) == []


def test_an_unrecognised_level_counts_as_not_held() -> None:
    assert _keys({**UP_TO_DATE, "actions": "sudo"}) == ALL_KEYS[:1]


def test_contents_read_falls_short_of_the_autofix_write_watermark() -> None:
    assert _keys({**MISSING_PR_ITERATION, "contents": "write"}) == ALL_KEYS[:1]
    assert _keys({**MISSING_PR_ITERATION, "contents": "read"}) == ALL_KEYS[:2]


def test_pull_requests_read_falls_short_of_the_pr_comments_watermark() -> None:
    assert _keys({**MISSING_CODE_REVIEW, "pull_requests": "write"}) == ALL_KEYS[:3]
    assert _keys({**MISSING_CODE_REVIEW, "pull_requests": "read"}) == ALL_KEYS[:4]


@mock.patch("sentry.integrations.utils.github_permission_tiers.logger.warning")
def test_a_newer_tier_held_without_an_older_one_is_inconsistent(mock_warning) -> None:
    assert _keys({**UP_TO_DATE, "contents": "read"}) == ALL_KEYS

    assert mock_warning.call_args[0][0] == "github_permission_tiers.inconsistent_permissions"
    assert mock_warning.call_args[1]["extra"]["behind_tiers"] == ["autofix_pull_requests"]


@mock.patch("sentry.integrations.utils.github_permission_tiers.logger.warning")
def test_a_gap_in_the_middle_of_the_chain_is_inconsistent(mock_warning) -> None:
    assert _keys({**UP_TO_DATE, "actions": "read", "checks": "read"}) == ALL_KEYS

    assert mock_warning.call_args[1]["extra"]["behind_tiers"] == ["pr_iteration", "code_review"]


@mock.patch("sentry.integrations.utils.github_permission_tiers.logger.warning")
def test_a_requirement_no_tier_claims_falls_short_of_baseline(
    mock_warning,
) -> None:
    required = {**REQUIRED_PERMISSIONS, "packages": "write"}
    assert _keys(UP_TO_DATE, required) == ALL_KEYS

    assert mock_warning.call_args[0][0] == "github_permission_tiers.short_of_baseline"
    assert mock_warning.call_args[1]["extra"]["expected_permissions"] == {
        "administration": "read",
        "issues": "write",
        "metadata": "read",
        "repository_hooks": "write",
        "packages": "write",
    }


@mock.patch("sentry.integrations.utils.github_permission_tiers.logger.warning")
def test_a_consistent_run_is_not_warned_about(mock_warning) -> None:
    assert _keys(MISSING_AUTOFIX_PRS) == ALL_KEYS[:2]

    mock_warning.assert_not_called()


def test_unclaimed_requirements_is_what_the_baseline_speaks_for() -> None:
    assert _baseline_tier_reqs(REQUIRED_PERMISSIONS) == {
        "administration": "read",
        "issues": "write",
        "metadata": "read",
        "repository_hooks": "write",
    }


def test_unclaimed_requirements_reports_a_raise_beyond_any_tier() -> None:
    assert _baseline_tier_reqs({"contents": "admin"}) == {"contents": "admin"}
    assert _baseline_tier_reqs({"contents": "write"}) == {}


def test_every_tier_key_is_unique() -> None:
    keys = [tier.key for tier in TIERS]
    assert len(keys) == len(set(keys))


def test_every_tier_order_is_unique() -> None:
    orders = [tier.order for tier in TIERS]
    assert len(orders) == len(set(orders))


def test_tiers_are_exposed_highest_order_first() -> None:
    orders = [tier.order for tier in TIERS]
    assert orders == sorted(orders, reverse=True)
    assert [tier.key for tier in TIERS] == ALL_KEYS


def test_the_baseline_is_the_lowest_tier_and_claims_no_scopes() -> None:
    assert BASELINE_TIER.order == min(tier.order for tier in TIERS)
    assert BASELINE_TIER.introduced == {}


def test_get_missing_permission_tiers_compares_against_the_required_permissions() -> None:
    # An install holding everything the app requires is missing no tiers...
    assert get_missing_permission_tiers(REQUIRED_PERMISSIONS) == []
    # ...and one holding nothing is missing every tier.
    assert [tier.key for tier in get_missing_permission_tiers({})] == ALL_KEYS
