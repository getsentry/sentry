from time import time
from unittest.mock import patch

from sentry.models.grouphash import GroupHash
from sentry.tasks.delete_seer_grouping_records import (
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
        mock_delete_seer_grouping_records_by_hash_apply_async,
        mock_delete_grouping_records_by_hash,
    ):
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

    @patch("sentry.tasks.delete_seer_grouping_records.logger")
    def test_call_delete_seer_grouping_records_by_hash_simple(self, mock_logger):
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        group_ids, hashes = [], []
        for i in range(5):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
            group_hash = GroupHash.objects.create(
                project=self.project, hash=str(i) * 32, group_id=group.id
            )
            hashes.append(group_hash.hash)
        call_delete_seer_grouping_records_by_hash(group_ids)
        mock_logger.info.assert_called_with(
            "calling seer record deletion by hash",
            extra={"project_id": self.project.id, "hashes": hashes},
        )

    @patch("sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash")
    @patch("sentry.tasks.delete_seer_grouping_records.logger")
    def test_call_delete_seer_grouping_records_by_hash_no_hashes(
        self, mock_logger, mock_delete_seer_grouping_records_by_hash
    ):
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        group_ids = []
        for _ in range(5):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
        call_delete_seer_grouping_records_by_hash(group_ids)
        mock_logger.info.assert_called_with(
            "calling seer record deletion by hash",
            extra={"project_id": self.project.id, "hashes": []},
        )
        mock_delete_seer_grouping_records_by_hash.assert_not_called()

    @patch("sentry.tasks.delete_seer_grouping_records.logger")
    def test_call_delete_seer_grouping_records_by_hash_no_group_ids(self, mock_logger):
        call_delete_seer_grouping_records_by_hash([])
        mock_logger.info.assert_not_called()

    @patch("sentry.tasks.delete_seer_grouping_records.delete_project_grouping_records")
    def test_call_delete_project_and_delete_grouping_records(
        self, mock_delete_project_grouping_records
    ):
        call_seer_delete_project_grouping_records(self.project.id)
        mock_delete_project_grouping_records.assert_called_once()
