from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.issues.merge_completion import complete_if_events_moved
from sentry.issues.models.issuemergeoperation import OperationStatus, OperationStep
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.snuba import SnubaError


class MergeCompletionTest(TestCase, SnubaTestCase):
    def test_waits_for_sample_from_every_source(self) -> None:
        first_source = self.create_group()
        second_source = self.create_group()
        first = self.store_event(data={"message": "survivor"}, project_id=self.project.id)
        assert first.group_id
        second_event_id = uuid4().hex
        operation = self.create_issue_merge_operation(
            [first_source.id, second_source.id],
            first.group_id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            historical_cutoff=before_now(),
            sample_event_ids_by_source={
                str(first_source.id): first.event_id,
                str(second_source.id): second_event_id,
            },
        )
        assert not complete_if_events_moved(operation)
        second = self.store_event(
            data={"event_id": second_event_id, "message": "survivor"},
            project_id=self.project.id,
        )
        assert second.group_id == first.group_id
        # Model the next poll so Snuba can return a fresh query result.
        with freeze_time(before_now() + timedelta(minutes=5)):
            assert complete_if_events_moved(operation)
        operation.refresh_from_db()
        assert operation.status == OperationStatus.COMPLETE
        with patch("sentry.issues.merge_completion.raw_snql_query") as query:
            assert not complete_if_events_moved(operation)
        query.assert_not_called()

    def test_missing_expired_or_unmoved_sample_stays_pending(self) -> None:
        sample = self.store_event(data={"message": "still on source"}, project_id=self.project.id)
        assert sample.group_id
        destination = self.create_group()
        operation = self.create_issue_merge_operation(
            [sample.group_id],
            destination.id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            historical_cutoff=before_now(),
        )
        with patch("sentry.issues.merge_completion.raw_snql_query") as query:
            assert not complete_if_events_moved(operation)
        query.assert_not_called()
        operation.update(sample_event_ids_by_source={str(sample.group_id): sample.event_id})
        assert not complete_if_events_moved(operation)
        operation.update(sample_event_ids_by_source={str(sample.group_id): uuid4().hex})
        assert not complete_if_events_moved(operation)
        operation.refresh_from_db()
        assert operation.status == OperationStatus.RUNNING

    def test_waits_for_hash_ownership_and_last_matching_source_event(self) -> None:
        remaining = self.store_event(
            data={"message": "still on source"}, project_id=self.project.id
        )
        moved = self.store_event(
            data={"message": "already on destination"}, project_id=self.project.id
        )
        assert remaining.group_id and moved.group_id
        remaining_hash = GroupHash.objects.get(project=self.project, group_id=remaining.group_id)
        moved_hash = GroupHash.objects.get(project=self.project, group_id=moved.group_id)
        operation = self.create_issue_unmerge_operation(
            remaining.group_id,
            [moved_hash.hash, remaining_hash.hash],
            destination_group_id=moved.group_id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            historical_cutoff=before_now(),
        )
        with patch("sentry.issues.merge_completion.raw_snql_query") as query:
            assert not complete_if_events_moved(operation)
        query.assert_not_called()

        remaining_hash.update(group_id=moved.group_id)
        assert not complete_if_events_moved(operation)
        operation.refresh_from_db()
        assert operation.status == OperationStatus.RUNNING

    def test_unmerge_uses_received_time_for_the_cutoff(self) -> None:
        with freeze_time(before_now(days=1)):
            source_event = self.store_event(
                data={"message": "unrelated"}, project_id=self.project.id
            )
            moved = self.store_event(data={"message": "selected"}, project_id=self.project.id)
        assert source_event.group_id and moved.group_id
        selected_hash = GroupHash.objects.get(project=self.project, group_id=moved.group_id)
        selected_hash.update(group_id=source_event.group_id)
        late = self.store_event(
            data={"message": "selected", "timestamp": before_now(days=1).isoformat()},
            project_id=self.project.id,
        )
        assert late.group_id == source_event.group_id
        selected_hash.update(group_id=moved.group_id)
        operation = self.create_issue_unmerge_operation(
            source_event.group_id,
            [selected_hash.hash],
            destination_group_id=moved.group_id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            historical_cutoff=before_now(hours=1),
        )
        assert complete_if_events_moved(operation)
        operation.refresh_from_db()
        assert operation.status == OperationStatus.COMPLETE

    def test_failed_query_preserves_waiting_row(self) -> None:
        source = self.create_group()
        operation = self.create_issue_merge_operation(
            [source.id],
            self.create_group().id,
            status=OperationStatus.RUNNING,
            step=OperationStep.WAIT_FOR_SNUBA,
            historical_cutoff=before_now(),
            sample_event_ids_by_source={str(source.id): uuid4().hex},
        )
        with (
            patch("sentry.issues.merge_completion.raw_snql_query", side_effect=SnubaError),
            pytest.raises(SnubaError),
        ):
            complete_if_events_moved(operation)
        operation.refresh_from_db()
        assert operation.status == OperationStatus.RUNNING
        assert operation.step == OperationStep.WAIT_FOR_SNUBA
        assert operation.retries_without_progress == 0
