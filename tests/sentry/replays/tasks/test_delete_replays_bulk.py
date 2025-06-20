from __future__ import annotations

import datetime
import uuid
from unittest.mock import patch

from sentry.replays.models import ReplayDeletionJobModel
from sentry.replays.tasks import run_bulk_replay_delete_job
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner


class TestDeleteReplaysBulk(APITestCase, ReplaysSnubaTestCase):
    def setUp(self):
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
    def test_run_bulk_replay_delete_job_first_run(self, mock_delete_matched_rows, mock_fetch_rows):
        """Test the first run of the bulk deletion job"""
        # Mock the fetch_rows_matching_pattern to return some rows
        mock_fetch_rows.return_value = {
            "rows": [
                {
                    "retention_days": 90,
                    "replay_id": "a",
                    "max_segment_id": 1,
                    "platform": "javascript",
                },
                {
                    "retention_days": 90,
                    "replay_id": "b",
                    "max_segment_id": 0,
                    "platform": "javascript",
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
    def test_run_bulk_replay_delete_job_completion(self, mock_delete_matched_rows, mock_fetch_rows):
        """Test the completion of the bulk deletion job"""
        # Mock the fetch_rows_matching_pattern to return no more rows
        mock_fetch_rows.return_value = {
            "rows": [
                {
                    "retention_days": 90,
                    "replay_id": "a",
                    "max_segment_id": 1,
                    "platform": "javascript",
                },
                {
                    "retention_days": 90,
                    "replay_id": "b",
                    "max_segment_id": None,
                    "platform": "javascript",
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
    def test_run_bulk_replay_delete_job_no_rows(self, mock_delete_matched_rows, mock_fetch_rows):
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

    def test_run_bulk_replay_delete_job_chained_runs(self):
        t1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay_id1 = uuid.uuid4().hex
        replay_id2 = uuid.uuid4().hex
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id1, segment_id=0, environment="prod")
        )
        self.store_replays(
            mock_replay(t1, self.project.id, replay_id2, segment_id=0, environment="prod")
        )

        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, offset=0, limit=1)

        # Runs were chained.
        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 2

    def test_run_bulk_replay_delete_job_no_matches(self):
        with TaskRunner():
            run_bulk_replay_delete_job.delay(self.job.id, offset=0)

        self.job.refresh_from_db()
        assert self.job.status == "completed"
        assert self.job.offset == 0
