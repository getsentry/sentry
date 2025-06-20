from __future__ import annotations

from unittest.mock import patch

from sentry.replays.tasks import delete_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase


class TestDeleteReplay(APITestCase, ReplaysSnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project(name="test_project")
        self.replay_id = "test-replay-id"
        self.max_segment_id = 5
        self.retention_days = 30

    @patch("sentry.replays.tasks.delete_matched_rows")
    def test_delete_replay_single(self, mock_delete_matched_rows):
        """Test that delete_replay calls delete_matched_rows with correct parameters"""
        delete_replay(
            retention_days=self.retention_days,
            project_id=self.project.id,
            replay_id=self.replay_id,
            max_segment_id=self.max_segment_id,
        )

        mock_delete_matched_rows.assert_called_once_with(
            project_id=self.project.id,
            rows=[
                {
                    "max_segment_id": self.max_segment_id,
                    "replay_id": self.replay_id,
                    "retention_days": self.retention_days,
                }
            ],
        )
