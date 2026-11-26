from sentry.issues.merge import handle_merge
from sentry.issues.models.issuemergeoperation import (
    IssueMergeOperation,
    OperationStatus,
    OperationStep,
)
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TrackedMergeTest(TestCase, SnubaTestCase):
    def test_track_merge_through_end_message(self) -> None:
        # The survivor already has an event. Only events from the original sources
        # can serve as evidence that their history later reached the survivor.
        original = self.store_event(
            data={"message": "survivor", "timestamp": before_now(days=2).isoformat()},
            project_id=self.project.id,
        )
        survivor = original.group
        assert survivor is not None
        first = self.store_event(
            data={"message": "first source", "timestamp": before_now(hours=1).isoformat()},
            project_id=self.project.id,
        )
        second = self.store_event(
            data={"message": "second source", "timestamp": before_now(hours=1).isoformat()},
            project_id=self.project.id,
        )
        assert first.group is not None and second.group is not None
        empty = self.create_group(project=self.project)
        sources = [first.group, second.group, empty]
        hashes = set(
            GroupHash.objects.filter(project=self.project, group__in=sources).values_list(
                "hash", flat=True
            )
        )
        with self.feature("organizations:issue-merge-operation-tracking"), self.tasks():
            result = handle_merge([survivor, *sources], {self.project.id: self.project}, self.user)

        operation = IssueMergeOperation.objects.get(project=self.project)
        assert result["parent"] == str(survivor.id)
        assert operation.destination_group_id == survivor.id
        assert operation.actor_id == self.user.id
        assert set(operation.source_group_ids) == {source.id for source in sources}
        assert set(operation.source_hashes_at_acceptance) == hashes
        assert operation.batch_cursor == {"completed_source_id": operation.source_group_ids[-1]}
        assert operation.sample_event_ids_by_source == {
            str(first.group_id): first.event_id,
            str(second.group_id): second.event_id,
        }
        assert operation.status == OperationStatus.RUNNING
        assert operation.step == OperationStep.WAIT_FOR_SNUBA
        assert operation.historical_cutoff is not None
