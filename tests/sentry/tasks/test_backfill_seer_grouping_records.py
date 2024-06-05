import copy
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from random import choice
from string import ascii_uppercase
from typing import Any
from unittest.mock import ANY, call, patch

import pytest
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.grouping.grouping_info import get_grouping_info
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.backfill import CreateGroupingRecordData
from sentry.seer.similarity.types import RawSeerSimilarIssueData
from sentry.seer.similarity.utils import get_stacktrace_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.backfill_seer_grouping_records import (
    GroupStacktraceData,
    backfill_seer_grouping_records,
    lookup_event,
    lookup_group_data_stacktrace_bulk,
    lookup_group_data_stacktrace_bulk_with_fallback,
    lookup_group_data_stacktrace_single,
    make_backfill_redis_key,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json, redis
from sentry.utils.snuba import bulk_snuba_queries

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
class TestBackfillSeerGroupingRecords(SnubaTestCase, TestCase):
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
        """
        Create num events and their corresponding group rows. Set times_seen for the corresponding
        group to 5.
        """
        rows, events, messages = [], [], {}
        function_names = [f"function_{str(i)}" for i in range(num)]
        type_names = [f"Error{str(i)}" for i in range(num)]
        value_names = ["error with value" for i in range(num)]
        for i in range(num):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            events.append(event)
            event.group.times_seen = 5
            event.group.save()
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
        bulk_data = self.create_group_event_rows(5)
        self.bulk_rows, self.bulk_events, self.bulk_messages = (
            bulk_data["rows"],
            bulk_data["events"],
            bulk_data["messages"],
        )
        self.event = self.store_event(
            data={"exception": EXCEPTION, "timestamp": iso_format(before_now(seconds=10))},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.event.group.times_seen = 5
        self.event.group.save()

        self.wait_for_event_count(self.project.id, 6)

        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

    def tearDown(self):
        super().tearDown()
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        redis_client.set(f"{make_backfill_redis_key(self.project.id)}", 0, ex=60 * 60 * 24 * 7)

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
            self.project, event.event_id, event.group_id, event.group.message
        )
        expected_group_data = CreateGroupingRecordData(
            group_id=event.group.id,
            hash=hash,
            project_id=self.project.id,
            message=event.group.message,
        )
        assert group_data == expected_group_data
        assert stacktrace_string == EXCEPTION_STACKTRACE_STRING

    @patch("time.sleep", return_value=None)
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_event")
    def test_lookup_group_data_stacktrace_single_exceptions(
        self, mock_lookup_event, mock_logger, mock_sleep
    ):
        """
        Test when ServiceUnavailable and DeadlineExceeded exceptions occur, that we stop the
        backfill
        """
        exceptions = [
            ServiceUnavailable(message="Service Unavailable"),
            DeadlineExceeded(message="Deadline Exceeded"),
        ]
        event = self.event

        for exception in exceptions:
            mock_lookup_event.side_effect = exception
            with pytest.raises(Exception):
                lookup_group_data_stacktrace_single(
                    self.project,
                    event.event_id,
                    event.group_id,
                    event.group.message,
                )
                mock_logger.exception.assert_called_with(
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
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message
        )
        assert (group_data, stacktrace_string) == (None, "")

    def test_lookup_group_data_stacktrace_single_no_stacktrace(self):
        """Test that no data is returned if the event has no stacktrace"""
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message
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
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages)

        expected_event_ids = {event.event_id for event in events}
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=self.group_hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert bulk_event_ids == expected_event_ids
        assert invalid_event_ids == set()
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_metrics.gauge.assert_called_with(
            "backfill_grouping_records._lookup_event_bulk.hit_ratio", 100, sample_rate=1.0
        )

    @patch("time.sleep", return_value=None)
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch("sentry.nodestore.backend.get_multi")
    def test_lookup_group_data_stacktrace_bulk_exceptions(
        self, mock_get_multi, mock_logger, mock_sleep
    ):
        """
        Test cases where ServiceUnavailable or DeadlineExceeded exceptions occur in bulk data
        lookup, that the backfill stops
        """
        exceptions = [
            ServiceUnavailable(message="Service Unavailable"),
            DeadlineExceeded(message="Deadline Exceeded"),
        ]
        rows, messages = self.bulk_rows, self.bulk_messages

        for exception in exceptions:
            mock_get_multi.side_effect = exception
            with pytest.raises(Exception):
                lookup_group_data_stacktrace_bulk(self.project, rows, messages)
                mock_logger.exception.assert_called_with(
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
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
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
        ) = lookup_group_data_stacktrace_bulk(self.project, rows, messages)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
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
            self.project, rows, messages
        )

        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
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
                    group_id=event.group.id,
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
            self.project, rows, messages
        )

        events = self.bulk_events
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

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
            self.project, rows, messages
        )

        events = self.bulk_events[:-1]
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.group.message,
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(4)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_logger.exception.assert_called_with(
            "tasks.backfill_seer_grouping_records.event_lookup_error",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "group_id": rows[-1]["group_id"],
                "event_id": 10000,
            },
        )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success_simple(self, mock_post_bulk_grouping_records):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

    @patch("time.sleep", return_value=None)
    @patch("sentry.nodestore.backend.get_multi")
    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_event")
    def test_backfill_seer_grouping_records_failure(
        self, mock_lookup_event, mock_get_multi, mock_sleep
    ):
        """
        Test that the group metadata and redis last processed id aren't updated on a failure.
        """
        mock_lookup_event.side_effect = ServiceUnavailable(message="Service Unavailable")
        mock_get_multi.side_effect = ServiceUnavailable(message="Service Unavailable")

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == 0

        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("seer_similarity")

    def test_backfill_seer_grouping_records_no_feature(self):
        """
        Test that the function does not create records when there is no feature flag
        """
        project = self.create_project(organization=self.organization)

        with TaskRunner():
            backfill_seer_grouping_records(project, None)

        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("seer_similarity")

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    @patch("sentry.tasks.backfill_seer_grouping_records.delete_grouping_records")
    def test_backfill_seer_grouping_records_dry_run(
        self, mock_delete_grouping_records, mock_post_bulk_grouping_records
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": []}
        mock_delete_grouping_records.return_value = True
        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, 0, dry_run=True)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert not group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_groups_1_times_seen(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups where times_seen == 1 are not included.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        function_names = [f"new_function_{str(i)}" for i in range(5)]
        type_names = [f"NewError{str(i)}" for i in range(5)]
        value_names = ["error with value" for i in range(5)]
        groups_seen_once = []
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            groups_seen_once.append(event.group)

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        for group in Group.objects.filter(project_id=self.project.id):
            if group not in groups_seen_once:
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": self.group_hashes[group.id],
                }
            else:
                assert group.data["metadata"].get("seer_similarity") is None

        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(
            Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        )

    @pytest.mark.skip(
        "this test is flakey in production; trying to replicate locally and skipping it for now"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_groups_have_neighbor(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups that have nearest neighbors, do not get records created for them in
        grouping_records.
        Test that the metadata of groups that have nearest neighbors and those that have records
        created are different.
        """
        # Create groups with 1 < times_seen < 5
        # The groups that will be similar to these groups, have times_seen = 5
        function_names = [f"another_function_{str(i)}" for i in range(5)]
        type_names = [f"AnotherError{str(i)}" for i in range(5)]
        value_names = ["error with value" for i in range(5)]
        groups_with_neighbor = {}
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            event.group.times_seen = 2
            event.group.save()
            # Arbitrarily choose a parent group's hash that has times_seen = 5
            parent_group = Group.objects.filter(times_seen__gt=2).first()
            parent_group_hash = GroupHash.objects.filter(group_id=parent_group.id).first()
            groups_with_neighbor[str(event.group.id)] = RawSeerSimilarIssueData(
                stacktrace_distance=0.01,
                message_distance=0.01,
                should_group=True,
                parent_hash=parent_group_hash.hash,
            )

        mock_post_bulk_grouping_records.return_value = {
            "success": True,
            "groups_with_neighbor": groups_with_neighbor,
        }

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        for group in groups:
            if str(group.id) not in groups_with_neighbor:
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": self.group_hashes[group.id],
                }
            else:
                request_hash = GroupHash.objects.get(group_id=group.id).hash
                parent_group_id = Group.objects.filter(times_seen__gt=2).first().id
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": request_hash,
                    "results": [
                        {
                            "stacktrace_distance": 0.01,
                            "message_distance": 0.01,
                            "should_group": True,
                            "parent_hash": groups_with_neighbor[str(group.id)]["parent_hash"],
                            "parent_group_id": parent_group_id,
                        }
                    ],
                }

        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_groups_has_invalid_neighbor(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that groups that have nearest neighbors that do not exist, do not have their metadata
        updated.
        """
        # Create group with 1 < times_seen < 5
        group_with_neighbor = {}
        data = {
            "exception": self.create_exception_values(
                "another_function!", "AnotherError!", "error with value"
            ),
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.save()
        # Make the similar group a hash that does not exist
        group_with_neighbor[str(event.group.id)] = RawSeerSimilarIssueData(
            stacktrace_distance=0.01,
            message_distance=0.01,
            should_group=True,
            parent_hash="00000000000000000000000000000000",
        )

        mock_post_bulk_grouping_records.return_value = {
            "success": True,
            "groups_with_neighbor": group_with_neighbor,
        }

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        for group in groups:
            if str(group.id) not in group_with_neighbor:
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": self.group_hashes[group.id],
                }
            else:
                assert group.data["metadata"].get("seer_similarity") is None
                mock_logger.exception.assert_called_with(
                    "tasks.backfill_seer_grouping_records.invalid_parent_group",
                    extra={
                        "project_id": self.project.id,
                        "group_id": group.id,
                        "parent_hash": "00000000000000000000000000000000",
                    },
                )

        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

    @pytest.mark.skip(
        "this test is flakey in production; trying to replicate locally and skipping it for now"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_multiple_batches(self, mock_post_bulk_grouping_records):
        """
        Test that the metadata is set for all 21 groups showing that the record has been created,
        where 21 > the batch size, 20.
        """
        function_names = [f"another_function_{str(i)}" for i in range(10)]
        type_names = [f"AnotherError{str(i)}" for i in range(10)]
        value_names = ["error with value" for _ in range(10)]
        for i in range(10):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            event.group.times_seen = 2
            event.group.save()

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)
        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") is not None

        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.delete_grouping_records")
    def test_backfill_seer_grouping_records_only_delete(self, mock_delete_grouping_records):
        """
        Test that when the only_delete flag is on, seer_similarity is deleted from the metadata
        if it exists
        """
        # Create groups, half seer_similarity in the metadata, half without
        function_names = [f"another_function_{str(i)}" for i in range(5)]
        type_names = [f"AnotherError{str(i)}" for i in range(5)]
        value_names = ["error with value" for _ in range(5)]
        group_ids = []
        default_metadata = {"different_data": {"something": "else"}}
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            event.group.times_seen = 2
            event.group.data["metadata"] = copy.deepcopy(default_metadata)
            if i < 3:
                event.group.data["metadata"].update(
                    {"seer_similarity": {"similarity_model_version": "v0"}}
                )
            event.group.save()
            group_ids.append(event.group.id)

        mock_delete_grouping_records.return_value = True
        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None, only_delete=True)

        groups = Group.objects.filter(project_id=self.project.id, id__in=group_ids)
        for group in groups:
            assert group.data["metadata"] == default_metadata

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_exclude_deleted_groups(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups that are pending deletion/in the process of being deleted are not included.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        # Create groups pending deletion and in the process of being deleted
        deleted_group_ids = []
        data = {
            "exception": self.create_exception_values("function name!", "type!", "value!"),
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.PENDING_DELETION
        event.group.save()
        deleted_group_ids.append(event.group.id)

        data = {
            "exception": self.create_exception_values("function name?", "type?", "value?"),
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.DELETION_IN_PROGRESS
        event.group.save()
        deleted_group_ids.append(event.group.id)

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id__in=deleted_group_ids)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

        # Assert metadata was not set for groups that will be deleted
        for group in Group.objects.filter(project_id=self.project.id, id__in=deleted_group_ids):
            assert group.data["metadata"].get("seer_similarity") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch("sentry.tasks.backfill_seer_grouping_records.bulk_snuba_queries")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_no_events(
        self, mock_post_bulk_grouping_records, mock_snuba_queries, mock_logger
    ):
        """
        Test that groups that have no events in snuba are excluded.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        # Mock snuba response to purposefully exclude the first group
        groups_minus_first = Group.objects.filter(project_id=self.project.id).order_by("id")[1:]
        group_id_batch = [group.id for group in groups_minus_first]
        events_entity = Entity("events", alias="events")
        snuba_requests = []
        for group_id in group_id_batch:
            group = Group.objects.get(id=group_id)
            query = Query(
                match=events_entity,
                select=[
                    Column("group_id"),
                    Column("event_id"),
                ],
                where=[
                    Condition(Column("project_id"), Op.EQ, self.project.id),
                    Condition(Column("group_id"), Op.EQ, group_id),
                    Condition(
                        Column("timestamp", entity=events_entity),
                        Op.GTE,
                        group.last_seen - timedelta(days=10),
                    ),
                    Condition(
                        Column("timestamp", entity=events_entity),
                        Op.LT,
                        group.last_seen + timedelta(minutes=5),
                    ),
                ],
                limit=Limit(1),
            )
            request = Request(
                dataset=Dataset.Events.value,
                app_id=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
                query=query,
                tenant_ids={
                    "referrer": Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
                    "cross_org_query": 1,
                },
            )
            snuba_requests.append(request)

        result = bulk_snuba_queries(
            snuba_requests, referrer=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value
        )
        mock_snuba_queries.return_value = result

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        for group in Group.objects.filter(project_id=self.project.id).order_by("id")[1:]:
            assert group.data["metadata"].get("seer_similarity") is not None

        # Check that the group with no events has no seer metadata
        group_no_events = Group.objects.filter(project_id=self.project.id).order_by("id")[0]
        assert group_no_events.data["metadata"].get("seer_similarity") is None
        assert (
            call(
                "tasks.backfill_seer_grouping_records.no_snuba_event",
                extra={
                    "organization_id": self.project.organization.id,
                    "project_id": self.project.id,
                    "group_id": group_no_events.id,
                },
            )
            in mock_logger.info.call_args_list
        )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_exclude_90_day_old_groups(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups that are over 90 days old are excluded.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        # Create groups pending deletion and in the process of being deleted
        old_group_id = []
        data = {
            "exception": self.create_exception_values("function name!", "type!", "value!"),
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.last_seen = datetime.now(UTC) - timedelta(days=90)
        event.group.save()
        old_group_id = event.group.id

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id=old_group_id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_index = int(redis_client.get(make_backfill_redis_key(self.project.id)) or 0)
        assert last_processed_index == len(groups)

        # Assert metadata was not set for groups that is 90 days old
        old_group = Group.objects.filter(project_id=self.project.id, id=old_group_id).first()
        assert old_group.data["metadata"].get("seer_similarity") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    @patch(
        "sentry.tasks.backfill_seer_grouping_records.lookup_group_data_stacktrace_bulk_with_fallback"
    )
    @patch("sentry.tasks.backfill_seer_grouping_records.call_next_backfill")
    def test_backfill_seer_grouping_records_empty_nodestore(
        self,
        mock_call_next_backfill,
        mock_lookup_group_data_stacktrace_bulk_with_fallback,
        mock_logger,
    ):
        mock_lookup_group_data_stacktrace_bulk_with_fallback.return_value = GroupStacktraceData(
            data=[], stacktrace_list=[]
        )

        with TaskRunner():
            backfill_seer_grouping_records(self.project.id, None)

        groups = Group.objects.all()
        groups_len = len(groups)
        group_ids_sorted = sorted([group.id for group in groups])
        mock_logger.info.assert_called_with(
            "tasks.backfill_seer_grouping_records.no_data",
            extra={
                "project_id": self.project.id,
                "group_id_batch": json.dumps(group_ids_sorted),
            },
        )
        mock_call_next_backfill.assert_called_with(
            groups_len, self.project.id, ANY, groups_len, groups[groups_len - 1].id, False
        )
