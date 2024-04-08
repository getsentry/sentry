import copy
from collections.abc import Mapping
from typing import Any
from unittest import TestCase
from unittest.mock import patch

import pytest
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable

from sentry.api.endpoints.event_grouping_info import get_grouping_info
from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group
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
    'ZeroDivisionError: division by zero\n  File "python_onboarding.py", line divide_by_zero'
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
        rows, events, expected_event_ids = [], [], set()
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
            expected_event_ids.add(event.event_id)
            rows.append(
                {
                    "event_id": event.event_id,
                    "group_id": event.group_id,
                    "message": event.group.message,
                }
            )
        return {"rows": rows, "events": events}

    def setUp(self):
        super().setUp()
        bulk_data = self.create_group_event_rows(10)
        self.bulk_rows, self.bulk_events = bulk_data["rows"], bulk_data["events"]
        self.event = self.store_event(
            data={"exception": EXCEPTION}, project_id=self.project.id, assert_no_errors=False
        )

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
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message
        )
        expected_group_data = CreateGroupingRecordData(
            group_id=event.group_id, project_id=self.project.id, message=event.group.message
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
                self.project, event.event_id, event.group_id, event.group.message
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

    @patch("sentry.tasks.backfill_seer_grouping_records.lookup_event")
    def test_lookup_group_data_stacktrace_single_no_metadata(self, mock_lookup_event):
        """
        Test that data is returned if the group has no metadata. This means that the embeddings
        record does not exist.
        """
        event = self.event
        del event.group.data["metadata"]
        mock_lookup_event.return_value = event
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project, event.event_id, event.group_id, event.group.message
        )
        expected_group_data = CreateGroupingRecordData(
            group_id=event.group_id, project_id=self.project.id, message=event.group.message
        )
        assert group_data == expected_group_data
        assert stacktrace_string == EXCEPTION_STACKTRACE_STRING

    def test_lookup_group_data_stacktrace_single_record_exists(self):
        """
        Test that no data is returned if the group already has an embeddings record
        """
        event_with_record = self.store_event(
            data={}, project_id=self.project.id, assert_no_errors=False
        )
        # Change the group metadata to signal that the embeddings record exists
        event_with_record.group.data["metadata"].update({"has_embeddings_record_v1": True})
        group_data, stacktrace_string = lookup_group_data_stacktrace_single(
            self.project,
            event_with_record.event_id,
            event_with_record.group_id,
            event_with_record.group.message,
        )
        assert (group_data, stacktrace_string) == (None, "")

    @patch("sentry.tasks.backfill_seer_grouping_records.metrics")
    def test_lookup_group_data_stacktrace_bulk_success(self, mock_metrics):
        """Test successful bulk group data and stacktrace lookup"""
        rows, events = self.bulk_rows, self.bulk_events
        bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
            self.project, rows
        )

        expected_event_ids = {event.event_id for event in events}
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(10)
        ]
        assert bulk_event_ids == expected_event_ids
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
        rows = self.bulk_rows

        for exception in exceptions:
            mock_get_multi.side_effect = exception
            bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
                self.project, rows
            )
            assert bulk_event_ids == set()
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
        rows, events = self.bulk_rows[:2], self.bulk_events[:2]
        # Add one event where the stacktrace is not used for grouping
        event = self.store_event(
            data={"exception": EXCEPTION, "fingerprint": ["2"]},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        rows.append(
            {"event_id": event.event_id, "group_id": event.group_id, "message": event.group.message}
        )

        bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
            self.project, rows
        )
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_no_stacktrace_exception(self):
        """
        Test that if a group does not have a stacktrace, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events = self.bulk_rows[:2], self.bulk_events[:2]
        # Create one event where the stacktrace has no exception
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        rows.append(
            {"event_id": event.event_id, "group_id": event.group_id, "message": event.group.message}
        )

        bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
            self.project, rows
        )
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_no_event_metadata(self):
        """
        Test that if a group does not have metadata, meaning the embeddings record does not exist,
        it is still included in the bulk lookup result
        """
        # Use 3 events
        rows, events = self.bulk_rows[:3], copy.deepcopy(self.bulk_events[:3])
        # Delete the metadata from one event
        del events[2].group.data["metadata"]
        events[2].group.save()

        bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
            self.project, rows
        )
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(3)
        ]
        assert bulk_event_ids == {event.event_id for event in events}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_record_exists(self):
        """
        Test that if a group already has an embeddings record, it is not included in the bulk
        lookup result
        """
        # Use 3 events
        rows, events = self.bulk_rows[:3], copy.deepcopy(self.bulk_events[:3])
        # Update metadata to say one group has an embeddings record
        events[2].group.data["metadata"].update({"has_embeddings_record_v1": True})
        events[2].group.save()

        bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(
            self.project, rows
        )
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events[:2]
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(2)
        ]
        assert bulk_event_ids == {event.event_id for event in events[:2]}
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_with_fallback_success(self):
        """Test successful bulk lookup with fallback, where the fallback isn't used"""
        rows, events = self.bulk_rows, self.bulk_events
        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows
        )

        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
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
            grouping_info = get_grouping_info(
                None, project=self.project, event_id=event.event_id, event=event
            )
            stacktrace_string = get_stacktrace_string(grouping_info)
            group_data.append(
                CreateGroupingRecordData(
                    group_id=event.group_id, project_id=self.project.id, message=event.group.message
                )
            )
            stacktrace_strings.append(stacktrace_string)
        mock_lookup_group_data_stacktrace_bulk.return_value = (
            {event.event_id for event in events_missing_two},
            GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        )

        rows = self.bulk_rows
        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows
        )

        events = self.bulk_events
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
            for i in range(10)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    @patch("sentry.tasks.backfill_seer_grouping_records.logger")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_event_lookup_error(self, mock_logger):
        """
        Test bulk lookup with fallback catches EventLookupError and returns data for events that
        were found
        """
        rows = copy.deepcopy(self.bulk_rows)
        # Purposely change the event id of the last row to one that does not exist
        rows[-1]["event_id"] = 10000

        bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk_with_fallback(
            self.project, rows
        )

        events = self.bulk_events[:-1]
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group_id, project_id=self.project.id, message=event.group.message
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", line function_{i}'
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
    @patch("sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success(self, mock_post_bulk_grouping_records):
        """
        Test that the redis key updates after a successfull call to seer create record endpoint
        """
        mock_post_bulk_grouping_records.return_value = {"success": True}
        num_groups_records_created = backfill_seer_grouping_records(self.project)

        for group in Group.objects.all():
            assert group.data["metadata"]["has_embeddings_record_v1"]
        assert num_groups_records_created == len(Group.objects.all())

    @with_feature("projects:similarity-embeddings-grouping")
    def test_backfill_seer_grouping_records_failure(self):
        """
        Test that the redis key does not update after a failed call to seer create record endpoint,
        and that the group metadata isn't updated on a failure.
        Test that the next call to the backfill_seer_grouping_records updates the redis key.
        """
        with patch(
            "sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records"
        ) as mock_post_bulk_grouping_records:
            mock_post_bulk_grouping_records.return_value = {"success": False}
            num_groups_records_created = backfill_seer_grouping_records(self.project)
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)

        assert last_processed_id == 0
        for group in Group.objects.all():
            assert not group.data["metadata"].get("has_embeddings_record_v1")
        assert num_groups_records_created == 0

        with patch(
            "sentry.tasks.backfill_seer_grouping_records.post_bulk_grouping_records"
        ) as mock_post_bulk_grouping_records:
            mock_post_bulk_grouping_records.return_value = {"success": True}
            num_groups_records_created = backfill_seer_grouping_records(self.project)
        redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)
        assert last_processed_id != 0
        for group in Group.objects.all():
            assert group.data["metadata"]["has_embeddings_record_v1"]
        assert num_groups_records_created == len(Group.objects.all())

    def test_backfill_seer_grouping_records_no_feature(self):
        """
        Test that the function does not create records when there is no feature flag
        """
        project = self.create_project(organization=self.organization)
        num_groups_records_created = backfill_seer_grouping_records(project)
        assert num_groups_records_created == 0
        for group in Group.objects.all():
            assert not group.data["metadata"].get("has_embeddings_record_v1")
