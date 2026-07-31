from __future__ import annotations

import datetime
import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, Mock, patch

import pytest
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel
from sentry.replays.tasks import run_bulk_replay_delete_job
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.delete import (
    MatchedRows,
    fetch_rows_matching_pattern,
)
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner


class TestDeleteReplaysBulk(APITestCase, ReplaysSnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(name="test_project")
        self.range_start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=1)
        self.range_end = datetime.datetime.now(tz=datetime.UTC)
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

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_first_run(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
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
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id, offset=0)

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
            offset=0,
        )

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_completion(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
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
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id, offset=100)

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
            offset=100,
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
        }

        # Run the job
        run_bulk_replay_delete_job(self.job.id, offset=0)

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
            offset=0,
        )

    def test_run_bulk_replay_delete_job_chained_runs(self) -> None:
        project = self.create_project()

        t1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
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
            run_bulk_replay_delete_job.delay(self.job.id, offset=0, limit=1)

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
            run_bulk_replay_delete_job.delay(self.job.id, offset=0, limit=0)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "failed"
        assert self.job.offset == 0

    def test_run_bulk_replay_delete_job_no_matches(self) -> None:
        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, offset=0)

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
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 300
        self.job.save()

        with patch.object(run_bulk_replay_delete_job, "delay"):
            run_bulk_replay_delete_job(self.job.id, offset=100)

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
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 100
        self.job.save()

        run_bulk_replay_delete_job(self.job.id, offset=0)

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
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        def advance_checkpoint(*args: object, **kwargs: object) -> None:
            ReplayDeletionJobModel.objects.filter(id=self.job.id).update(offset=500)

        mock_delete_matched_rows.side_effect = advance_checkpoint

        run_bulk_replay_delete_job(self.job.id, offset=0)

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
                run_bulk_replay_delete_job(self.job.id, offset=0)

        self.job.refresh_from_db()
        assert self.job.status == "in-progress"

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_deadline_exceeded_without_retries(
        self, mock_fetch_rows: MagicMock
    ) -> None:
        """Test the job is failed rather than stalled when deadline retries run out"""
        mock_fetch_rows.side_effect = ProcessingDeadlineExceeded()

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        with patch("sentry.replays.tasks.current_task", return_value=Mock(retries_remaining=0)):
            with pytest.raises(ProcessingDeadlineExceeded):
                run_bulk_replay_delete_job(self.job.id, offset=0)

        self.job.refresh_from_db()
        assert self.job.status == "failed"

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_failure_preserves_offset(
        self, mock_fetch_rows: MagicMock
    ) -> None:
        """Test a failure records the status without reverting the checkpoint"""
        mock_fetch_rows.side_effect = ValueError("snuba is unhappy")

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.offset = 200
        self.job.save()

        with pytest.raises(ValueError):
            run_bulk_replay_delete_job(self.job.id, offset=200)

        self.job.refresh_from_db()
        assert self.job.status == "failed"
        assert self.job.offset == 200

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_does_not_resurrect_completed_job(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test a chain finishing after another completed the job leaves it completed"""
        mock_fetch_rows.return_value = {
            "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
            "has_more": True,
        }

        self.job.status = DeletionJobStatus.IN_PROGRESS
        self.job.save()

        def complete_job(*args: object, **kwargs: object) -> None:
            ReplayDeletionJobModel.objects.filter(id=self.job.id).update(
                status=DeletionJobStatus.COMPLETED
            )

        mock_delete_matched_rows.side_effect = complete_job

        with patch.object(run_bulk_replay_delete_job, "delay"):
            run_bulk_replay_delete_job(self.job.id, offset=0)

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
            offset=0,
        )
        assert len(result["rows"]) == 1
        assert result["rows"][0]["replay_id"] == str(uuid.UUID(replay_id))

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
            }

        mock_fetch_rows.side_effect = row_generator()

        mock_response = Mock()
        mock_response.status = 204
        mock_make_seer_api_request.return_value = mock_response

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, offset=0, limit=2, has_seer_data=True)

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

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_time_window_chunking(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test that wide date ranges are chunked into 7-day windows."""
        # Create a job spanning 20 days so it requires 3 windows (7 + 7 + 6).
        range_start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=20)
        range_end = datetime.datetime.now(tz=datetime.UTC)
        job = ReplayDeletionJobModel.objects.create(
            organization_id=self.project.organization.id,
            project_id=self.project.id,
            range_start=range_start,
            range_end=range_end,
            query="",
            environments=["prod"],
            status="pending",
        )

        # Each window returns rows with has_more=False so the task advances to the next window.
        def row_generator() -> Generator[MatchedRows]:
            # Window 1: range_start to range_start + 7 days
            yield {
                "rows": [{"retention_days": 90, "replay_id": "a", "max_segment_id": 1}],
                "has_more": False,
            }
            # Window 2: range_start + 7 days to range_start + 14 days
            yield {
                "rows": [{"retention_days": 90, "replay_id": "b", "max_segment_id": 1}],
                "has_more": False,
            }
            # Window 3: range_start + 14 days to range_end
            yield {
                "rows": [{"retention_days": 90, "replay_id": "c", "max_segment_id": 1}],
                "has_more": False,
            }

        mock_fetch_rows.side_effect = row_generator()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(job.id, offset=0, limit=100)

        job.refresh_from_db()
        assert job.status == "completed"
        assert mock_fetch_rows.call_count == 3
        assert mock_delete_matched_rows.call_count == 3
        # countDeleted must reflect all three windows (1 replay each).
        assert job.offset == 3
        # range_start must never be mutated — the API always returns the original value.
        assert job.range_start == range_start

        # Verify each call used the correct window boundaries.
        calls = mock_fetch_rows.call_args_list
        # Window 1
        assert calls[0].kwargs["start"] == range_start
        assert calls[0].kwargs["end"] == range_start + datetime.timedelta(days=7)
        assert calls[0].kwargs["offset"] == 0
        # Window 2
        assert calls[1].kwargs["start"] == range_start + datetime.timedelta(days=7)
        assert calls[1].kwargs["end"] == range_start + datetime.timedelta(days=14)
        assert calls[1].kwargs["offset"] == 0
        # Window 3
        assert calls[2].kwargs["start"] == range_start + datetime.timedelta(days=14)
        assert calls[2].kwargs["end"] == range_end
        assert calls[2].kwargs["offset"] == 0

    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_run_bulk_replay_delete_job_time_window_with_pagination(
        self, mock_delete_matched_rows: MagicMock, mock_fetch_rows: MagicMock
    ) -> None:
        """Test pagination within a time window followed by advancing to the next window."""
        range_start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=10)
        range_end = datetime.datetime.now(tz=datetime.UTC)
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
            }
            # Window 1, page 2: no more rows, advance to next window
            yield {
                "rows": [{"retention_days": 90, "replay_id": "b", "max_segment_id": 1}],
                "has_more": False,
            }
            # Window 2: final window
            yield {
                "rows": [],
                "has_more": False,
            }

        mock_fetch_rows.side_effect = row_generator()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(job.id, offset=0, limit=1)

        job.refresh_from_db()
        assert job.status == "completed"
        assert mock_fetch_rows.call_count == 3
        # 2 replays deleted across windows (window 1 page 1 + page 2), window 2 had 0.
        assert job.offset == 2
        # range_start must never be mutated — the API always returns the original value.
        assert job.range_start == range_start

        calls = mock_fetch_rows.call_args_list
        # Window 1, page 1 — offset 0
        assert calls[0].kwargs["start"] == range_start
        assert calls[0].kwargs["end"] == range_start + datetime.timedelta(days=7)
        assert calls[0].kwargs["offset"] == 0
        # Window 1, page 2 — offset 1
        assert calls[1].kwargs["start"] == range_start
        assert calls[1].kwargs["end"] == range_start + datetime.timedelta(days=7)
        assert calls[1].kwargs["offset"] == 1
        # Window 2 — offset reset to 0
        assert calls[2].kwargs["start"] == range_start + datetime.timedelta(days=7)
        assert calls[2].kwargs["end"] == range_end
        assert calls[2].kwargs["offset"] == 0

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
            }

        mock_fetch_rows.side_effect = row_generator()

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, offset=0, limit=2, has_seer_data=False)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 3

        assert mock_post.call_count == 0
