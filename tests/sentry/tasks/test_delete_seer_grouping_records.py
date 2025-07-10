from time import time
from unittest.mock import MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.tasks.delete_seer_grouping_records import call_delete_seer_grouping_records_by_hash
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestDeleteSeerGroupingRecordsByHash(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Needed for call_delete_seer_grouping_records_by_hash to allow the task to be scheduled
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

    def _setup_groups_and_hashes(self, number_of_groups: int = 5) -> tuple[list[int], list[str]]:
        group_ids, expected_hashes = [], []
        for i in range(number_of_groups):
            group = self.create_group(project=self.project)
            group_ids.append(group.id)
            group_hash = GroupHash.objects.create(
                project=self.project, hash=f"{i:032d}", group=group
            )
            expected_hashes.append(group_hash.hash)
        return group_ids, expected_hashes

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_does_not_schedule_task_if_missing_option(self, mock_apply_async: MagicMock) -> None:
        """
        Test that when the project option is not set, the task is not scheduled.
        """
        self.project.delete_option("sentry:similarity_backfill_completed")
        group_ids, _ = self._setup_groups_and_hashes(number_of_groups=5)
        call_delete_seer_grouping_records_by_hash(group_ids)
        assert mock_apply_async.call_count == 0

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_simple(self, mock_apply_async: MagicMock) -> None:
        """
        Test that call_delete_seer_grouping_records_by_hash correctly collects hashes
        and calls the deletion task with the expected parameters.
        """
        group_ids, expected_hashes = self._setup_groups_and_hashes(number_of_groups=5)

        call_delete_seer_grouping_records_by_hash(group_ids)

        # Verify that the task was called with the correct parameters
        mock_apply_async.assert_called_once_with(args=[self.project.id, expected_hashes, 0])

    def test_chunked(self) -> None:
        """
        Test that call_delete_seer_grouping_records_by_hash chunks large numbers of hashes
        into separate tasks with a maximum of batch_size hashes per task.
        """
        batch_size = 10
        with (
            patch(
                "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
            ) as mock_apply_async,
            self.options({"embeddings-grouping.seer.delete-record-batch-size": batch_size}),
        ):
            # Create 15 group hashes to test chunking (10 + 5 with batch size of 10)
            group_ids, expected_hashes = self._setup_groups_and_hashes(batch_size + 5)

            call_delete_seer_grouping_records_by_hash(group_ids)

            # Verify that the task was called 2 times (15 hashes / 10 per chunk = 2 chunks)
            assert mock_apply_async.call_count == 2

            # Verify the first chunk has batch_size hashes
            first_call_args = mock_apply_async.call_args_list[0][1]["args"]
            assert len(first_call_args[1]) == batch_size
            assert first_call_args[0] == self.project.id
            assert first_call_args[1] == expected_hashes[0:batch_size]
            assert first_call_args[2] == 0

            # Verify the second chunk has 5 hashes (remainder)
            second_call_args = mock_apply_async.call_args_list[1][1]["args"]
            assert len(second_call_args[1]) == 5
            assert second_call_args[0] == self.project.id
            assert second_call_args[1] == expected_hashes[batch_size:]
            assert second_call_args[2] == 0

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_no_hashes(self, mock_apply_async: MagicMock) -> None:
        group_ids, _ = self._setup_groups_and_hashes(number_of_groups=5)
        call_delete_seer_grouping_records_by_hash(group_ids)
        mock_apply_async.assert_not_called()

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_no_group_ids(self, mock_apply_async: MagicMock) -> None:
        """
        Test that when no group ids are provided, the task is not scheduled.
        """
        call_delete_seer_grouping_records_by_hash([])
        mock_apply_async.assert_not_called()
