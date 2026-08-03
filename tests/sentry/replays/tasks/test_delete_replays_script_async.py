from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

from sentry.replays.tasks import delete_replays_script_async
from sentry.testutils.cases import TestCase


class TestDeleteReplaysScriptAsync(TestCase):
    @patch("sentry.replays.tasks._delete_if_exists")
    def test_deletes_inclusive_of_top_segment(self, mock_delete: object) -> None:
        replay_id = uuid4().hex

        with patch("sentry.replays.tasks.make_recording_filename", side_effect=lambda s: str(s)):
            delete_replays_script_async(
                retention_days=90,
                project_id=self.project.id,
                replay_id=replay_id,
                max_segment_id=3,
            )

        # Segments 0, 1, 2, and 3 must all be scheduled for deletion. An exclusive range would
        # leave segment 3 (the top segment) behind.
        assert mock_delete.call_count == 4  # type: ignore[attr-defined]

    @patch("sentry.replays.tasks._delete_if_exists")
    def test_null_max_segment_id_is_a_no_op(self, mock_delete: object) -> None:
        replay_id = uuid4().hex

        delete_replays_script_async(
            retention_days=90,
            project_id=self.project.id,
            replay_id=replay_id,
            max_segment_id=None,
        )

        assert mock_delete.call_count == 0  # type: ignore[attr-defined]
