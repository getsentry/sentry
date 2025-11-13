import os
import random
from datetime import datetime, timedelta
from time import time
from typing import Any
from unittest import mock
from uuid import uuid4

from snuba_sdk import Column, Condition, DeleteQuery, Entity, Function, Op, Query, Request

from sentry import deletions, nodestore
from sentry.deletions.defaults.group import (
    delete_project_group_hashes,
    update_group_hash_metadata_in_batches,
)
from sentry.deletions.tasks.groups import delete_groups_for_project
from sentry.issues.grouptype import FeedbackGroup, GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupredirect import GroupRedirect
from sentry.models.userreport import UserReport
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.activity import ActivityType
from sentry.utils.snuba import bulk_snuba_queries
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class DeleteGroupTest(TestCase, SnubaTestCase):

    def _generate_data(self, fingerprint: str | None = None) -> dict[str, Any]:
        return {
            "fingerprint": [fingerprint or uuid4().hex],
            "timestamp": before_now(minutes=1).isoformat(),
        }

    def _get_node_id(self, event: Event) -> str:
        return Event.generate_node_id(event.project_id, event.event_id)

    def _create_event_with_many_group_children(self) -> Event:
        event = self.store_event(
            data=self._generate_data(fingerprint="group1"),
            project_id=self.project.id,
        )
        UserReport.objects.create(
            group_id=event.group.id, project_id=event.project_id, name="With group id"
        )
        UserReport.objects.create(
            event_id=event.event_id, project_id=event.project_id, name="With event id"
        )
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            name="hello.png",
            content_type="image/png",
        )
        GroupAssignee.objects.create(group=event.group, project=self.project, user_id=self.user.id)
        GroupHash.objects.create(project=self.project, group=event.group, hash=uuid4().hex)
        GroupMeta.objects.create(group=event.group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=event.group.id, previous_group_id=1)
        Activity.objects.create(
            group=event.group, project=self.project, type=ActivityType.SET_RESOLVED.value
        )

        return event

    def test_delete_group_with_many_related_children(self) -> None:
        event = self._create_event_with_many_group_children()
        assert event.group is not None

        event2 = self.store_event(
            data=self._generate_data(fingerprint="group1"), project_id=self.project.id
        )
        assert event2.group is not None

        assert nodestore.backend.get(self._get_node_id(event))
        assert nodestore.backend.get(self._get_node_id(event2))

        with self.tasks():
            delete_groups_for_project(
                object_ids=[event.group.id], transaction_id=uuid4().hex, project_id=self.project.id
            )

        assert not UserReport.objects.filter(group_id=event.group.id).exists()
        assert not UserReport.objects.filter(event_id=event.event_id).exists()
        assert not EventAttachment.objects.filter(event_id=event.event_id).exists()

        assert not Activity.objects.filter(group_id=event.group.id).exists()
        assert not GroupRedirect.objects.filter(group_id=event.group.id).exists()
        assert not GroupHash.objects.filter(group_id=event.group.id).exists()
        assert not Group.objects.filter(id=event.group.id).exists()
        assert not nodestore.backend.get(self._get_node_id(event))
        assert not nodestore.backend.get(self._get_node_id(event2))

    def test_multiple_groups(self) -> None:
        event = self.store_event(
            data=self._generate_data(fingerprint="group1"),
            project_id=self.project.id,
        )
        assert event.group is not None
        keep_event = self.store_event(
            data=self._generate_data(fingerprint="group2"),
            project_id=self.project.id,
        )
        assert keep_event.group is not None
        other_event = self.store_event(
            data=self._generate_data(fingerprint="group3"),
            project_id=self.project.id,
        )
        assert other_event.group is not None

        with self.tasks():
            delete_groups_for_project(
                object_ids=[event.group.id, other_event.group.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert not Group.objects.filter(id=event.group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self._get_node_id(event))
        assert not nodestore.backend.get(self._get_node_id(other_event))

        assert Group.objects.filter(id=keep_event.group.id).exists()
        assert nodestore.backend.get(self._get_node_id(keep_event))

    def test_grouphistory_relation(self) -> None:
        other_event = self.store_event(
            data=self._generate_data(fingerprint="other_group"),
            project_id=self.project.id,
        )
        other_group = other_event.group
        group = self.event.group
        history_one = self.create_group_history(group=group, status=GroupHistoryStatus.ONGOING)
        history_two = self.create_group_history(
            group=group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history_date=history_one.date_added,
        )
        other_history_one = self.create_group_history(
            group=other_group, status=GroupHistoryStatus.ONGOING
        )
        other_history_two = self.create_group_history(
            group=other_group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history_date=other_history_one.date_added,
        )
        with self.tasks():
            delete_groups_for_project(
                object_ids=[group.id, other_group.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert GroupHistory.objects.filter(id=history_one.id).exists() is False
        assert GroupHistory.objects.filter(id=history_two.id).exists() is False
        assert GroupHistory.objects.filter(id=other_history_one.id).exists() is False
        assert GroupHistory.objects.filter(id=other_history_two.id).exists() is False

    @mock.patch("sentry.services.nodestore.delete_multi")
    def test_cleanup(self, nodestore_delete_multi: mock.Mock) -> None:
        os.environ["_SENTRY_CLEANUP"] = "1"
        try:
            group = self.event.group

            with self.tasks():
                delete_groups_for_project(
                    object_ids=[group.id],
                    transaction_id=uuid4().hex,
                    project_id=self.project.id,
                )

            assert nodestore_delete_multi.call_count == 0
        finally:
            del os.environ["_SENTRY_CLEANUP"]

    @mock.patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_delete_groups_delete_grouping_records_by_hash(
        self, mock_delete_seer_grouping_records_by_hash_apply_async: mock.Mock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))
        event = self.store_event(
            data=self._generate_data(fingerprint="group1"),
            project_id=self.project.id,
        )
        assert event.group
        keep_event = self.store_event(
            data=self._generate_data(fingerprint="group2"),
            project_id=self.project.id,
        )
        assert keep_event.group
        other_event = self.store_event(
            data=self._generate_data(fingerprint="group3"),
            project_id=self.project.id,
        )

        hashes = [
            grouphash.hash
            for grouphash in GroupHash.objects.filter(
                project_id=self.project.id, group_id__in=[event.group.id, other_event.group_id]
            )
        ]

        with self.tasks():
            delete_groups_for_project(
                object_ids=[event.group.id, other_event.group_id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert not Group.objects.filter(id=event.group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self._get_node_id(event))
        assert not nodestore.backend.get(self._get_node_id(other_event))

        assert Group.objects.filter(id=keep_event.group_id).exists()
        assert nodestore.backend.get(self._get_node_id(keep_event))

        assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
            "args": [event.project.id, hashes, 0]
        }

    @mock.patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    def test_invalid_group_type_handling(
        self, mock_delete_seer_grouping_records_by_hash_apply_async: mock.Mock
    ) -> None:
        """
        Test that groups with invalid types are still deleted without causing the entire deletion process to fail.
        """
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))
        error_group = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "fingerprint": ["error-group"]},
            project_id=self.project.id,
        ).group
        invalid_group = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "fingerprint": ["invalid-group"]},
            project_id=self.project.id,
        ).group
        keep_event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "fingerprint": ["keep-group"]},
            project_id=self.project.id,
        )
        keep_group = keep_event.group

        Group.objects.filter(id=invalid_group.id).update(type=10000000)

        error_group_hashes = [
            grouphash.hash
            for grouphash in GroupHash.objects.filter(
                project_id=self.project.id, group_id=error_group.id
            )
        ]

        with self.tasks():
            delete_groups_for_project(
                object_ids=[error_group.id, invalid_group.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert not Group.objects.filter(id__in=[error_group.id, invalid_group.id]).exists()
        assert Group.objects.filter(id=keep_group.id).exists()

        if error_group_hashes:
            assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
                "args": [self.project.id, error_group_hashes, 0]
            }

    def test_delete_grouphashes_and_metadata(self) -> None:
        """
        Test that when deleting group hashes, the group hash metadata is deleted first and the references to the other group hashes are updated.
        """
        # This enables checking Seer for similarity and to mock the call to return a specific grouphash
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        # Create two events/grouphashes and one of them
        # Event A will be deleted
        event_a = self.store_event(
            data={
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "error_a.py"}]},
            },
            project_id=self.project.id,
        )
        grouphash_a = GroupHash.objects.get(group_id=event_a.group_id)
        assert grouphash_a.metadata is not None
        assert grouphash_a.metadata.seer_matched_grouphash is None
        metadata_a_id = grouphash_a.metadata.id

        with mock.patch(
            "sentry.grouping.ingest.seer.get_seer_similar_issues"
        ) as mock_get_seer_similar_issues:
            # This will allow grouphash_b to be matched to grouphash_a by Seer
            mock_get_seer_similar_issues.return_value = (0.01, grouphash_a)

            # Event B will be kept - different exception to ensure different group hash to grouphash_a
            event_b = self.store_event(
                data={
                    "platform": "python",
                    "stacktrace": {"frames": [{"filename": "error_b.py"}]},
                },
                project_id=self.project.id,
            )
            grouphash_b = GroupHash.objects.get(hash=event_b.get_primary_hash())
            assert grouphash_b.metadata is not None
            metadata_b_id = grouphash_b.metadata.id

            # Verify that seer matched event_b to event_a's hash
            assert event_a.group_id == event_b.group_id

            # Make sure it has not changed
            grouphash_a.refresh_from_db()
            assert grouphash_a.metadata is not None
            assert grouphash_a.metadata.seer_matched_grouphash is None
            assert grouphash_b.metadata is not None
            assert grouphash_b.metadata.seer_matched_grouphash == grouphash_a

            with self.tasks():
                # It will delete all groups, group hashes and group hash metadata
                task = deletions.get(model=Group, query={"id__in": [event_a.group_id]})
                more = task.chunk()
                assert not more

            assert not Group.objects.filter(id=event_a.group_id).exists()
            assert not GroupHash.objects.filter(id=grouphash_a.id).exists()
            assert not GroupHashMetadata.objects.filter(id=metadata_a_id).exists()
            assert not GroupHash.objects.filter(id=grouphash_b.id).exists()
            assert not GroupHashMetadata.objects.filter(id=metadata_b_id).exists()

    def test_update_group_hash_metadata_in_batches(self) -> None:
        """
        Test that update_group_hash_metadata_in_batches correctly processes all records
        in batches without getting stuck in an infinite loop, and that it correctly
        updates seer_matched_grouphash to None.
        """
        num_additional_grouphashes = 5
        # Create events with group hashes
        event_a = self.store_event(data={"fingerprint": ["a"]}, project_id=self.project.id)
        grouphash_a = GroupHash.objects.get(group_id=event_a.group_id)

        # Create multiple events with different group hashes that reference grouphash_a
        # This simulates multiple events that were matched to grouphash_a by Seer
        additional_grouphashes = []
        for i in range(num_additional_grouphashes):
            event = self.store_event(data={"fingerprint": [i]}, project_id=self.project.id)
            grouphash = GroupHash.objects.get(hash=event.get_primary_hash())
            if grouphash.metadata is not None:
                # Update the metadata to reference grouphash_a
                grouphash.metadata.seer_matched_grouphash = grouphash_a
                grouphash.metadata.save()
            else:
                raise AssertionError("GroupHashMetadata is None for grouphash id=%s" % grouphash.id)
            additional_grouphashes.append(grouphash)

        # Verify setup: all metadata records should reference grouphash_a
        assert (
            GroupHashMetadata.objects.filter(seer_matched_grouphash_id=grouphash_a.id).count()
            == num_additional_grouphashes
        )

        # Test with a small batch size to force multiple batches
        with mock.patch("sentry.deletions.defaults.group.options.get") as mock_options:
            # Set batch size to 2 to force multiple batches
            mock_options.return_value = 2
            # Call the function to update all metadata that references grouphash_a
            update_group_hash_metadata_in_batches([grouphash_a.id])

        # Verify that all metadata records that referenced grouphash_a now have None
        assert (
            GroupHashMetadata.objects.filter(seer_matched_grouphash_id=grouphash_a.id).count() == 0
        )

        # Verify that the metadata records still exist but with seer_matched_grouphash=None
        for grouphash in additional_grouphashes:
            if grouphash.metadata is not None:
                grouphash.metadata.refresh_from_db()
                assert grouphash.metadata.seer_matched_grouphash is None
            else:
                raise AssertionError("GroupHashMetadata is None for grouphash id=%s" % grouphash.id)

    def test_delete_project_group_hashes_specific_groups(self) -> None:
        """Test deleting grouphashes for specific group IDs (including metadata) and empty list safety."""
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        event_1 = self.store_event(
            data={"platform": "python", "stacktrace": {"frames": [{"filename": "error_1.py"}]}},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"platform": "python", "stacktrace": {"frames": [{"filename": "error_2.py"}]}},
            project_id=self.project.id,
        )

        grouphash_1 = GroupHash.objects.get(group=event_1.group)
        grouphash_2 = GroupHash.objects.get(group=event_2.group)
        assert grouphash_1.metadata is not None
        assert grouphash_2.metadata is not None
        metadata_1_id = grouphash_1.metadata.id
        metadata_2_id = grouphash_2.metadata.id

        assert GroupHash.objects.filter(project=self.project).count() == 2

        delete_project_group_hashes(
            project_id=self.project.id,
            group_ids_filter=[event_1.group.id],
        )

        assert not GroupHash.objects.filter(id=grouphash_1.id).exists()
        assert not GroupHashMetadata.objects.filter(id=metadata_1_id).exists()
        assert GroupHash.objects.filter(id=grouphash_2.id).exists()
        assert GroupHashMetadata.objects.filter(id=metadata_2_id).exists()

        # Empty list should be a no-op
        delete_project_group_hashes(project_id=self.project.id, group_ids_filter=[])
        assert GroupHash.objects.filter(id=grouphash_2.id).exists()

    def test_delete_project_group_hashes_all_including_orphans(self) -> None:
        """Test deleting all grouphashes including orphans when group_ids_filter=None."""
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        event = self.store_event(
            data={"platform": "python", "stacktrace": {"frames": [{"filename": "error.py"}]}},
            project_id=self.project.id,
        )
        grouphash = GroupHash.objects.get(group=event.group)
        assert grouphash.metadata is not None
        metadata_id = grouphash.metadata.id

        orphan_1 = GroupHash.objects.create(project=self.project, hash="a" * 32, group=None)
        orphan_2 = GroupHash.objects.create(project=self.project, hash="b" * 32, group=None)

        assert GroupHash.objects.filter(project=self.project).count() == 3
        assert GroupHash.objects.filter(project=self.project, group__isnull=True).count() == 2

        delete_project_group_hashes(project_id=self.project.id, group_ids_filter=None)

        assert not GroupHash.objects.filter(id=grouphash.id).exists()
        assert not GroupHash.objects.filter(id=orphan_1.id).exists()
        assert not GroupHash.objects.filter(id=orphan_2.id).exists()
        assert not GroupHashMetadata.objects.filter(id=metadata_id).exists()
        assert GroupHash.objects.filter(project=self.project).count() == 0


