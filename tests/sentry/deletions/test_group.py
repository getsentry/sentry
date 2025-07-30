import os
import random
from datetime import datetime, timedelta
from time import time
from unittest import mock
from uuid import uuid4

from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry import nodestore
from sentry.deletions.defaults.group import ErrorEventsDeletionTask, IssuePlatformEventsDeletionTask
from sentry.deletions.tasks.groups import delete_groups_for_project
from sentry.eventstore.models import Event
from sentry.issues.grouptype import FeedbackGroup, GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.eventattachment import EventAttachment
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupredirect import GroupRedirect
from sentry.models.userreport import UserReport
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import bulk_snuba_queries
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class DeleteGroupTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        one_minute = before_now(minutes=1).isoformat()
        group1_data = {"timestamp": one_minute, "fingerprint": ["group1"]}
        group2_data = {"timestamp": one_minute, "fingerprint": ["group2"]}

        # Group 1 events
        self.event = self.store_event(
            data=group1_data | {"tags": {"foo": "bar"}}, project_id=self.project.id
        )
        self.event_id = self.event.event_id
        self.node_id = Event.generate_node_id(self.project.id, self.event_id)
        group = self.event.group
        self.event_id2 = self.store_event(data=group1_data, project_id=self.project.id).event_id
        self.node_id2 = Event.generate_node_id(self.project.id, self.event_id2)

        # Group 2 event
        self.keep_event = self.store_event(data=group2_data, project_id=self.project.id)
        self.keep_node_id = Event.generate_node_id(self.project.id, self.keep_event.event_id)

        UserReport.objects.create(
            group_id=group.id, project_id=self.event.project_id, name="With group id"
        )
        UserReport.objects.create(
            event_id=self.event.event_id, project_id=self.event.project_id, name="With event id"
        )
        EventAttachment.objects.create(
            event_id=self.event.event_id,
            project_id=self.event.project_id,
            name="hello.png",
            content_type="image/png",
        )
        GroupAssignee.objects.create(group=group, project=self.project, user_id=self.user.id)
        GroupHash.objects.create(project=self.project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

    def test_simple(self) -> None:
        ErrorEventsDeletionTask.DEFAULT_CHUNK_SIZE = 1  # test chunking logic
        group = self.event.group
        assert nodestore.backend.get(self.node_id)
        assert nodestore.backend.get(self.node_id2)
        assert nodestore.backend.get(self.keep_node_id)

        with self.tasks():
            delete_groups_for_project(
                object_ids=[group.id], transaction_id=uuid4().hex, project_id=self.project.id
            )

        assert not UserReport.objects.filter(group_id=group.id).exists()
        assert not UserReport.objects.filter(event_id=self.event.event_id).exists()
        assert not EventAttachment.objects.filter(event_id=self.event.event_id).exists()

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(self.node_id2)
        assert nodestore.backend.get(self.keep_node_id), "Does not remove from second group"
        assert Group.objects.filter(id=self.keep_event.group_id).exists()

    def test_simple_multiple_groups(self) -> None:
        other_event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "fingerprint": ["group3"]},
            project_id=self.project.id,
        )
        other_node_id = Event.generate_node_id(self.project.id, other_event.event_id)

        group = self.event.group
        with self.tasks():
            delete_groups_for_project(
                object_ids=[group.id, other_event.group_id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert not Group.objects.filter(id=group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(other_node_id)

        assert Group.objects.filter(id=self.keep_event.group_id).exists()
        assert nodestore.backend.get(self.keep_node_id)

    def test_grouphistory_relation(self) -> None:
        other_event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "fingerprint": ["group3"]},
            project_id=self.project.id,
        )
        other_group = other_event.group
        group = self.event.group
        history_one = self.create_group_history(group=group, status=GroupHistoryStatus.ONGOING)
        history_two = self.create_group_history(
            group=group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=history_one,
        )
        other_history_one = self.create_group_history(
            group=other_group, status=GroupHistoryStatus.ONGOING
        )
        other_history_two = self.create_group_history(
            group=other_group,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=other_history_one,
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

    @mock.patch("sentry.nodestore.delete_multi")
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
        other_event = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        other_node_id = Event.generate_node_id(self.project.id, other_event.event_id)

        hashes = [
            grouphash.hash
            for grouphash in GroupHash.objects.filter(
                project_id=self.project.id, group_id__in=[self.event.group.id, other_event.group_id]
            )
        ]
        group = self.event.group
        with self.tasks():
            delete_groups_for_project(
                object_ids=[group.id, other_event.group_id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        assert not Group.objects.filter(id=group.id).exists()
        assert not Group.objects.filter(id=other_event.group_id).exists()
        assert not nodestore.backend.get(self.node_id)
        assert not nodestore.backend.get(other_node_id)

        assert Group.objects.filter(id=self.keep_event.group_id).exists()
        assert nodestore.backend.get(self.keep_node_id)

        assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
            "args": [group.project.id, hashes, 0]
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


class DeleteIssuePlatformTest(TestCase, SnubaTestCase, OccurrenceTestMixin):
    referrer = Referrer.TESTING_TEST.value
    dataset = Dataset.IssuePlatform.value

    def create_occurrence(self, fingerprint: str, type_id: int) -> tuple[IssueOccurrence, Group]:
        occurrence, group_info = self.process_occurrence(
            project_id=self.project.id,
            event_id=uuid4().hex,
            type=type_id,
            event_data={},
            evidence_data={"breakpoint": before_now(minutes=10).timestamp()},
        )
        assert group_info is not None
        return occurrence, group_info.group

    def select_issue_platform_rows(self, project_id: int) -> None | dict[str, object]:
        columns = ["event_id", "group_id", "occurrence_id"]
        entity = Entity(EntityKey.IssuePlatform.value)
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
            dataset=self.dataset,
            app_id=self.referrer,
            query=query,
            tenant_ids={"referrer": self.referrer, "organization_id": self.organization.id},
        )
        results = bulk_snuba_queries([request])[0]["data"]
        return results[0] if results else None

    def test_simple_issue_platform(self) -> None:
        assert self.select_issue_platform_rows(self.project.id) is None

        # XXX: We need a different way of creating occurrences which will insert into the nodestore
        occurrence_event, issue_platform_group = self.create_occurrence(
            fingerprint="group-1", type_id=FeedbackGroup.type_id
        )
        assert issue_platform_group.issue_category == GroupCategory.FEEDBACK
        assert issue_platform_group.type == FeedbackGroup.type_id

        # Assert that the occurrence event has been inserted in the nodestore & Snuba
        # occurrence_node_id = Event.generate_node_id(
        #     occurrence_event.project_id, occurrence_event.id
        # )
        # assert nodestore.backend.get(occurrence_node_id)
        expected_occurrence_event = {
            "event_id": occurrence_event.event_id,
            "group_id": issue_platform_group.id,
            "occurrence_id": occurrence_event.id,
        }
        assert self.select_issue_platform_rows(self.project.id) == expected_occurrence_event

        # This will delete the group and the events from the node store and Snuba
        with self.tasks():
            delete_groups_for_project(
                object_ids=[issue_platform_group.id],
                transaction_id=uuid4().hex,
                project_id=self.project.id,
            )

        # The Issue Platform group and occurrence have been deleted
        assert not Group.objects.filter(id=issue_platform_group.id).exists()
        # assert not nodestore.backend.get(occurrence_node_id)
        assert self.select_issue_platform_rows(self.project.id) is None

    @mock.patch("sentry.deletions.defaults.group.bulk_snuba_queries")
    def test_issue_platform_batching(self, mock_bulk_snuba_queries: mock.Mock) -> None:
        # Patch max_rows_to_delete to a small value for testing
        with mock.patch.object(IssuePlatformEventsDeletionTask, "max_rows_to_delete", 6):
            # Create three groups with times_seen such that batching is required
            group1 = self.create_group(project=self.project)
            group2 = self.create_group(project=self.project)
            group3 = self.create_group(project=self.project)
            group4 = self.create_group(project=self.project)

            # Set times_seen for each group
            Group.objects.filter(id=group1.id).update(times_seen=3, type=GroupCategory.FEEDBACK)
            Group.objects.filter(id=group2.id).update(times_seen=1, type=GroupCategory.FEEDBACK)
            Group.objects.filter(id=group3.id).update(times_seen=3, type=GroupCategory.FEEDBACK)
            Group.objects.filter(id=group4.id).update(times_seen=3, type=GroupCategory.FEEDBACK)

            # This will delete the group and the events from the node store and Snuba
            with self.tasks():
                delete_groups_for_project(
                    object_ids=[group1.id, group2.id, group3.id, group4.id],
                    transaction_id=uuid4().hex,
                    project_id=self.project.id,
                )

            # There should be two batches: [group3, group1] (2+3=5 > 5, so group2 starts new batch), [group2]
            assert mock_bulk_snuba_queries.call_count == 1
            requests = mock_bulk_snuba_queries.call_args[0][0]
            assert len(requests) == 2

            first_batch = requests[0].query.column_conditions["group_id"]
            second_batch = requests[1].query.column_conditions["group_id"]

            # Since we sort by times_seen, the first batch will be [group2, group1]
            # and the second batch will be [group3, group4]
            assert first_batch == [group2.id, group1.id]  # group2 has less times_seen than group1
            # group3 and group4 have the same times_seen, thus sorted by id
            assert second_batch == [group3.id, group4.id]
