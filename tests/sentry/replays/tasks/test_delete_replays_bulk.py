from __future__ import annotations

import datetime
import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, Mock, patch

import pytest
from snuba_sdk import Column, Condition, Function, Op
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.replays.lib.storage import RecordingSegmentStorageMeta, StorageBlob
from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel
from sentry.replays.tasks import run_bulk_replay_delete_job
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.delete import (
    MatchedRows,
    datetime_as_start_of_day_conditions,
    day_aligned_windows,
    delete_matched_rows,
    fetch_rows_matching_pattern,
)
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner


class TestDeleteReplaysBulk(APITestCase, ReplaysSnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(name="test_project")
        # Exactly one UTC day, so the job is a single window. These tests are about status
        # transitions, checkpointing and Seer rather than windowing, and a range crossing midnight
        # would make each of them chain an extra activation.
        self.range_start = datetime.datetime.now(tz=datetime.UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        self.range_end = self.range_start + datetime.timedelta(days=1)
        self.query = ""
        self.environments = ["prod"]

        # Create a deletion job
        self.job = ReplayDeletionJobModel.objects.create(
            organization_id=self.project.organization.id,
            project_id=self.project.id,
            range_start=self.range_start,
            range_end=self.range_end,
            query=self.query,
            environments=self.environments,
            status="pending",
        )

    @patch("sentry.replays.tasks.metrics")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_first_run(
        self,
        mock_delete_matched_rows: MagicMock,
        mock_fetch_rows: MagicMock,
        mock_metrics: MagicMock,
    ) -> None:
        """Test the first run of the bulk deletion job"""
        # Mock the fetch_rows_matching_pattern to return some rows
        mock_fetch_rows.return_value = {
            "rows": [
                {
                    "retention_days": 90,
                    "replay_id": "a",
                    "max_segment_id": 1,
                },
                {
                    "retention_days": 90,
                    "replay_id": "b",
                    "max_segment_id": 0,
                },
            ],
            "has_more": True,
            "next_cursor": 5678,
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id)

        # Verify the job status was updated
        self.job.refresh_from_db()
        assert self.job.status == "in-progress", self.job.status
        assert self.job.offset == 2, self.job.offset

        # Verify the delete operation was called
        mock_delete_matched_rows.assert_called_once_with(
            self.project.id, mock_fetch_rows.return_value["rows"]
        )

        # Verify fetch_rows was called with correct parameters
        mock_fetch_rows.assert_called_once_with(
            project_id=self.project.id,
            start=self.range_start,
            end=self.range_end,
            query=self.query,
            environment=self.environments,
            limit=100,
            after_replay_id_hash=None,
        )

        # Verify metrics were recorded
        assert mock_metrics.incr.call_count == 3
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job", tags={"status": "started"}, sample_rate=1.0
        )
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job", tags={"status": "in_progress"}, sample_rate=1.0
        )
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job.rows_deleted", amount=2, sample_rate=1.0
        )

    @patch("sentry.replays.tasks.metrics")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_completion(
        self,
        mock_delete_matched_rows: MagicMock,
        mock_fetch_rows: MagicMock,
        mock_metrics: MagicMock,
    ) -> None:
        """Test the completion of the bulk deletion job"""
        # Mock the fetch_rows_matching_pattern to return no more rows
        mock_fetch_rows.return_value = {
            "rows": [
                {
                    "retention_days": 90,
                    "replay_id": "a",
                    "max_segment_id": 1,
                },
                {
                    "retention_days": 90,
                    "replay_id": "b",
                    "max_segment_id": None,
                },
            ],
            "has_more": False,
            "next_cursor": 5678,
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id, after_replay_id_hash=100)

        # Verify the job status was updated to completed
        self.job.refresh_from_db()
        assert self.job.status == "completed", self.job.status

        # Verify the delete operation was called
        mock_delete_matched_rows.assert_called_once_with(
            self.project.id, mock_fetch_rows.return_value["rows"]
        )

        # Verify fetch_rows was called with correct parameters
        mock_fetch_rows.assert_called_once_with(
            project_id=self.project.id,
            start=self.range_start,
            end=self.range_end,
            query=self.query,
            environment=self.environments,
            limit=100,
            after_replay_id_hash=100,
        )

        # Verify metrics were recorded
        assert mock_metrics.incr.call_count == 4
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job", tags={"status": "started"}, sample_rate=1.0
        )
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job", tags={"status": "in_progress"}, sample_rate=1.0
        )
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job.rows_deleted", amount=2, sample_rate=1.0
        )
        mock_metrics.incr.assert_any_call(
            "replays.bulk_delete_job", tags={"status": "completed"}, sample_rate=1.0
        )

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_no_rows(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test the bulk deletion job when no rows are found"""
        # Mock the fetch_rows_matching_pattern to return no rows
        mock_fetch_rows.return_value = {
            "rows": [],
            "has_more": False,
            "next_cursor": None,
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id)

        # Verify the job status was updated to completed
        self.job.refresh_from_db()
        assert self.job.status == "completed"

        # Verify delete_matched_rows was not called since there were no rows
        mock_delete_matched_rows.assert_not_called()

        # Verify fetch_rows was called with correct parameters
        mock_fetch_rows.assert_called_once_with(
            project_id=self.project.id,
            start=self.range_start,
            end=self.range_end,
            query=self.query,
            environment=self.environments,
            limit=100,
            after_replay_id_hash=None,
        )

    def test_run_bulk_replay_delete_job_chained_runs(self) -> None:
        project = self.create_project()

        # Inside the job's window rather than relative to now, which lands in the previous UTC day
        # when the suite runs just after midnight.
        t1 = self.range_start + datetime.timedelta(seconds=10)
        replay_id1 = uuid.uuid4().hex
        replay_id2 = uuid.uuid4().hex
        replay_id3 = uuid.uuid4().hex
        replay_id4 = uuid.uuid4().hex
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id1, segment_id=0, environment="prod")
        )
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id2, segment_id=0, environment="prod")
        )
        self.store_replays(
            mock_replay(t1, project.id, replay_id3, segment_id=0, environment="prod")
        )
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id4, segment_id=None, environment="prod")
        )

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, limit=1)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 2

    def test_run_bulk_replay_delete_job_already_failed(self) -> None:
        t1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay_id1 = uuid.uuid4().hex
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id1, segment_id=0, environment="prod")
        )

        self.job.status = DeletionJobStatus.FAILED
        self.job.save()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, limit=0)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "failed"
        assert self.job.offset == 0

    def test_run_bulk_replay_delete_job_no_matches(self) -> None:
        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id)

        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 0

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_stale_activation(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test a duplicate activation behind the checkpoint does not rewind progress"""
        mock_fetch_rows.return_value = {
            "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
            "has_more": True,
            "next_cursor": 1234,
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 300
        self.job.save()

        with patch.object(run_bulk_replay_delete_job, "delay"):
            run_bulk_replay_delete_job(self.job.id, after_replay_id_hash=100)

        self.job.refresh_from_db()
        assert self.job.status == "in-progress"
        assert self.job.offset == 300

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_redelivered_after_checkpoint(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test an activation killed between checkpointing and enqueueing still finishes"""
        mock_fetch_rows.return_value = {
            "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
            "has_more": False,
            "next_cursor": 1234,
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 100
        self.job.save()

        run_bulk_replay_delete_job(self.job.id)

        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 100

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_concurrent_checkpoint(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test a checkpoint written by a further-along chain is not overwritten"""
        mock_fetch_rows.return_value = {
            "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
            "has_more": True,
            "next_cursor": 1234,
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        def advance_checkpoint(*args: object, **kwargs: object) -> None:
            ReplayDeletionJobModel.objects.filter(id=self.job.id).update(offset=500)

        mock_delete_matched_rows.side_effect = advance_checkpoint

        run_bulk_replay_delete_job(self.job.id)

        self.job.refresh_from_db()
        assert self.job.offset == 500

    def test_run_bulk_replay_delete_job_retry_policy_covers_deadline(self) -> None:
        """Test the deadline is retried, which is what the retries_remaining guard assumes"""
        retry = run_bulk_replay_delete_job.retry
        assert retry is not None

        assert retry.should_retry(retry.initial_state(), ProcessingDeadlineExceeded())

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_deadline_exceeded_with_retries(
        self, mock_fetch_rows: MagicMock
    ) -> None:
        """Test the job stays in-progress while the activation can still be retried"""
        mock_fetch_rows.side_effect = ProcessingDeadlineExceeded()

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        with patch("sentry.replays.tasks.current_task", return_value=Mock(retries_remaining=2)):
            with pytest.raises(ProcessingDeadlineExceeded):
                run_bulk_replay_delete_job(self.job.id)

        self.job.refresh_from_db()
        assert self.job.status == "in-progress"

    @patch("sentry.replays.tasks.metrics")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_deadline_exceeded_without_retries(
        self, mock_fetch_rows: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test the job is failed rather than stalled when deadline retries run out"""
        mock_fetch_rows.side_effect = ProcessingDeadlineExceeded()

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        with patch("sentry.replays.tasks.current_task", return_value=Mock(retries_remaining=0)):
            with pytest.raises(ProcessingDeadlineExceeded):
                run_bulk_replay_delete_job(self.job.id)

        self.job.refresh_from_db()
        assert self.job.status == "failed"

        # Verify failed metric was recorded
        mock_metrics.incr.assert_called_once_with(
            "replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0
        )

    @patch("sentry.replays.tasks.metrics")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_failure_preserves_offset(
        self, mock_fetch_rows: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test a failure records the status without reverting the checkpoint"""
        mock_fetch_rows.side_effect = ValueError("snuba is unhappy")

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 200
        self.job.save()

        with pytest.raises(ValueError):
            run_bulk_replay_delete_job(self.job.id, after_replay_id_hash=200)

        self.job.refresh_from_db()
        assert self.job.status == "failed"
        assert self.job.offset == 200

        # Verify failed metric was recorded
        mock_metrics.incr.assert_called_once_with(
            "replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0
        )

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_does_not_resurrect_completed_job(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test a chain finishing after another completed the job leaves it completed"""
        mock_fetch_rows.return_value = {
            "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
            "has_more": True,
            "next_cursor": 1234,
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        def complete_job(*args: object, **kwargs: object) -> None:
            ReplayDeletionJobModel.objects.filter(id=self.job.id).update(
                status=DeletionJobStatus.COMPLETED
            )

        mock_delete_matched_rows.side_effect = complete_job

        with patch.object(run_bulk_replay_delete_job, "delay"):
            run_bulk_replay_delete_job(self.job.id)

        self.job.refresh_from_db()
        assert self.job.status == "completed"

    def test_fetch_rows_matching_pattern(self) -> None:
        t1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        t2 = datetime.datetime.now() + datetime.timedelta(seconds=10)
        t3 = datetime.datetime.now()

        replay_id = uuid.uuid4().hex
        self.store_replays(
            mock_replay(t3, self.project.id, replay_id, segment_id=0, environment="prod")
        )

        result = fetch_rows_matching_pattern(
            self.project.id,
            t1,
            t2,
            query="count_errors:<100",
            environment=["prod"],
            limit=50,
            after_replay_id_hash=None,
        )
        assert len(result["rows"]) == 1
        assert result["rows"][0]["replay_id"] == str(uuid.UUID(replay_id))

    def test_fetch_rows_matching_pattern_keyset_pagination(self) -> None:
        """Test paging by `cityHash64(replay_id)` returns every replay exactly once.

        Every replay shares one timestamp here, which is the case the previous pagination got wrong:
        it ordered by `min(timestamp)` at hourly granularity and paged with a growing `OFFSET`, so
        ties made page boundaries non-deterministic and rows could be skipped or repeated.
        """
        timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay_ids = {uuid.uuid4().hex for _ in range(5)}
        for replay_id in replay_ids:
            self.store_replays(
                mock_replay(timestamp, self.project.id, replay_id, segment_id=0, environment="prod")
            )

        seen: list[str] = []
        cursor: int | None = None
        has_more = True
        while has_more:
            result = fetch_rows_matching_pattern(
                self.project.id,
                timestamp - datetime.timedelta(seconds=10),
                timestamp + datetime.timedelta(seconds=10),
                query="",
                environment=["prod"],
                limit=2,
                after_replay_id_hash=cursor,
            )
            seen.extend(row["replay_id"] for row in result["rows"])
            cursor = result["next_cursor"]
            has_more = result["has_more"]

        assert len(seen) == len(set(seen)), "a replay was returned on more than one page"
        assert {uuid.UUID(replay_id).hex for replay_id in seen} == replay_ids

    def test_delete_matched_rows_deletes_blob(self) -> None:
        """End-to-end: a real blob stored under the stripped key is deleted.

        Snuba returns `replay_id` in dashed UUID form, but blob storage keys use the
        dash-stripped 32-hex form. This exercises `delete_matched_rows` without mocking
        it, so a dashed-vs-stripped key mismatch would leave the blob in place and fail.
        """
        replay_id = uuid.uuid4().hex
        retention_days = 30
        max_segment_id = 1

        blob = StorageBlob()
        for segment_id in range(max_segment_id + 1):
            blob.set(
                RecordingSegmentStorageMeta(
                    project_id=self.project.id,
                    replay_id=replay_id,
                    segment_id=segment_id,
                    retention_days=retention_days,
                ),
                b"[]",
            )

        # `delete_matched_rows` receives the dashed form, matching what Snuba returns.
        delete_matched_rows(
            self.project.id,
            [
                {
                    "retention_days": retention_days,
                    "replay_id": str(uuid.UUID(replay_id)),
                    "max_segment_id": max_segment_id,
                }
            ],
        )

        for segment_id in range(max_segment_id + 1):
            assert (
                blob.get(
                    RecordingSegmentStorageMeta(
                        project_id=self.project.id,
                        replay_id=replay_id,
                        segment_id=segment_id,
                        retention_days=retention_days,
                    )
                )
                is None
            )

    @patch("sentry.replays.usecases.delete.make_replay_delete_request")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_has_seer_data_true(
        self,
        mock_delete_matched_rows: MagicMock,
        mock_fetch_rows: MagicMock,
        mock_make_seer_api_request: MagicMock,
    ) -> None:
        def row_generator() -> Generator[MatchedRows]:
            yield {
                "rows": [
                    {
                        "retention_days": 90,
                        "replay_id": "a",
                        "max_segment_id": 1,
                    },
                    {
                        "retention_days": 90,
                        "replay_id": "b",
                        "max_segment_id": 0,
                    },
                ],
                "has_more": True,
                "next_cursor": 1234,
            }
            yield {
                "rows": [
                    {
                        "retention_days": 90,
                        "replay_id": "c",
                        "max_segment_id": 1,
                    },
                ],
                "has_more": False,
                "next_cursor": 1234,
            }

        mock_fetch_rows.side_effect = row_generator()

        mock_response = Mock()
        mock_response.status = 204
        mock_make_seer_api_request.return_value = mock_response

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, limit=2, has_seer_data=True)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 3

        assert mock_make_seer_api_request.call_count == 2

        first_call = mock_make_seer_api_request.call_args_list[0]
        body = first_call[0][0]
        assert body == {
            "replay_ids": ["a", "b"],
            "organization_id": self.job.organization_id,
            "project_id": self.job.project_id,
        }

        second_call = mock_make_seer_api_request.call_args_list[1]
        body = second_call[0][0]
        assert body == {
            "replay_ids": ["c"],
            "organization_id": self.job.organization_id,
            "project_id": self.job.project_id,
        }

    def test_day_aligned_windows_open_and_close_on_the_range(self) -> None:
        """Test a mid-day range is split on UTC days without escaping the range at either end.

        Whole days rather than range-start-plus-a-day is what keeps a window inside one UTC day, so
        `datetime_as_start_of_day_conditions` can assert it. The range's own bounds still win: the first window opens
        at 17:00, not at midnight.
        """
        range_start = datetime.datetime(2026, 7, 23, 17, 0, tzinfo=datetime.UTC)
        range_end = datetime.datetime(2026, 7, 26, 9, 30, tzinfo=datetime.UTC)

        assert day_aligned_windows(range_start, range_end) == [
            (range_start, datetime.datetime(2026, 7, 24, tzinfo=datetime.UTC)),
            (
                datetime.datetime(2026, 7, 24, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 25, tzinfo=datetime.UTC),
            ),
            (
                datetime.datetime(2026, 7, 25, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 26, tzinfo=datetime.UTC),
            ),
            (datetime.datetime(2026, 7, 26, tzinfo=datetime.UTC), range_end),
        ]

    def test_day_aligned_windows_never_escape_a_utc_day(self) -> None:
        """Test windows tile the range without gaps and each stays inside one UTC day."""
        cases = [
            (
                datetime.datetime(2026, 7, 23, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 26, tzinfo=datetime.UTC),
            ),
            (
                datetime.datetime(2026, 7, 23, 14, 30, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 26, tzinfo=datetime.UTC),
            ),
            (
                datetime.datetime(2026, 7, 23, 14, 30, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 25, 9, 15, tzinfo=datetime.UTC),
            ),
            (
                datetime.datetime(2026, 7, 23, 3, tzinfo=datetime.UTC),
                datetime.datetime(2026, 7, 23, 6, tzinfo=datetime.UTC),
            ),
        ]
        for range_start, range_end in cases:
            windows = day_aligned_windows(range_start, range_end)

            assert windows[0][0] == range_start
            assert windows[-1][1] == range_end
            for start, end in windows:
                assert start < end
                assert start.date() == (end - datetime.timedelta(microseconds=1)).date()
            for earlier, later in zip(windows, windows[1:]):
                assert earlier[1] == later[0]

    def test_datetime_as_start_of_day_conditions_bound_the_days_a_range_touches(self) -> None:
        """Test a range is restated as its first and last UTC day, whatever its width."""
        day = datetime.datetime(2025, 6, 2, tzinfo=datetime.UTC)
        next_day = day + datetime.timedelta(days=1)
        start_of_day = Function("toStartOfDay", parameters=[Column("timestamp")])

        # A whole day bounds that day from both sides, which the index reads as an equality.
        assert datetime_as_start_of_day_conditions(day, next_day) == [
            Condition(start_of_day, Op.GTE, day),
            Condition(start_of_day, Op.LTE, day),
        ]
        # So does any range inside it.
        assert datetime_as_start_of_day_conditions(
            day + datetime.timedelta(hours=3), day + datetime.timedelta(hours=20)
        ) == [
            Condition(start_of_day, Op.GTE, day),
            Condition(start_of_day, Op.LTE, day),
        ]
        # A range crossing midnight bounds both days rather than giving up on the sort key.
        assert datetime_as_start_of_day_conditions(
            day + datetime.timedelta(hours=3), next_day + datetime.timedelta(hours=3)
        ) == [
            Condition(start_of_day, Op.GTE, day),
            Condition(start_of_day, Op.LTE, next_day),
        ]
        # `end` is exclusive, so ending exactly at midnight must not reach that day.
        assert datetime_as_start_of_day_conditions(day, day + datetime.timedelta(days=2)) == [
            Condition(start_of_day, Op.GTE, day),
            Condition(start_of_day, Op.LTE, next_day),
        ]

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_time_window_with_pagination(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test pagination within a time window followed by advancing to the next window."""
        range_start = datetime.datetime(2025, 6, 1, tzinfo=datetime.UTC)
        range_end = datetime.datetime(2025, 6, 3, tzinfo=datetime.UTC)
        job = ReplayDeletionJobModel.objects.create(
            organization_id=self.project.organization.id,
            project_id=self.project.id,
            range_start=range_start,
            range_end=range_end,
            query="",
            environments=["prod"],
            status="pending",
        )

        def row_generator() -> Generator[MatchedRows]:
            # Window 1, page 1: has_more=True triggers pagination within the same window
            yield {
                "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
                "has_more": True,
                "next_cursor": 1234,
            }
            # Window 1, page 2: no more rows, advance to next window
            yield {
                "rows": [{"retention_days": 90, "replay_id": "b", "max_segment_id": 1}],
                "has_more": False,
                "next_cursor": 1234,
            }
            # Window 2: final window
            yield {
                "rows": [],
                "has_more": False,
                "next_cursor": 1234,
            }

        mock_fetch_rows.side_effect = row_generator()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(job.id, limit=1)

        job.refresh_from_db()
        assert job.status == "completed"
        assert mock_fetch_rows.call_count == 3
        # 2 replays deleted across windows (window 1 page 1 + page 2), window 2 had 0.
        assert job.offset == 2
        # range_start must never be mutated — the API always returns the original value.
        assert job.range_start == range_start

        calls = mock_fetch_rows.call_args_list
        midnight_2 = datetime.datetime(2025, 6, 2, tzinfo=datetime.UTC)
        # Window 1, page 1 — no cursor yet
        assert calls[0].kwargs["start"] == range_start
        assert calls[0].kwargs["end"] == midnight_2
        assert calls[0].kwargs["after_replay_id_hash"] is None
        # Window 1, page 2 — seeks from the cursor page 1 returned
        assert calls[1].kwargs["start"] == range_start
        assert calls[1].kwargs["end"] == midnight_2
        assert calls[1].kwargs["after_replay_id_hash"] == 1234
        # Window 2 — cursor reset, because it is a position within a window's result set
        assert calls[2].kwargs["start"] == midnight_2
        assert calls[2].kwargs["end"] == range_end
        assert calls[2].kwargs["after_replay_id_hash"] is None

    @patch("requests.post")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_has_seer_data_false(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock, mock_post: MagicMock
    ) -> None:
        def row_generator() -> Generator[MatchedRows]:
            yield {
                "rows": [
                    {
                        "retention_days": 90,
                        "replay_id": "a",
                        "max_segment_id": 1,
                    },
                    {
                        "retention_days": 90,
                        "replay_id": "b",
                        "max_segment_id": 0,
                    },
                ],
                "has_more": True,
                "next_cursor": 1234,
            }
            yield {
                "rows": [
                    {
                        "retention_days": 90,
                        "replay_id": "c",
                        "max_segment_id": 1,
                    },
                ],
                "has_more": False,
                "next_cursor": 1234,
            }

        mock_fetch_rows.side_effect = row_generator()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, limit=2, has_seer_data=False)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 3

        assert mock_post.call_count == 0
