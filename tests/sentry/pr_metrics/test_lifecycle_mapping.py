from __future__ import annotations

from datetime import datetime, timezone

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.pr_metrics.lifecycle_mapping import (
    is_stale_pull_request_snapshot,
    map_gitlab_state_to_pullrequest_lifecycle,
    parse_scm_timestamp,
    pull_request_lifecycle_state_from_github,
    update_pull_request_from_scm_snapshot,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


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


def test_stale_snapshot_older_payload_timestamp() -> None:
    stored = PullRequest(
        state=PullRequestLifecycleState.CLOSED,
        scm_updated_at=datetime(2026, 7, 1, 12, 5, tzinfo=timezone.utc),
    )
    assert is_stale_pull_request_snapshot(
        stored,
        event_state=PullRequestLifecycleState.OPEN,
        event_updated_at=datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
    )


def test_stale_snapshot_newer_payload_timestamp_applies() -> None:
    # A genuine reopen: closed -> open, but reported later than what's stored.
    stored = PullRequest(
        state=PullRequestLifecycleState.CLOSED,
        scm_updated_at=datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert not is_stale_pull_request_snapshot(
        stored,
        event_state=PullRequestLifecycleState.OPEN,
        event_updated_at=datetime(2026, 7, 1, 12, 5, tzinfo=timezone.utc),
    )


def test_stale_snapshot_equal_payload_timestamp_applies() -> None:
    # Providers report seconds; within one second the events can't be ordered, so
    # the later delivery wins.
    same = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)
    stored = PullRequest(state=PullRequestLifecycleState.CLOSED, scm_updated_at=same)
    assert not is_stale_pull_request_snapshot(
        stored, event_state=PullRequestLifecycleState.OPEN, event_updated_at=same
    )


def test_stale_snapshot_merged_is_terminal_without_timestamps() -> None:
    # No timestamps on either side (a row written before scm_updated_at was recorded),
    # so only the terminal-state rule can catch the regression.
    stored = PullRequest(state=PullRequestLifecycleState.MERGED, scm_updated_at=None)
    assert is_stale_pull_request_snapshot(
        stored, event_state=PullRequestLifecycleState.OPEN, event_updated_at=None
    )
    assert is_stale_pull_request_snapshot(
        stored, event_state=PullRequestLifecycleState.CLOSED, event_updated_at=None
    )


def test_stale_snapshot_merged_accepts_newer_merged_snapshot() -> None:
    # An edit after the merge keeps the merged state and must still apply.
    stored = PullRequest(
        state=PullRequestLifecycleState.MERGED,
        scm_updated_at=datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert not is_stale_pull_request_snapshot(
        stored,
        event_state=PullRequestLifecycleState.MERGED,
        event_updated_at=datetime(2026, 7, 1, 12, 5, tzinfo=timezone.utc),
    )


def test_stale_snapshot_missing_timestamps_are_not_stale() -> None:
    # Nothing to compare, so last write wins.
    stored = PullRequest(state=PullRequestLifecycleState.OPEN, scm_updated_at=None)
    assert not is_stale_pull_request_snapshot(
        stored,
        event_state=PullRequestLifecycleState.OPEN,
        event_updated_at=datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
    )

    stored = PullRequest(
        state=PullRequestLifecycleState.OPEN,
        scm_updated_at=datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert not is_stale_pull_request_snapshot(
        stored, event_state=PullRequestLifecycleState.OPEN, event_updated_at=None
    )


@cell_silo_test
class UpdatePullRequestFromScmSnapshotTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.create_project(organization=self.organization),
            provider="integrations:github",
            external_id="99",
        )

    def _upsert(
        self, *, state: str, scm_updated_at: datetime, title: str
    ) -> tuple[PullRequest, bool]:
        return update_pull_request_from_scm_snapshot(
            provider="github",
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=42,
            defaults={"state": state, "scm_updated_at": scm_updated_at, "title": title},
            event_state=state,
            event_updated_at=scm_updated_at,
        )

    def test_locks_the_row_for_the_staleness_decision(self) -> None:
        # Deliveries from one mailbox run concurrently, so the read the decision is
        # based on has to hold the row until the write lands — otherwise both writers
        # see the pre-write row and the older one lands last. update_or_create takes
        # its own lock, but only after this read, so the first read must be the locked
        # one.
        self._upsert(
            state=PullRequestLifecycleState.OPEN,
            scm_updated_at=datetime(2015, 5, 5, 23, 40, tzinfo=timezone.utc),
            title="opened",
        )

        connection = connections[router.db_for_write(PullRequest)]
        with CaptureQueriesContext(connection) as queries:
            self._upsert(
                state=PullRequestLifecycleState.MERGED,
                scm_updated_at=datetime(2015, 5, 5, 23, 45, tzinfo=timezone.utc),
                title="merged",
            )

        reads = [
            q["sql"]
            for q in queries.captured_queries
            if q["sql"].startswith("SELECT") and "sentry_pull_request" in q["sql"]
        ]
        assert reads
        assert "FOR UPDATE" in reads[0]

    def test_stale_snapshot_leaves_the_row_untouched(self) -> None:
        self._upsert(
            state=PullRequestLifecycleState.MERGED,
            scm_updated_at=datetime(2015, 5, 5, 23, 45, tzinfo=timezone.utc),
            title="merged",
        )

        stored, created = self._upsert(
            state=PullRequestLifecycleState.OPEN,
            scm_updated_at=datetime(2015, 5, 5, 23, 41, tzinfo=timezone.utc),
            title="stale",
        )

        assert created is False
        assert stored.state == PullRequestLifecycleState.MERGED
        assert stored.title == "merged"
        assert PullRequest.objects.get(repository_id=self.repo.id, key="42").title == "merged"
