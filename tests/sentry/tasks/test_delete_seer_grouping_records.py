from time import time
from unittest.mock import MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.tasks.delete_seer_grouping_records import (
    call_delete_seer_grouping_records_by_hash,
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
                project=self.project, hash=str(i) * 32, group_id=group.id
            )
            expected_hashes.append(group_hash.hash)

        call_delete_seer_grouping_records_by_hash(group_ids)

        # Verify that the task was called with the correct parameters
        mock_apply_async.assert_called_once_with(args=[self.project.id, expected_hashes, 0])

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