class DeleteIssuePlatformTest(TestCase, SnubaTestCase, OccurrenceTestMixin):
    referrer = Referrer.TESTING_TEST.value

    def create_occurrence(self, event: Event, type_id: int) -> tuple[IssueOccurrence, Group]:
        occurrence, group_info = self.process_occurrence(
            project_id=self.project.id,
            event_id=event.event_id,
            type=type_id,
            # Convert event data dict for occurrence processing
            event_data=dict(event.data),
        )
        assert group_info is not None
        return occurrence, group_info.group

    def select_error_events(self, project_id: int) -> object:
        columns = ["event_id", "group_id"]
        return self.select_rows(Entity(EntityKey.Events.value), columns, project_id)

    def select_issue_platform_events(self, project_id: int) -> object:
        columns = ["event_id", "group_id", "occurrence_id"]
        return self.select_rows(Entity(EntityKey.IssuePlatform.value), columns, project_id)

    def select_rows(
        self, entity: Entity, columns: list[str], project_id: int
    ) -> None | dict[str, object]:
        # Adding the random microseconds is to circumvent Snuba's caching mechanism
        now = datetime.now()
        start_time = now - timedelta(days=1, microseconds=random.randint(0, 100000000))
        end_time = now + timedelta(days=1, microseconds=random.randint(0, 100000000))

        select = [Column(column) for column in columns]
        where = [
            Condition(Column("project_id"), Op.IN, Function("tuple", [project_id])),
            Condition(Column("timestamp"), Op.GTE, start_time),
            Condition(Column("timestamp"), Op.LT, end_time),
        ]
        query = Query(match=entity, select=select, where=where)
        request = Request(
            # Using IssuePlatform dataset for occurrence queries
            dataset=Dataset.IssuePlatform.value,
            app_id=self.referrer,
            query=query,
            tenant_ids=self.tenant_ids,
        )
        results = bulk_snuba_queries([request])[0]["data"]
        return results[0] if results else None

    @property
    def tenant_ids(self) -> dict[str, str]:
        return {"referrer": self.referrer, "organization_id": self.organization.id}

    @mock.patch("sentry.deletions.tasks.nodestore.bulk_snuba_queries")
    def test_simple_issue_platform(self, mock_bulk_snuba_queries: mock.Mock) -> None:
        # Adding this query here to make sure that the cache is not being used
        assert self.select_error_events(self.project.id) is None
        assert self.select_issue_platform_events(self.project.id) is None

        # Create initial error event and occurrence related to it; two different groups will exist
        event = self.store_event(data={}, project_id=self.project.id)
        # XXX: We need a different way of creating occurrences which will insert into the nodestore
        occurrence_event, issue_platform_group = self.create_occurrence(
            event, type_id=FeedbackGroup.type_id
        )

        # Assertions after creation
        assert occurrence_event.id != event.event_id
        assert event.group_id != issue_platform_group.id
        assert event.group.issue_category == GroupCategory.ERROR
        assert issue_platform_group.issue_category == GroupCategory.FEEDBACK
        assert issue_platform_group.type == FeedbackGroup.type_id

        # Assert that the error event has been inserted in the nodestore & Snuba
        event_node_id = Event.generate_node_id(event.project_id, event.event_id)
        assert nodestore.backend.get(event_node_id)
        expected_error = {"event_id": event.event_id, "group_id": event.group_id}
        assert self.select_error_events(self.project.id) == expected_error

        # Assert that the occurrence event has been inserted in the nodestore & Snuba
        expected_occurrence_event = {
            "event_id": occurrence_event.event_id,
            "group_id": issue_platform_group.id,
            "occurrence_id": occurrence_event.id,
        }
        assert self.select_issue_platform_events(self.project.id) == expected_occurrence_event

        # This will delete the group and the events from the node store and Snuba
        with self.tasks():
            delete_groups_for_project(
                object_ids=[issue_platform_group.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        # The original error event and group still exist
        assert Group.objects.filter(id=event.group_id).exists()
        assert nodestore.backend.get(event_node_id)
        assert self.select_error_events(self.project.id) == expected_error

        # The Issue Platform group and occurrence have been deleted from Postgres
        assert not Group.objects.filter(id=issue_platform_group.id).exists()
        # assert not nodestore.backend.get(occurrence_node_id)

        # Verify that a DELETE query was sent to Snuba with the correct conditions
        mock_bulk_snuba_queries.assert_called_once()
        requests = mock_bulk_snuba_queries.call_args[0][0]
        assert len(requests) == 1
        delete_request = requests[0]
        assert isinstance(delete_request.query, DeleteQuery)
        assert delete_request.dataset == "search_issues"
        assert delete_request.query.column_conditions["project_id"] == [self.project.id]
        assert delete_request.query.column_conditions["group_id"] == [issue_platform_group.id]

    @mock.patch("sentry.deletions.tasks.nodestore.bulk_snuba_queries")
    def test_issue_platform_batching(self, mock_bulk_snuba_queries: mock.Mock) -> None:
        # Patch max_rows_to_delete to a small value for testing
        with (
            self.tasks(),
            mock.patch("sentry.deletions.tasks.nodestore.ISSUE_PLATFORM_MAX_ROWS_TO_DELETE", 6),
        ):
            # Create three groups with times_seen such that batching is required
            group1 = self.create_group(project=self.project)
            group2 = self.create_group(project=self.project)
            group3 = self.create_group(project=self.project)
            group4 = self.create_group(project=self.project)

            # Set times_seen for each group
            Group.objects.filter(id=group1.id).update(times_seen=3, type=FeedbackGroup.type_id)
            Group.objects.filter(id=group2.id).update(times_seen=1, type=FeedbackGroup.type_id)
            Group.objects.filter(id=group3.id).update(times_seen=3, type=FeedbackGroup.type_id)
            Group.objects.filter(id=group4.id).update(times_seen=3, type=FeedbackGroup.type_id)

            # This will delete the group and the events from the node store and Snuba
            delete_groups_for_project(
                object_ids=[group1.id, group2.id, group3.id, group4.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

            assert mock_bulk_snuba_queries.call_count == 1
            # There should be two batches with max_rows_to_delete=6
            # First batch: [group2, group1] (1+3=4 events, under limit)
            # Second batch: [group3, group4] (3+3=6 events, at limit)
            requests = mock_bulk_snuba_queries.call_args[0][0]
            assert len(requests) == 2

            first_batch = requests[0].query.column_conditions["group_id"]
            second_batch = requests[1].query.column_conditions["group_id"]

            # Since we sort by times_seen, the first batch will be [group2, group1]
            # and the second batch will be [group3, group4]
            assert first_batch == [group2.id, group1.id]  # group2 has less times_seen than group1
            # group3 and group4 have the same times_seen, thus sorted by id
            assert second_batch == [group3.id, group4.id]
