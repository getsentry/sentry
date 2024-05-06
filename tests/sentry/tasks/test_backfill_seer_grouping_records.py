import copy
from collections.abc import Mapping
from random import choice
from string import ascii_uppercase
from typing import Any
from unittest import TestCase
from unittest.mock import patch

import pytest
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable

from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.grouping.grouping_info import get_grouping_info
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.utils import CreateGroupingRecordData
from sentry.tasks.backfill_seer_grouping_records import (
    LAST_PROCESSED_REDIS_KEY,
    GroupStacktraceData,
    backfill_seer_grouping_records,
    lookup_event,
    lookup_group_data_stacktrace_bulk,
    lookup_group_data_stacktrace_bulk_with_fallback,
    lookup_group_data_stacktrace_single,
)
from sentry.testutils.cases import BaseMetricsTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json, redis

EXCEPTION = {
    "values": [
        {
            "stacktrace": {
                "frames": [
                    {
                        "function": "divide_by_zero",
                        "module": "__main__",
                        "filename": "python_onboarding.py",
                        "abs_path": "/Users/user/python_onboarding/python_onboarding.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ]
            },
            "type": "ZeroDivisionError",
            "value": "division by zero",
        }
    ]
}
EXCEPTION_STACKTRACE_STRING = (
    'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero'
)


@django_db_all
class TestBackfillSeerGroupingRecords(BaseMetricsTestCase, TestCase):
    def create_exception_values(self, function_name: str, type: str, value: str):
        return {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "function": function_name,
                                "module": "__main__",
                                "filename": f"{function_name}.py",
                                "abs_path": f"/Users/user/python_onboarding/{function_name}.py",
                                "lineno": 20,
                                "in_app": True,
                            },
                        ]
                    },
                    "type": type,
                    "value": value,
                }
            ]
        }

    def create_group_event_rows(self, num: int) -> Mapping[str, Any]:
        """Create num events and their corresponding group rows"""
        rows, events, messages = [], [], {}
        function_names = [f"function_{str(i)}" for i in range(num)]
        type_names = [f"Error{str(i)}" for i in range(num)]
        value_names = ["error with value" for i in range(num)]
        for i in range(num):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                )
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            events.append(event)
            messages.update({event.group.id: event.group.message})
            rows.append(
                {
                    "event_id": event.event_id,
                    "group_id": event.group_id,
                }
            )
            # Create 2 hashes per group
            GroupHash.objects.create(
                project_id=event.group.project.id,
                group_id=event.group.id,
                hash="".join(choice(ascii_uppercase) for i in range(32)),
            )
        return {"rows": rows, "events": events, "messages": messages}

    def setUp(self):
        super().setUp()
        bulk_data = self.create_group_event_rows(10)
        self.bulk_rows, self.bulk_events, self.bulk_messages = (
            bulk_data["rows"],
            bulk_data["events"],
            bulk_data["messages"],
        )
        self.event = self.store_event(
            data={"exception": EXCEPTION}, project_id=self.project.id, assert_no_errors=False
        )
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

    def tearDown(self):
        super().tearDown()
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        redis_client.set(f"{LAST_PROCESSED_REDIS_KEY}", 0, ex=60 * 60 * 24 * 7)

    def test_lookup_event_success(self):
        """Test single event lookup is successful"""
        found_event = lookup_event(self.project.id, self.event.event_id, self.event.group_id)

        assert self.event.event_id == found_event.event_id

    def test_lookup_event_event_lookup_error(self):
        """Test that EventLookupError is raised when an event does not exist"""
        with pytest.raises(EventLookupError):
            lookup_event(self.project.id, "1000000", 1000000)

    def test_lookup_group_data_stacktrace_single_success(self):
        """Test successful group data and stacktrace lookup"""
        event = self.event
        hash = self.group_hashes[event.group.id]
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message, hash
        )
        expected_group_data = CreateGroupingRecordData(
            hash=hash, project_id=self.project.id, message=event.group.message
        )
        assert group_data == expected_group_data
        assert stacktrace_string == EXCEPTION_STACKTRACE_STRING

    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_event")
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    def test_lookup_group_data_stacktrace_single_exceptions(self, mock_logger, mock_lookup_event):
        """Test cases where ServiceUnavailable and DeadlineExceeded exceptions occur"""
        exceptions = [
            ServiceUnavailable(message="Service Unavailable"),
            DeadlineExceeded(message="Deadline Exceeded"),
        ]
        event = self.event

        for exception in exceptions:
            mock_lookup_event.side_effect = exception
            group_data, stacktrace_string = lookup_group_data_stacktrace_single(
                self.project,
                event.event_id,
                event.group_id,
                event.group.message,
                self.group_hashes[event.group.id],
            )
            assert (group_data, stacktrace_string) == (None, "")
            mock_logger.info.assert_called_with(
                "tasks.backfill_seer_grouping_records.event_lookup_exception",
                extra={
                    "organization_id": self.project.organization.id,
                    "project_id": self.project.id,
                    "group_id": event.group.id,
                    "event_id": event.event_id,
                    "error": exception.message,
                },
            )

    def test_lookup_group_data_stacktrace_single_not_stacktrace_grouping(self):
        """Test that no data is returned if the group did not use the stacktrace to determine grouping"""
        # Create an event that is grouped by fingerprint
        event = self.store_event(
            data={"exception": EXCEPTION, "fingerprint": ["1"]},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        hash = GroupHash.objects.get(group_id=event.group.id)
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message, hash
        )
        assert (group_data, stacktrace_string) == (None, "")

    def test_lookup_group_data_stacktrace_single_no_stacktrace(self):
        """Test that no data is returned if the event has no stacktrace"""
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        hash = GroupHash.objects.get(group_id=event.group.id)
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message, hash
        )
        assert (group_data, stacktrace_string) == (None, "")

    @patch("sentry.tasks.backfill_seer_grouping_records.metrics")
    def test_lookup_group_data_stacktrace_bulk_success(self, mock_metrics):
        """Test successful bulk group data and stacktrace lookup"""
        rows, events, messages = self.bulk_rows, self.bulk_events, self.bulk_messages
        (
            bulk_event_ids,
            invalid_event_ids,
            bulk_group_data_stacktraces,
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages, self.group_hashes)

        expected_event_ids = {event.event_id for event in events}
        expected_group_data = [
            CreateGroupingRecordData(
                hash=self.group_hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(10)
        ]
        assert bulk_event_ids == expected_event_ids
        assert invalid_event_ids == set()
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_metrics.gauge.assert_called_with(
            "backfill_grouping_records._lookup_event_bulk.hit_ratio", 100, sample_rate=1.0
        )

    @patch("sentry.nodestore.backend.get_multi")
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    def test_lookup_group_data_stacktrace_bulk_exceptions(self, mock_logger, mock_get_multi):
        """
        Test cases where ServiceUnavailable or DeadlineExceeded exceptions occur in bulk data
        lookup
        """
        exceptions = [
            ServiceUnavailable(message="Service Unavailable"),
            DeadlineExceeded(message="Deadline Exceeded"),
        ]
        rows, messages = self.bulk_rows, self.bulk_messages

        for exception in exceptions:
            mock_get_multi.side_effect = exception
            (
                bulk_event_ids,
                invalid_event_ids,
                bulk_group_data_stacktraces,
            ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages, self.group_hashes)
            assert bulk_event_ids == set()
            assert invalid_event_ids == set()
            assert bulk_group_data_stacktraces["data"] == []
            assert bulk_group_data_stacktraces["stacktrace_list"] == []
            mock_logger.info.assert_called_with(
                "tasks.backfill_seer_grouping_records.bulk_event_lookup_exception",
                extra={
                    "organization_id": self.project.organization.id,
                    "project_id": self.project.id,
                    "group_data": json.dumps(rows),
                    "error": exception.message,
                },
            )

    def test_lookup_group_data_stacktrace_bulk_not_stacktrace_grouping(self):
        """
        Test that if a group does not use the stacktrace for grouping, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, messages, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}, {}
        # Add one event where the stacktrace is not used for grouping
        event = self.store_event(
            data={"exception": EXCEPTION, "fingerprint": ["2"]},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            messages.update({group_id: self.bulk_messages[group_id]})
            hashes.update({group_id: self.group_hashes[group_id]})
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        messages.update({event.group_id: event.group.message})
        hashes.update({event.group_id: GroupHash.objects.get(group_id=event.group.id).hash})

        (
            bulk_event_ids,
            invalid_event_ids,
            bulk_group_data_stacktraces,
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages, hashes)
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert invalid_event_ids == {event.event_id}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_no_stacktrace_exception(self):
        """
        Test that if a group does not have a stacktrace, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, messages, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}, {}
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            messages.update({group_id: self.bulk_messages[group_id]})
            hashes.update({group_id: self.group_hashes[group_id]})
        # Create one event where the stacktrace has no exception
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        messages.update({event.group_id: event.group.message})
        hashes.update({event.group_id: GroupHash.objects.get(group_id=event.group.id).hash})

        (
            bulk_event_ids,
            invalid_event_ids,
            bulk_group_data_stacktraces,
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages, hashes)
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert invalid_event_ids == {event.event_id}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_no_hash(self):
        """
        Test that if a group does not have a hash (for whatever reason), its data is not included
        in the bulk lookup result
        """
        # Use 2 events
        rows, events, messages, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}, {}
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            messages.update({group_id: self.bulk_messages[group_id]})
            hashes.update({group_id: self.group_hashes[group_id]})
        # Create one event with no hash
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        messages.update({event.group_id: event.group.message})

        (
            bulk_event_ids,
            invalid_event_ids,
            bulk_group_data_stacktraces,
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages, hashes)
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert invalid_event_ids == {event.event_id}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_with_fallback_success(self):
        """Test successful bulk lookup with fallback, where the fallback isn't used"""
        rows, events, messages, hashes = (
            self.bulk_rows,
            self.bulk_events,
            self.bulk_messages,
            self.group_hashes,
        )
        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows, messages, hashes
        )

        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(10)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_group_data_stacktrace_bulk")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_use_single_fallback(
        self, mock_lookup_group_data_stacktrace_bulk
    ):
        """
        Test bulk lookup with fallback returns data for all events, where two events use single
        lookup as a fallback
        """
        # Purposely exclude two events from being included in the bulk lookup response, so that the fallback is used
        events_missing_two = self.bulk_events[:-2]
        group_data, stacktrace_strings = [], []
        for event in events_missing_two:
            grouping_info = get_grouping_info(None, project=self.project, event=event)
            stacktrace_string = get_stacktrace_string(grouping_info)
            group_data.append(
                CreateGroupingRecordData(
                    hash=self.group_hashes[event.group.id],
                    project_id=self.project.id,
                    message=event.group.message,
                )
            )
            stacktrace_strings.append(stacktrace_string)
        mock_lookup_group_data_stacktrace_bulk.return_value = (
            {event.event_id for event in events_missing_two},
            set(),
            GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        )

        rows, messages, hashes = self.bulk_rows, self.bulk_messages, self.group_hashes
        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows, messages, hashes=hashes
        )

        events = self.bulk_events
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(10)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_group_data_stacktrace_bulk")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_no_hash(
        self, mock_lookup_group_data_stacktrace_bulk, mock_logger
    ):
        """
        Test that if a group does not have a hash (for whatever reason), we do not attempt the
        fallback and we log it
        """
        # Purposely exclude one event from being included in the bulk lookup response, so that the fallback is used
        events_missing = self.bulk_events[:-1]
        group_data, stacktrace_strings = [], []
        for event in events_missing:
            grouping_info = get_grouping_info(None, project=self.project, event=event)
            stacktrace_string = get_stacktrace_string(grouping_info)
            group_data.append(
                CreateGroupingRecordData(
                    hash=self.group_hashes[event.group.id],
                    project_id=self.project.id,
                    message=event.group.message,
                )
            )
            stacktrace_strings.append(stacktrace_string)
        mock_lookup_group_data_stacktrace_bulk.return_value = (
            {event.event_id for event in events_missing},
            set(),
            GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        )

        # Purposely remove the hash for the missing event
        hashes = copy.deepcopy(self.group_hashes)
        del hashes[self.bulk_events[-1].group.id]

        rows, messages = self.bulk_rows, self.bulk_messages
        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows, messages, hashes=hashes
        )

        events = self.bulk_events[:-1]
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(9)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_logger.info.assert_called_with(
            "tasks.backfill_seer_grouping_records.no_group_hash",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "group_id": self.bulk_events[-1].group_id,
            },
        )

    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_event_lookup_error(self, mock_logger):
        """
        Test bulk lookup with fallback catches EventLookupError and returns data for events that
        were found
        """
        rows, messages, hashes = (
            copy.deepcopy(self.bulk_rows),
            self.bulk_messages,
            self.group_hashes,
        )
        # Purposely change the event id of the last row to one that does not exist
        rows[-1]["event_id"] = 10000

        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows, messages, hashes
        )

        events = self.bulk_events[:-1]
        expected_group_data = [
            CreateGroupingRecordData(
                hash=hashes[event.group.id], project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(9)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_logger.info.assert_called_with(
            "tasks.backfill_seer_grouping_records.event_lookup_error",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "group_id": rows[-1]["group_id"],
                "event_id": 10000,
            },
        )

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("time.sleep")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success(
        self, mock_post_bulk_grouping_records, mock_sleep
    ):
        """
        Test that the redis key updates after a successfull call to seer create record endpoint
        and that the number of records created is equal to the number of groups
        """
        mock_post_bulk_grouping_records.return_value = {"success": True}
        mock_sleep.return_value = None  # Do not sleep when running tests
        num_groups_records_created = backfill_seer_grouping_records(self.project)
        for group in Group.objects.filter(project_id=self.project.id):
            assert group.data["metadata"].get("embeddings_info") == {
                "nn_model_version": 1,
                "group_hash": json.dumps([self.group_hashes[group.id]]),
            }
        assert num_groups_records_created == len(Group.objects.filter(project_id=self.project.id))
        assert (
            mock_post_bulk_grouping_records.call_args.args[0]["remove_grouping_record_table_init"]
            is False
        )

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("time.sleep")
    def test_backfill_seer_grouping_records_failure(self, mock_sleep):
        """
        Test that the redis key does not update after a failed call to seer create record endpoint,
        and that the group metadata isn't updated on a failure.
        Test that the next call to the backfill_seer_grouping_records updates the redis key.
        """
        mock_sleep.return_value = None  # Do not sleep when running tests
        with patch(
            "sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records"
        ) as mock_post_bulk_grouping_records:
            mock_post_bulk_grouping_records.return_value = {"success": False}
            num_groups_records_created = backfill_seer_grouping_records(self.project)
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)

        assert last_processed_id == 0
        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("embeddings_info")
        assert num_groups_records_created == 0

        with patch(
            "sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records"
        ) as mock_post_bulk_grouping_records:
            mock_post_bulk_grouping_records.return_value = {"success": True}
            num_groups_records_created = backfill_seer_grouping_records(self.project)
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)

        assert last_processed_id != 0
        for group in Group.objects.filter(project_id=self.project.id):
            assert group.data["metadata"]["embeddings_info"] == {
                "nn_model_version": 1,
                "group_hash": json.dumps([self.group_hashes[group.id]]),
            }
        assert num_groups_records_created == len(Group.objects.filter(project_id=self.project.id))

    def test_backfill_seer_grouping_records_no_feature(self):
        """
        Test that the function does not create records when there is no feature flag
        """
        project = self.create_project(organization=self.organization)
        num_groups_records_created = backfill_seer_grouping_records(project)
        assert num_groups_records_created == 0
        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("embeddings_info")

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("time.sleep")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_filter_metadata(
        self, mock_post_bulk_grouping_records, mock_sleep
    ):
        """
        Test that the number of records created does not include the group that already has a record
        """
        mock_sleep.return_value = None  # Do not sleep when running tests
        events = copy.deepcopy(self.bulk_events)
        events[-1].group.data["metadata"]["embeddings_info"] = {
            "nn_model_version": 1,
            "group_hash": json.dumps([self.group_hashes[events[-1].group.id]]),
        }
        events[-1].group.save()
        mock_post_bulk_grouping_records.return_value = {"success": True}
        num_groups_records_created = backfill_seer_grouping_records(self.project)

        for group in Group.objects.filter(project_id=self.project.id):
            assert group.data["metadata"].get("embeddings_info") == {
                "nn_model_version": 1,
                "group_hash": json.dumps([self.group_hashes[group.id]]),
            }
        assert (
            num_groups_records_created == len(Group.objects.filter(project_id=self.project.id)) - 1
        )

    @with_feature("projects:similarity-embeddings-grouping")
    @with_feature("projects:similarity-embeddings-remove-seer-grouping-record-table-init")
    @patch("time.sleep")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success_with_remove_table_feature(
        self, mock_post_bulk_grouping_records, mock_sleep
    ):
        """
        Test that the redis key updates after a successfull call to seer create record endpoint
        and that the number of records created is equal to the number of groups
        """
        mock_post_bulk_grouping_records.return_value = {"success": True}
        mock_sleep.return_value = None  # Do not sleep when running tests
        num_groups_records_created = backfill_seer_grouping_records(self.project)
        for group in Group.objects.filter(project_id=self.project.id):
            assert group.data["metadata"].get("embeddings_info") == {
                "nn_model_version": 1,
                "group_hash": json.dumps([self.group_hashes[group.id]]),
            }
        assert num_groups_records_created == len(Group.objects.filter(project_id=self.project.id))
        assert (
            mock_post_bulk_grouping_records.call_args.args[0]["remove_grouping_record_table_init"]
            is True
        )
