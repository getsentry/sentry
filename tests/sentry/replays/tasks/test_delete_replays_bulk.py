from __future__ import annotations

import datetime
import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel
from sentry.replays.tasks import run_bulk_replay_delete_job
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.delete import (
    MatchedRows,
    fetch_rows_matching_pattern,
)
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner
from sentry.utils.snuba import RateLimitExceeded, SnubaError


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

    @patch("sentry.replays.tasks.current_task")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_error_with_retries_remaining(
        self, mock_fetch_rows: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """An error on a non-terminal attempt re-raises without failing the job."""
        mock_fetch_rows.side_effect = SnubaError("read timed out")
        mock_current_task.return_value = Mock(retries_remaining=True)

        with pytest.raises(SnubaError):
            run_bulk_replay_delete_job(self.job.id, offset=0)

        # The job is still runnable so the worker's retry is not a no-op.
        self.job.refresh_from_db()
        assert self.job.status == DeletionJobStatus.IN_PROGRESS

    @patch("sentry.replays.tasks.current_task")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_error_on_final_attempt(
        self, mock_fetch_rows: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """An error on the terminal attempt marks the job failed."""
        mock_fetch_rows.side_effect = SnubaError("read timed out")
        mock_current_task.return_value = Mock(retries_remaining=False)

        with pytest.raises(SnubaError):
            run_bulk_replay_delete_job(self.job.id, offset=0)

        self.job.refresh_from_db()
        assert self.job.status == DeletionJobStatus.FAILED

    @patch("sentry.replays.tasks.current_task")
    @patch("sentry.replays.tasks.fetch_rows_matching_pattern")
    def test_run_bulk_replay_delete_job_error_without_task_context(
        self, mock_fetch_rows: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """An error with no task context (direct call) marks the job failed."""
        mock_fetch_rows.side_effect = SnubaError("read timed out")
        mock_current_task.return_value = None

        with pytest.raises(SnubaError):
            run_bulk_replay_delete_job(self.job.id, offset=0)

        self.job.refresh_from_db()
        assert self.job.status == DeletionJobStatus.FAILED

    @patch("sentry.utils.retries.time.sleep")
    @patch("sentry.replays.usecases.delete.execute_query")
    def test_fetch_rows_matching_pattern_retries_snuba_errors(
        self, mock_execute_query: MagicMock, mock_sleep: MagicMock
    ) -> None:
        """Transient Snuba errors are retried; the query succeeds on a later attempt."""
        mock_execute_query.side_effect = [
            SnubaError("read timed out"),
            RateLimitExceeded("rate limited"),
            {"data": []},
        ]

        result = fetch_rows_matching_pattern(
            self.project.id,
            self.range_start,
            self.range_end,
            query="",
            environment=["prod"],
            limit=50,
            offset=0,
        )

        assert result == {"has_more": False, "rows": []}
        assert mock_execute_query.call_count == 3

        # Snuba allocation policies key quotas on organization_id.
        tenant_ids = mock_execute_query.call_args[0][1]
        assert tenant_ids == {"organization_id": self.project.organization.id}

    @patch("sentry.utils.retries.time.sleep")
    @patch("sentry.replays.usecases.delete.execute_query")
    def test_fetch_rows_matching_pattern_retries_exhausted(
        self, mock_execute_query: MagicMock, mock_sleep: MagicMock
    ) -> None:
        """After the maximum number of attempts the error is raised to the caller."""
        mock_execute_query.side_effect = SnubaError("read timed out")

        with pytest.raises(SnubaError):
            fetch_rows_matching_pattern(
                self.project.id,
                self.range_start,
                self.range_end,
                query="",
                environment=["prod"],
                limit=50,
                offset=0,
            )

        assert mock_execute_query.call_count == 5

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
