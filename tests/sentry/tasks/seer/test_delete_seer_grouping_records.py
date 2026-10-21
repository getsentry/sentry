from time import time
from unittest.mock import MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.tasks.seer.delete_seer_grouping_records import (
    delete_seer_grouping_records_by_hash,
    may_schedule_task_to_delete_hashes_from_seer,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context, viewer_context_scope


@django_db_all
class TestDeleteSeerGroupingRecordsByHash(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Needed for may_schedule_task_to_delete_hashes_from_seer to allow the task to be scheduled
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

    def _setup_groups_and_hashes(self, number_of_groups: int = 5) -> list[str]:
        expected_hashes = []
        for i in range(number_of_groups):
            group = self.create_group(project=self.project)
            group_hash = GroupHash.objects.create(
                project=self.project, hash=f"{i:032d}", group=group
            )
            expected_hashes.append(group_hash.hash)
        return expected_hashes

    @patch(
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_simple(self, mock_apply_async: MagicMock) -> None:
        """
        Test that it correctly collects hashes and schedules a task.
        """
        expected_hashes = self._setup_groups_and_hashes(number_of_groups=5)

        may_schedule_task_to_delete_hashes_from_seer(self.project.id, expected_hashes)

        # Verify that the task was called with the correct parameters
        mock_apply_async.assert_called_once_with(args=[self.project.id, expected_hashes, 0])

    def test_chunked(self) -> None:
        """
        Test that it chunks large numbers of hashes
        into separate tasks with a maximum of batch_size hashes per task.
        """
        batch_size = 10
        with (
            patch(
                "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
            ) as mock_apply_async,
            self.options({"embeddings-grouping.seer.delete-record-batch-size": batch_size}),
        ):
            # Create 15 group hashes to test chunking (10 + 5 with batch size of 10)
            expected_hashes = self._setup_groups_and_hashes(batch_size + 5)

            may_schedule_task_to_delete_hashes_from_seer(self.project.id, expected_hashes)

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
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_group_without_hashes(self, mock_apply_async: MagicMock) -> None:
        group = self.create_group(project=self.project)
        hashes = GroupHash.objects.filter(group=group).values_list("hash", flat=True).all()
        may_schedule_task_to_delete_hashes_from_seer(self.project.id, list(hashes))
        mock_apply_async.assert_not_called()

    @patch(
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_no_group_ids(self, mock_apply_async: MagicMock) -> None:
        """
        Test that when no group ids are provided, the task is not scheduled.
        """
        may_schedule_task_to_delete_hashes_from_seer(self.project.id, [])
        mock_apply_async.assert_not_called()

    @patch("sentry.tasks.seer.delete_seer_grouping_records.call_seer_to_delete_these_hashes")
    def test_seer_call_preserves_viewer_context(self, mock_seer_call: MagicMock) -> None:
        hashes = self._setup_groups_and_hashes(number_of_groups=1)
        expected_context = ViewerContext(
            organization_id=self.organization.id,
            project_id=self.project.id,
            user_id=self.user.id,
            actor_type=ActorType.USER,
        )

        def assert_viewer_context(_project_id: int, _hashes: list[str]) -> None:
            assert get_viewer_context() == expected_context

        mock_seer_call.side_effect = assert_viewer_context

        with viewer_context_scope(expected_context):
            delete_seer_grouping_records_by_hash(self.project.id, hashes)

        mock_seer_call.assert_called_once_with(self.project.id, hashes)
        assert get_viewer_context() is None

    @patch("sentry.tasks.seer.delete_seer_grouping_records.call_seer_to_delete_these_hashes")
    def test_missing_project_still_calls_seer_with_propagated_context(
        self, mock_seer_call: MagicMock
    ) -> None:
        missing_project_id = self.project.id + 1_000_000_000
        expected_context = ViewerContext(
            organization_id=self.organization.id,
            project_id=missing_project_id,
            user_id=self.user.id,
            actor_type=ActorType.USER,
        )

        def assert_viewer_context(_project_id: int, _hashes: list[str]) -> None:
            assert get_viewer_context() == expected_context

        mock_seer_call.side_effect = assert_viewer_context

        with viewer_context_scope(expected_context):
            delete_seer_grouping_records_by_hash(missing_project_id, ["hash"])

        mock_seer_call.assert_called_once_with(missing_project_id, ["hash"])
        assert get_viewer_context() is None

    @patch(
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_called_task_with_too_many_hashes(self, mock_apply_async: MagicMock) -> None:
        """This tests the built-in logic of spreading hashes across multiple tasks."""
        batch_size = 5
        expected_context = ViewerContext(
            organization_id=self.organization.id,
            project_id=self.project.id,
            user_id=self.user.id,
            actor_type=ActorType.USER,
        )

        def assert_viewer_context(*_args: object, **_kwargs: object) -> None:
            assert get_viewer_context() == expected_context

        mock_apply_async.side_effect = assert_viewer_context

        with (
            self.options({"embeddings-grouping.seer.delete-record-batch-size": batch_size}),
            viewer_context_scope(expected_context),
        ):
            # Create 11 group hashes to test chunking (5 + 5 + 1 with batch size of 5)
            expected_hashes = self._setup_groups_and_hashes(batch_size + batch_size + 1)
            # Call function directly rather than scheduling a task
            delete_seer_grouping_records_by_hash(self.project.id, expected_hashes, 0)

            # Verify the first chunk has batch_size hashes
            first_call_args = mock_apply_async.call_args_list[0][1]["args"]
            assert len(first_call_args[1]) == batch_size
            assert first_call_args[0] == self.project.id
            first_chunk = expected_hashes[0:batch_size]
            assert first_call_args[1] == first_chunk
            assert first_call_args[2] == 0

            # Verify the second chunk has batch_size hashes
            second_call_args = mock_apply_async.call_args_list[1][1]["args"]
            assert len(second_call_args[1]) == batch_size
            assert second_call_args[0] == self.project.id
            second_chunk = expected_hashes[batch_size : (batch_size * 2)]
            assert second_call_args[1] == second_chunk
            assert second_call_args[2] == 0

            # Verify the third chunk has 1 hash (remainder)
            third_call_args = mock_apply_async.call_args_list[2][1]["args"]
            assert len(third_call_args[1]) == 1
            assert third_call_args[0] == self.project.id
            third_chunk = expected_hashes[(batch_size * 2) :]
            assert third_call_args[1] == third_chunk
            assert third_call_args[2] == 0

            # Make sure the hashes add up to the expected hashes
            assert first_chunk + second_chunk + third_chunk == expected_hashes

    @patch(
        "sentry.tasks.seer.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_does_not_schedule_task_if_missing_option(self, mock_apply_async: MagicMock) -> None:
        """
        Test that when the project option is not set, the task is not scheduled.
        """
        self.project.delete_option("sentry:similarity_backfill_completed")
        expected_hashes = self._setup_groups_and_hashes(number_of_groups=5)
        may_schedule_task_to_delete_hashes_from_seer(self.project.id, expected_hashes)
        assert mock_apply_async.call_count == 0
