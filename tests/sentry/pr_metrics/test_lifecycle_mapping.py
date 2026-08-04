from __future__ import annotations

from datetime import datetime, timezone

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.pr_metrics.lifecycle_mapping import (
    map_gitlab_state_to_pullrequest_lifecycle,
    parse_scm_timestamp,
    pull_request_lifecycle_state_from_github,
)


def test_parse_scm_timestamp_to_utc() -> None:
    assert parse_scm_timestamp("2026-07-01T12:30:00Z") == datetime(
        2026, 7, 1, 12, 30, tzinfo=timezone.utc
    )


def test_parse_scm_timestamp_converts_offset() -> None:
    assert parse_scm_timestamp("2026-07-01T14:30:00+02:00") == datetime(
        2026, 7, 1, 12, 30, tzinfo=timezone.utc
    )


def test_parse_scm_timestamp_absent() -> None:
    assert parse_scm_timestamp(None) is None
    assert parse_scm_timestamp("") is None


def test_github_state_merged_wins_over_closed() -> None:
    # GitHub reports a merged PR as state "closed" plus merged=True; the merged flag must
    # win so the row isn't stored as an ambiguous "closed".
    assert (
        pull_request_lifecycle_state_from_github({"state": "closed", "merged": True})
        == PullRequestLifecycleState.MERGED
    )


def test_github_state_closed_unmerged() -> None:
    assert (
        pull_request_lifecycle_state_from_github({"state": "closed", "merged": False})
        == PullRequestLifecycleState.CLOSED
    )


def test_github_state_open() -> None:
    assert (
        pull_request_lifecycle_state_from_github({"state": "open", "merged": False})
        == PullRequestLifecycleState.OPEN
    )


def test_gitlab_state_known_values() -> None:
    assert map_gitlab_state_to_pullrequest_lifecycle("opened") == PullRequestLifecycleState.OPEN
    assert map_gitlab_state_to_pullrequest_lifecycle("closed") == PullRequestLifecycleState.CLOSED
    assert map_gitlab_state_to_pullrequest_lifecycle("merged") == PullRequestLifecycleState.MERGED
    assert map_gitlab_state_to_pullrequest_lifecycle("locked") == PullRequestLifecycleState.LOCKED


def test_gitlab_state_unknown_values() -> None:
    assert map_gitlab_state_to_pullrequest_lifecycle(None) is None
    assert map_gitlab_state_to_pullrequest_lifecycle("") is None
    assert map_gitlab_state_to_pullrequest_lifecycle("something_new") is None
    # Casing is not normalized; GitLab reports lowercase.
    assert map_gitlab_state_to_pullrequest_lifecycle("OPENED") is None
