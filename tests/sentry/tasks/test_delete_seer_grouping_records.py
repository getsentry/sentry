from time import time
from unittest.mock import MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.tasks.delete_seer_grouping_records import (
    BATCH_SIZE,
    call_delete_seer_grouping_records_by_hash,
    call_seer_delete_project_grouping_records,
    delete_seer_grouping_records_by_hash,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestDeleteSeerGroupingRecordsByHash(TestCase):
    @patch("sentry.tasks.delete_seer_grouping_records.delete_grouping_records_by_hash")
    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_delete_seer_grouping_records_by_hash_batches(
        self,
        mock_delete_seer_grouping_records_by_hash_apply_async: MagicMock,
        mock_delete_grouping_records_by_hash: MagicMock,
    ) -> None:
        """
        Test that when delete_seer_grouping_records_by_hash is called with over 20 hashes, it spawns
        another task with the end index of the previous batch.
        """
        mock_delete_grouping_records_by_hash.return_value = True
        project_id, hashes = 1, [str(i) for i in range(101)]
        delete_seer_grouping_records_by_hash(project_id, hashes, 0)
        assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
            "args": [project_id, hashes, 100]
        }

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_call_delete_seer_grouping_records_by_hash_simple(
        self, mock_apply_async: MagicMock
    ) -> None:
        """
        Test that call_delete_seer_grouping_records_by_hash correctly collects hashes
        and calls the deletion task with the expected parameters.
        """
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        group_ids, expected_hashes = [], []
        for i in range(5):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
            group_hash = GroupHash.objects.create(
                project=self.project, hash=f"{i:032d}", group=group
            )
            expected_hashes.append(group_hash.hash)

        call_delete_seer_grouping_records_by_hash(group_ids)

        # Verify that the task was called with the correct parameters
        mock_apply_async.assert_called_once_with(args=[self.project.id, expected_hashes, 0])

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_call_delete_seer_grouping_records_by_hash_chunked(
        self, mock_apply_async: MagicMock
    ) -> None:
        """
        Test that call_delete_seer_grouping_records_by_hash chunks large numbers of hashes
        into separate tasks with a maximum of 1000 hashes per task.
        """
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        # Create 1500 group hashes to test chunking
        group_ids, expected_hashes = [], []
        for i in range(BATCH_SIZE + 500):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
            group_hash = GroupHash.objects.create(
                project=self.project, hash=f"{i:032d}", group=group
            )
            expected_hashes.append(group_hash.hash)

        call_delete_seer_grouping_records_by_hash(group_ids)

        # Verify that the task was called 2 times (1500 hashes / 1000 per chunk = 2 chunks)
        assert mock_apply_async.call_count == 2

        # Verify the first chunk has 1000 hashes
        first_call_args = mock_apply_async.call_args_list[0][1]["args"]
        assert len(first_call_args[1]) == 1000
        assert first_call_args[0] == self.project.id
        assert first_call_args[2] == 0

        # Verify the second chunk has 500 hashes (remainder)
        second_call_args = mock_apply_async.call_args_list[1][1]["args"]
        assert len(second_call_args[1]) == 500
        assert second_call_args[0] == self.project.id
        assert second_call_args[2] == 0

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_call_delete_seer_grouping_records_by_hash_no_hashes(
        self, mock_apply_async: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        group_ids = []
        for _ in range(5):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
        call_delete_seer_grouping_records_by_hash(group_ids)
        mock_apply_async.assert_not_called()

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_call_delete_seer_grouping_records_by_hash_no_group_ids(
        self, mock_apply_async: MagicMock
    ) -> None:
        call_delete_seer_grouping_records_by_hash([])
        mock_apply_async.assert_not_called()

    @patch("sentry.tasks.delete_seer_grouping_records.delete_project_grouping_records")
    def test_call_delete_project_and_delete_grouping_records(
        self, mock_delete_project_grouping_records: MagicMock
    ) -> None:
        call_seer_delete_project_grouping_records(self.project.id)
        mock_delete_project_grouping_records.assert_called_once()
