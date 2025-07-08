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

    @patch("sentry.tasks.delete_seer_grouping_records.killswitch_enabled")
    @patch("sentry.tasks.delete_seer_grouping_records.options")
    @patch("sentry.tasks.delete_seer_grouping_records.GroupHash.objects.filter")
    @patch("sentry.tasks.delete_seer_grouping_records.Group.objects.get")
    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_call_delete_seer_grouping_records_by_hash_chunked(
        self, mock_apply_async: MagicMock, mock_group_get: MagicMock,
        mock_grouphash_filter: MagicMock, mock_options: MagicMock,
        mock_killswitch_enabled: MagicMock
    ) -> None:
        """
        Test that call_delete_seer_grouping_records_by_hash chunks large numbers of hashes
        into separate tasks with a maximum of 1000 hashes per task.
        """
        # Mock killswitch and options
        mock_killswitch_enabled.return_value = False
        mock_options.get.return_value = False

        # Mock project
        mock_project = MagicMock()
        mock_project.id = 1
        mock_project.get_option.return_value = int(time())

        # Mock group
        mock_group = MagicMock()
        mock_group.project = mock_project
        mock_group_get.return_value = mock_group

        # Mock 2500 group hashes
        mock_group_hashes = []
        for i in range(2500):
            mock_hash = MagicMock()
            mock_hash.hash = str(i) * 32
            mock_group_hashes.append(mock_hash)
        mock_grouphash_filter.return_value = mock_group_hashes

        # Use fake group IDs
        group_ids = list(range(1, 2501))

        call_delete_seer_grouping_records_by_hash(group_ids)

        # Verify that the task was called 3 times (2500 hashes / 1000 per chunk = 3 chunks)
        assert mock_apply_async.call_count == 3

        # Verify the first chunk has 1000 hashes
        first_call_args = mock_apply_async.call_args_list[0][1]["args"]
        assert len(first_call_args[1]) == 1000
        assert first_call_args[0] == 1
        assert first_call_args[2] == 0

        # Verify the second chunk has 1000 hashes
        second_call_args = mock_apply_async.call_args_list[1][1]["args"]
        assert len(second_call_args[1]) == 1000
        assert second_call_args[0] == 1
        assert second_call_args[2] == 0

        # Verify the third chunk has 500 hashes (remainder)
        third_call_args = mock_apply_async.call_args_list[2][1]["args"]
        assert len(third_call_args[1]) == 500
        assert third_call_args[0] == 1
        assert third_call_args[2] == 0
