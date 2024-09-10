import copy
import time
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from random import choice
from string import ascii_uppercase
from typing import Any
from unittest.mock import ANY, call, patch

import pytest
from django.db.models import Q
from django.test import override_settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request
from urllib3.response import HTTPResponse

from sentry import options
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.grouping_records import CreateGroupingRecordData
from sentry.seer.similarity.types import RawSeerSimilarIssueData
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project import (
    backfill_seer_grouping_records_for_project,
)
from sentry.tasks.embeddings_grouping.utils import (
    _make_postgres_call_with_filter,
    get_data_from_snuba,
    get_events_from_nodestore,
    lookup_event,
    lookup_group_data_stacktrace_bulk,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.safe import get_path
from sentry.utils.snuba import RateLimitExceeded, bulk_snuba_queries

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
    ],
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
        rows, events = [], []
        function_names = [f"function_{str(i)}" for i in range(num)]
        type_names = [f"Error{str(i)}" for i in range(num)]
        value_names = ["error with value" for _ in range(num)]
        for i in range(num):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "timestamp": iso_format(before_now(seconds=10)),
                "title": "title",
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            events.append(event)
            event.group.times_seen = 5
            event.group.save()
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
                hash="".join(choice(ascii_uppercase) for _ in range(32)),
            )

        return {"rows": rows, "events": events}

    def setUp(self):
        super().setUp()
        bulk_data = self.create_group_event_rows(5)
        self.bulk_rows, self.bulk_events = (
            bulk_data["rows"],
            bulk_data["events"],
        )
        self.event = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
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

    def test_lookup_event_success(self):
        """Test single event lookup is successful"""
        found_event = lookup_event(self.project.id, self.event.event_id, self.event.group_id)

        assert self.event.event_id == found_event.event_id

    def test_lookup_event_event_lookup_error(self):
        """Test that EventLookupError is raised when an event does not exist"""
        with pytest.raises(EventLookupError):
            lookup_event(self.project.id, "1000000", 1000000)

    @patch("sentry.tasks.embeddings_grouping.utils.metrics")
    def test_lookup_group_data_stacktrace_bulk_success(self, mock_metrics):
        """Test successful bulk group data and stacktrace lookup"""
        rows, events = self.bulk_rows, self.bulk_events
        nodestore_results, _ = get_events_from_nodestore(
            self.project, rows, self.group_hashes.keys()
        )

        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=self.group_hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert nodestore_results["data"] == expected_group_data
        assert nodestore_results["stacktrace_list"] == expected_stacktraces
        mock_metrics.gauge.assert_called_with(
            "backfill_grouping_records._lookup_event_bulk.hit_ratio", 100, sample_rate=1.0
        )

    @patch("sentry.tasks.embeddings_grouping.utils.metrics")
    @override_options({"similarity.backfill_nodestore_use_multithread": True})
    def test_lookup_group_data_stacktrace_bulk_success_multithread(self, mock_metrics):
        """Test successful bulk group data and stacktrace lookup"""
        rows, events = self.bulk_rows, self.bulk_events
        nodestore_results, _ = get_events_from_nodestore(
            self.project, rows, self.group_hashes.keys()
        )

        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=self.group_hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert nodestore_results["data"] == expected_group_data
        assert nodestore_results["stacktrace_list"] == expected_stacktraces
        mock_metrics.gauge.assert_called_with(
            "backfill_grouping_records._lookup_event_bulk.hit_ratio", 100, sample_rate=1.0
        )

    @patch("time.sleep", return_value=None)
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
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
        rows = self.bulk_rows

        for exception in exceptions:
            mock_get_multi.side_effect = exception
            with pytest.raises(Exception):
                lookup_group_data_stacktrace_bulk(self.project, rows)
            mock_logger.exception.assert_called_with(
                "tasks.backfill_seer_grouping_records.bulk_event_lookup_exception",
                extra={
                    "organization_id": self.project.organization.id,
                    "project_id": self.project.id,
                    "node_keys": ANY,
                    "error": exception.message,
                },
            )

    def test_lookup_group_data_stacktrace_bulk_not_stacktrace_grouping(self):
        """
        Test that if a group does not use the stacktrace for grouping, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}
        # Add one event where the stacktrace is not used for grouping
        event = self.store_event(
            data={"exception": EXCEPTION, "title": "title", "fingerprint": ["2"]},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            hashes.update({group_id: self.group_hashes[group_id]})
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        hashes.update({event.group_id: GroupHash.objects.get(group_id=event.group.id).hash})

        nodestore_results, _ = get_events_from_nodestore(self.project, rows, group_ids)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(2)
        ]
        # assert bulk_event_ids == {event.event_id for event in events}
        # assert invalid_event_ids == {event.event_id}
        assert nodestore_results["data"] == expected_group_data
        assert nodestore_results["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_no_stacktrace_exception(self):
        """
        Test that if a group does not have a stacktrace, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            hashes.update({group_id: self.group_hashes[group_id]})
        # Create one event where the stacktrace has no exception
        event = self.store_event(data={}, project_id=self.project.id, assert_no_errors=False)
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        hashes.update({event.group_id: GroupHash.objects.get(group_id=event.group.id).hash})

        bulk_group_data_stacktraces, _ = get_events_from_nodestore(self.project, rows, group_ids)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(2)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    def test_lookup_group_data_stacktrace_bulk_with_fallback_success(self):
        """Test successful bulk lookup with fallback, where the fallback isn't used"""
        rows, events, hashes = (
            self.bulk_rows,
            self.bulk_events,
            self.group_hashes,
        )
        bulk_group_data_stacktraces, _ = get_events_from_nodestore(
            self.project, rows, self.group_hashes.keys()
        )

        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    @patch("sentry.nodestore.backend.get_multi")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_use_single_fallback(
        self, mock_get_multi
    ):
        """
        Test bulk lookup with fallback returns data for all events, where two events use single
        lookup as a fallback
        """
        # Purposely exclude two events from being included in the bulk lookup response, so that the fallback is used
        events_missing_two = self.bulk_events[:-2]
        mock_get_multi.return_value = {
            Event.generate_node_id(self.project.id, event_id=event.event_id): event.data
            for event in events_missing_two
        }

        rows, hashes = self.bulk_rows, self.group_hashes
        bulk_group_data_stacktraces, _ = get_events_from_nodestore(
            self.project, rows, self.group_hashes.keys()
        )

        events = self.bulk_events
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(5)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces

    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    def test_lookup_group_data_stacktrace_bulk_with_fallback_event_lookup_error(self, mock_logger):
        """
        Test bulk lookup with fallback catches EventLookupError and returns data for events that
        were found
        """
        rows, hashes = (
            copy.deepcopy(self.bulk_rows),
            self.group_hashes,
        )
        # Purposely change the event id of the last row to one that does not exist
        rows[-1]["event_id"] = 10000

        bulk_group_data_stacktraces, _ = get_events_from_nodestore(
            self.project, rows, self.group_hashes.keys()
        )

        events = self.bulk_events[:-1]
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
                message=event.title,
                exception_type=get_path(event.data, "exception", "values", -1, "type"),
            )
            for event in events
        ]
        expected_stacktraces = [
            f'Error{i}: error with value\n  File "function_{i}.py", function function_{i}'
            for i in range(4)
        ]
        assert bulk_group_data_stacktraces["data"] == expected_group_data
        assert bulk_group_data_stacktraces["stacktrace_list"] == expected_stacktraces
        mock_logger.error.assert_called_with(
            "tasks.backfill_seer_grouping_records.event_lookup_error",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "group_id": rows[-1]["group_id"],
                "event_id": 10000,
            },
        )

    def test_get_data_from_snuba(self):
        """
        Test that all groups are queried when chunked and queried individually.
        """
        group_ids_last_seen = {
            group.id: group.last_seen for group in Group.objects.filter(project_id=self.project.id)
        }
        group_event_rows = get_data_from_snuba(self.project, group_ids_last_seen)
        group_ids_results = [row["data"][0]["group_id"] for row in group_event_rows]
        for group_id in group_ids_last_seen:
            assert group_id in group_ids_results

    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch(
        "sentry.tasks.embeddings_grouping.utils.bulk_snuba_queries", side_effect=RateLimitExceeded
    )
    def test_get_data_from_snuba_exception(self, mock_bulk_snuba_queries, mock_logger):
        group_ids_last_seen = {
            group.id: group.last_seen for group in Group.objects.filter(project_id=self.project.id)
        }
        with pytest.raises(Exception):
            get_data_from_snuba(self.project, group_ids_last_seen)
        mock_logger.exception.assert_called_with(
            "tasks.backfill_seer_grouping_records.snuba_query_exception",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "error": "Snuba Rate Limit Exceeded",
            },
        )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success_simple(self, mock_post_bulk_grouping_records):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    @override_options(
        {"similarity.backfill_seer_threads": 2, "similarity.backfill_seer_chunk_size": 10}
    )
    def test_backfill_seer_grouping_records_success_cohorts_simple(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        project2 = self.create_project(organization=self.organization)
        event2 = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project2.id,
            assert_no_errors=False,
        )
        event2.group.times_seen = 5
        event2.group.save()
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                last_processed_group_id_input=None,
                cohort=[self.project.id, project2.id],
                last_processed_project_index_input=0,
            )

        groups = Group.objects.filter(project_id__in=[self.project.id, project2.id])
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        project_group_ids = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )
        project2_group_ids = sorted(
            [group.id for group in Group.objects.filter(project_id=project2.id)]
        )
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[0],
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[0],
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project2.id,
                    "last_processed_group_id": None,
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": project2.id}),
            call(
                "calling next backfill task",
                extra={"project_id": project2.id, "last_processed_group_id": project2_group_ids[0]},
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project2.id,
                    "last_processed_group_id": project2_group_ids[0],
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "reached the end of the project list",
                extra={
                    "cohort_name": [self.project.id, project2.id],
                    "last_processed_project_index": None,
                },
            ),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    @override_options(
        {"similarity.backfill_seer_threads": 2, "similarity.backfill_seer_chunk_size": 10}
    )
    def test_backfill_seer_grouping_records_success_cohorts_project_does_not_exist(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=99999999999999,
                last_processed_group_id_input=None,
                cohort=[99999999999999, self.project.id],
                last_processed_project_index_input=0,
            )

        last_processed_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]

        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": 99999999999999,
                    "last_processed_group_id": None,
                    "cohort": [99999999999999, self.project.id],
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.project_does_not_exist",
                extra={"current_project_id": 99999999999999},
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": [99999999999999, self.project.id],
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": last_processed_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": last_processed_group_id,
                    "cohort": [99999999999999, self.project.id],
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "reached the end of the project list",
                extra={
                    "cohort_name": [99999999999999, self.project.id],
                    "last_processed_project_index": None,
                },
            ),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success_cohorts_setting_defined(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        project2 = self.create_project(organization=self.organization)
        event2 = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project2.id,
            assert_no_errors=False,
        )
        event2.group.times_seen = 5
        event2.group.save()
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

        with TaskRunner(), override_settings(
            SIMILARITY_BACKFILL_COHORT_MAP={"test": [self.project.id, project2.id]}
        ):
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                last_processed_group_id_input=None,
                cohort="test",
                last_processed_project_index_input=0,
            )

        groups = Group.objects.filter(project_id__in=[self.project.id, project2.id])
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        project_group_ids = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )
        project2_group_ids = sorted(
            [group.id for group in Group.objects.filter(project_id=project2.id)]
        )
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": "test",
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[0],
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[0],
                    "cohort": "test",
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project2.id,
                    "last_processed_group_id": None,
                    "cohort": "test",
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": project2.id}),
            call(
                "calling next backfill task",
                extra={"project_id": project2.id, "last_processed_group_id": project2_group_ids[0]},
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project2.id,
                    "last_processed_group_id": project2_group_ids[0],
                    "cohort": "test",
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "reached the end of the project list",
                extra={
                    "cohort_name": "test",
                    "last_processed_project_index": None,
                },
            ),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @patch("time.sleep", return_value=None)
    @patch(
        "sentry.nodestore.backend.get_multi",
        side_effect=ServiceUnavailable(message="Service Unavailable"),
    )
    @patch(
        "sentry.tasks.embeddings_grouping.utils.lookup_event",
        side_effect=ServiceUnavailable(message="Service Unavailable"),
    )
    def test_backfill_seer_grouping_records_failure(
        self, mock_lookup_event, mock_get_multi, mock_sleep
    ):
        """
        Test that the group metadata isn't updated on a failure.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("seer_similarity")

    def test_backfill_seer_grouping_records_no_feature(self):
        """
        Test that the function does not create records when there is no feature flag
        """
        project = self.create_project(organization=self.organization)

        with TaskRunner():
            backfill_seer_grouping_records_for_project(project, None)

        for group in Group.objects.filter(project_id=self.project.id):
            assert not group.data["metadata"].get("seer_similarity")

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_groups_1_times_seen(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups where times_seen == 1 are not included.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        function_names = [f"new_function_{str(i)}" for i in range(5)]
        type_names = [f"NewError{str(i)}" for i in range(5)]
        value_names = ["error with value" for _ in range(5)]
        groups_seen_once = []
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            groups_seen_once.append(event.group)

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            if group not in groups_seen_once:
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": self.group_hashes[group.id],
                }
            else:
                assert group.data["metadata"].get("seer_similarity") is None

    @pytest.mark.skip(
        "this test is flakey in production; trying to replicate locally and skipping it for now"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
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
        value_names = ["error with value" for _ in range(5)]
        groups_with_neighbor = {}
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            event.group.times_seen = 2
            event.group.save()
            # Arbitrarily choose a parent group's hash that has times_seen = 5
            parent_group = Group.objects.get(times_seen__gt=2)
            parent_group_hash = GroupHash.objects.get(group_id=parent_group.id)
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
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        for group in groups:
            if str(group.id) not in groups_with_neighbor:
                assert group.data["metadata"].get("seer_similarity") == {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": self.group_hashes[group.id],
                }
            else:
                request_hash = GroupHash.objects.get(group_id=group.id).hash
                parent_group_id = Group.objects.get(times_seen__gt=2).id
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

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.delete_seer_grouping_records_by_hash")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_groups_has_invalid_neighbor(
        self, mock_post_bulk_grouping_records, mock_logger, mock_seer_deletion_request
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
            "title": "title",
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
            backfill_seer_grouping_records_for_project(self.project.id, None)

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
                mock_seer_deletion_request.delay.assert_called_with(
                    self.project.id, ["00000000000000000000000000000000"]
                )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_multiple_batches(
        self, mock_post_bulk_grouping_records, mock_backfill_logger, mock_utils_logger
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created,
        where number of groups > the batch size, 10.
        """
        function_names = [f"another_function_{str(i)}" for i in range(10)]
        type_names = [f"AnotherError{str(i)}" for i in range(10)]
        value_names = ["error with value" for _ in range(10)]
        for i in range(10):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
            event.group.times_seen = 2
            event.group.save()

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                last_processed_group_id_input=None,
                cohort=None,
                last_processed_project_index_input=0,
                skip_processed_projects=True,
            )

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") is not None

        batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")
        project_group_ids = sorted([group.id for group in groups], reverse=True)
        expected_backfill_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[batch_size - 1],
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[batch_size - 1],
                    "cohort": None,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[-1],
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[-1],
                    "cohort": None,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]
        assert mock_backfill_logger.info.call_args_list == expected_backfill_call_args_list

        expected_utils_call_args_list = [
            call(
                "backfill_seer_grouping_records.start",
                extra={"project_id": self.project.id, "last_processed_index": None},
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": self.project.id,
                    "batch_len": 10,
                    "last_processed_group_id": project_group_ids[batch_size - 1],
                },
            ),
            call(
                "backfill_seer_grouping_records.bulk_update",
                extra={"project_id": self.project.id, "num_updated": 10},
            ),
            call(
                "backfill_seer_grouping_records.start",
                extra={
                    "project_id": self.project.id,
                    "last_processed_index": project_group_ids[batch_size - 1],
                },
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": self.project.id,
                    "batch_len": 6,
                    "last_processed_group_id": project_group_ids[-1],
                },
            ),
            call(
                "backfill_seer_grouping_records.bulk_update",
                extra={"project_id": self.project.id, "num_updated": 6},
            ),
            call(
                "backfill_seer_grouping_records.start",
                extra={
                    "project_id": self.project.id,
                    "last_processed_index": project_group_ids[-1],
                },
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": self.project.id,
                    "batch_len": 0,
                    "last_processed_group_id": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.no_more_groups",
                extra={"project_id": self.project.id},
            ),
        ]
        assert mock_utils_logger.info.call_args_list == expected_utils_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.delete_project_grouping_records")
    def test_backfill_seer_grouping_records_only_delete(self, mock_project_delete_grouping_records):
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
                "title": "title",
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

        mock_project_delete_grouping_records.return_value = True
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None, only_delete=True)

        groups = Group.objects.filter(project_id=self.project.id, id__in=group_ids)
        for group in groups:
            assert group.data["metadata"] == default_metadata

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.delete_project_grouping_records")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_cohort_only_delete(
        self, mock_logger, mock_delete_grouping_records
    ):
        """
        Test that when the only_delete flag is on, seer_similarity is deleted from the metadata
        if it exists
        """

        project2 = self.create_project(organization=self.organization)
        event2 = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project2.id,
            assert_no_errors=False,
        )
        event2.group.times_seen = 5
        event2.group.save()
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

        mock_delete_grouping_records.return_value = True
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                last_processed_group_id_input=None,
                cohort=[self.project.id, project2.id],
                last_processed_project_index_input=0,
                only_delete=True,
            )
        assert mock_logger.info.call_args_list == [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 0,
                    "only_delete": True,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.deleted_all_records",
                extra={"current_project_id": self.project.id},
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project2.id,
                    "last_processed_group_id": None,
                    "cohort": [self.project.id, project2.id],
                    "last_processed_project_index": 1,
                    "only_delete": True,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.deleted_all_records",
                extra={"current_project_id": project2.id},
            ),
            call(
                "reached the end of the project list",
                extra={
                    "cohort_name": [self.project.id, project2.id],
                    "last_processed_project_index": None,
                },
            ),
        ]

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
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
            "title": "title",
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.PENDING_DELETION
        event.group.save()
        deleted_group_ids.append(event.group.id)

        data = {
            "exception": self.create_exception_values("function name?", "type?", "value?"),
            "title": "title",
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.DELETION_IN_PROGRESS
        event.group.save()
        deleted_group_ids.append(event.group.id)

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id__in=deleted_group_ids)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        # Assert metadata was not set for groups that will be deleted
        for group in Group.objects.filter(project_id=self.project.id, id__in=deleted_group_ids):
            assert group.data["metadata"].get("seer_similarity") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.bulk_snuba_queries")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
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
            backfill_seer_grouping_records_for_project(self.project.id, None)

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
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_exclude_90_day_old_groups(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that groups that are over 90 days old are excluded.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        # Create groups pending deletion and in the process of being deleted
        data = {
            "exception": self.create_exception_values("function name!", "type!", "value!"),
            "title": "title",
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.last_seen = datetime.now(UTC) - timedelta(days=90)
        event.group.save()
        old_group_id = event.group.id

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id=old_group_id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        # Assert metadata was not set for groups that is 90 days old
        old_group = Group.objects.get(project_id=self.project.id, id=old_group_id)
        assert old_group.data["metadata"].get("seer_similarity") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.lookup_group_data_stacktrace_bulk")
    @patch(
        "sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.call_next_backfill"
    )
    def test_backfill_seer_grouping_records_empty_nodestore(
        self,
        mock_call_next_backfill,
        mock_lookup_group_data_stacktrace_bulk,
        mock_logger,
    ):
        mock_lookup_group_data_stacktrace_bulk.return_value = []

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.all()
        group_ids_sorted = sorted([group.id for group in groups], reverse=True)
        mock_logger.info.assert_called_with(
            "tasks.backfill_seer_grouping_records.no_data",
            extra={
                "project_id": self.project.id,
                "group_id_batch": json.dumps(group_ids_sorted),
            },
        )
        mock_call_next_backfill.assert_called_with(
            last_processed_group_id=group_ids_sorted[-1],
            project_id=self.project.id,
            last_processed_project_index=0,
            cohort=None,
            enable_ingestion=False,
            skip_processed_projects=False,
            skip_project_ids=None,
            worker_number=None,
        )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_exclude_invalid_groups(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        # Add one event where the stacktrace is not used for grouping
        event = self.store_event(
            data={"exception": EXCEPTION, "title": "title", "fingerprint": ["2"]},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        event.group.times_seen = 5
        event.group.save()

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id=event.group.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        group_no_grouping_stacktrace = Group.objects.get(id=event.group.id)
        assert group_no_grouping_stacktrace.data["metadata"].get("seer_similarity") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @override_options({"seer.similarity-backfill-killswitch.enabled": True})
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_killswitch_enabled(self, mock_logger):
        """
        Test that the metadata is not set for groups when the backfill killswitch is true.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert not group.data["metadata"].get("seer_similarity")
        mock_logger.info.assert_called_with(
            "backfill_seer_grouping_records.killswitch_enabled",
        )

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_enable_ingestion(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that when the enable_ingestion flag is True, the project option is set and the
        log is called.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None, enable_ingestion=True)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        mock_logger.info.assert_called_with(
            "backfill_seer_grouping_records.enable_ingestion",
            extra={"project_id": self.project.id},
        )
        assert self.project.get_option("sentry:similarity_backfill_completed") is not None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_no_enable_ingestion(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that when the enable_ingestion flag is False, the project option is not set.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        assert self.project.get_option("sentry:similarity_backfill_completed") is None

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_skip_project_already_processed(self, mock_logger):
        """
        Test that projects that have a backfill completed project option are skipped when passed
        the skip_processed_projects flag.
        """
        self.project.update_option("sentry:similarity_backfill_completed", int(time.time()))
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                self.project.id, None, skip_processed_projects=True
            )

        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.project_skipped",
                extra={
                    "project_id": self.project.id,
                    "project_already_processed": True,
                    "project_manually_skipped": None,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_reprocess_project_already_processed(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that projects that have a backfill completed project option are not skipped when not
        passed the skip_processed_projects flag.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        self.project.update_option("sentry:similarity_backfill_completed", int(time.time()))
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={"project_id": self.project.id, "last_processed_group_id": last_group_id},
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": last_group_id,
                    "cohort": None,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_manually_skip_project(self, mock_logger):
        """
        Test that project ids that are included in the skip_project_ids field are skipped.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                self.project.id, None, skip_project_ids=[self.project.id]
            )

        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": [self.project.id],
                },
            ),
            call(
                "backfill_seer_grouping_records.project_skipped",
                extra={
                    "project_id": self.project.id,
                    "project_already_processed": False,
                    "project_manually_skipped": True,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_empty_batch(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that if a backfill batch is empty due to the filtering of invalid groups, the backfill
        task continues and calls the next batch.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        project_invalid_batch = self.create_project(organization=self.organization)
        batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")

        # Create batch size valid groups
        function_names = [f"another_function_{str(i)}" for i in range(batch_size)]
        type_names = [f"AnotherError{str(i)}" for i in range(batch_size)]
        value_names = ["error with value" for _ in range(batch_size)]
        group_ids = []
        for i in range(batch_size):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(
                data=data, project_id=project_invalid_batch.id, assert_no_errors=False
            )
            event.group.times_seen = 2
            # event.group.data["metadata"] = copy.deepcopy(default_metadata)
            event.group.save()
            group_ids.append(event.group.id)
        group_ids.sort()

        # Create batch size invalid groups (some with times seen == 1, others pending deletion)
        function_names = [f"function_{str(i)}" for i in range(batch_size)]
        type_names = [f"Error{str(i)}" for i in range(batch_size)]
        value_names = ["error with value" for _ in range(batch_size)]
        group_ids_invalid = []
        for i in range(batch_size):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            }
            event = self.store_event(
                data=data, project_id=project_invalid_batch.id, assert_no_errors=False
            )
            event.group.times_seen = 1 if i < batch_size / 2 else 2
            event.group.status = (
                GroupStatus.PENDING_DELETION if i >= batch_size / 2 else GroupStatus.UNRESOLVED
            )
            event.group.save()
            group_ids_invalid.append(event.group.id)
        group_ids_invalid.sort()

        with TaskRunner():
            backfill_seer_grouping_records_for_project(project_invalid_batch.id, None)

        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records.start",
                extra={"project_id": project_invalid_batch.id, "last_processed_index": None},
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": project_invalid_batch.id,
                    "batch_len": 0,
                    "last_processed_group_id": group_ids_invalid[0],
                },
            ),
            call(
                "backfill_seer_grouping_records.start",
                extra={
                    "project_id": project_invalid_batch.id,
                    "last_processed_index": group_ids_invalid[0],
                },
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": project_invalid_batch.id,
                    "batch_len": batch_size,
                    "last_processed_group_id": group_ids[0],
                },
            ),
            call(
                "backfill_seer_grouping_records.bulk_update",
                extra={"project_id": project_invalid_batch.id, "num_updated": batch_size},
            ),
            call(
                "backfill_seer_grouping_records.start",
                extra={
                    "project_id": project_invalid_batch.id,
                    "last_processed_index": group_ids[0],
                },
            ),
            call(
                "backfill_seer_grouping_records.batch",
                extra={
                    "project_id": project_invalid_batch.id,
                    "batch_len": 0,
                    "last_processed_group_id": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.no_more_groups",
                extra={"project_id": project_invalid_batch.id},
            ),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list

    def test_make_postgres_call_with_filter_invalid(self):
        """
        Test that invalid deleted group id not included in the batch to be backfilled, but its
        group id is saved to be used as the offset for the next batch query.
        """
        # Change batch size to 1 to force the invalid deleted group to be last id in the query results
        batch_size = 1

        data = {
            "exception": self.create_exception_values("function name!", "type!", "value!"),
            "title": "title",
            "timestamp": iso_format(before_now(seconds=10)),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.PENDING_DELETION
        event.group.save()
        deleted_group = event.group

        (
            groups_to_backfill_batch,
            batch_end_group_id,
            backfill_batch_raw_length,
        ) = _make_postgres_call_with_filter(Q(), self.project.id, batch_size)
        assert groups_to_backfill_batch == []
        assert batch_end_group_id == deleted_group.id
        assert backfill_batch_raw_length == 1

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.seer.similarity.grouping_records.seer_grouping_connection_pool.urlopen")
    def test_backfill_seer_grouping_records_gateway_timeout(self, mock_seer_request, mock_logger):
        """
        Test that if the backfill fails due to a Seer Gateway Timeout error, that the backfill continues.
        """
        mock_seer_request.return_value = HTTPResponse(
            b"<!doctype html>\n<html lang=en>\n<title>Gateway Timeout</title>\n",
            reason="Gateway Timeout",
            status=500,
        )
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        project_group_ids = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)], reverse=True
        )
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.seer_failed",
                extra={
                    "reason": "Gateway Timeout",
                    "current_project_id": self.project.id,
                    "last_processed_project_index": 0,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[-1],
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_group_ids[-1],
                    "cohort": None,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.seer.similarity.grouping_records.seer_grouping_connection_pool.urlopen")
    def test_backfill_seer_grouping_records_internal_error(self, mock_seer_request, mock_logger):
        """
        Test that if the backfill fails due to a non-Gateway Timeout error, that the backfill stops.
        """
        mock_seer_request.return_value = HTTPResponse(
            b"<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n",
            reason="Internal Error",
            status=500,
        )
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id, None)

        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": None,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.seer_failed",
                extra={
                    "reason": "Internal Error",
                    "current_project_id": self.project.id,
                    "last_processed_project_index": 0,
                },
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_cohort_creation(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that when no cohort or current project id is provided, cohorts of project ids are generated where \
        project_id % thread_number == worker_number
        """
        # Create 2 seer eligible projects that project_id % thread_number == worker_number
        thread_number = options.get("similarity.backfill_total_worker_count")
        worker_number = self.project.id % thread_number
        self.project.platform = "python"
        self.project.save()

        project_same_cohort = self.create_project(
            organization=self.organization, id=self.project.id + thread_number
        )
        project_same_cohort.platform = "javascript"
        project_same_cohort.save()
        event_same_cohort = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project_same_cohort.id,
            assert_no_errors=False,
        )
        event_same_cohort.group.times_seen = 5
        event_same_cohort.group.save()

        # Create one project where project_id % thread_number != worker_number
        self.create_project(organization=self.organization, id=self.project.id + 1)

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=None,
                last_processed_group_id_input=None,
                worker_number=worker_number,
            )

        project_last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]
        project_same_cohort_last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=project_same_cohort.id)]
        )[0]
        expected_cohort = [self.project.id, project_same_cohort.id]
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": expected_cohort,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                    "cohort": expected_cohort,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project_same_cohort.id,
                    "last_processed_group_id": None,
                    "cohort": expected_cohort,
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": project_same_cohort.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": project_same_cohort.id,
                    "last_processed_group_id": project_same_cohort_last_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project_same_cohort.id,
                    "last_processed_group_id": project_same_cohort_last_group_id,
                    "cohort": expected_cohort,
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "reached the end of the projects in cohort", extra={"worker_number": worker_number}
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_cohort_creation_not_seer_eligible(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that non Seer eligible projects are not processed when worker_number is provided.
        """
        # Create 1 seer eligible project that project_id % thread_number == worker_number
        thread_number = options.get("similarity.backfill_total_worker_count")
        worker_number = self.project.id % thread_number
        self.project.platform = "python"
        self.project.save()

        # Create 1 non seer eligible project that project_id % thread_number != worker_number
        project_same_cohort_not_eligible = self.create_project(
            organization=self.organization, id=self.project.id + thread_number
        )
        project_same_cohort_not_eligible.platform = "java"
        project_same_cohort_not_eligible.save()
        event_same_cohort = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project_same_cohort_not_eligible.id,
            assert_no_errors=False,
        )
        event_same_cohort.group.times_seen = 5
        event_same_cohort.group.save()

        # Create one project where project_id % thread_number != worker_number
        self.create_project(organization=self.organization, id=self.project.id + 1)

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=None,
                last_processed_group_id_input=None,
                worker_number=worker_number,
            )

        project_last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]

        expected_cohort = [self.project.id, project_same_cohort_not_eligible.id]
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": expected_cohort,
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                    "cohort": expected_cohort,
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project_same_cohort_not_eligible.id,
                    "last_processed_group_id": None,
                    "cohort": expected_cohort,
                    "last_processed_project_index": 1,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.project_is_not_seer_eligible",
                extra={"project_id": project_same_cohort_not_eligible.id},
            ),
            call(
                "reached the end of the projects in cohort", extra={"worker_number": worker_number}
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    @override_options({"similarity.backfill_project_cohort_size": 1})
    @with_feature("projects:similarity-embeddings-backfill")
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_cohort_creation_multiple_batches(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that when the cohort size is 1, multiple cohorts of size 1 are created and processed.
        """
        # Create 2 seer eligible projects that project_id % thread_number == worker_number
        thread_number = options.get("similarity.backfill_total_worker_count")
        worker_number = self.project.id % thread_number
        self.project.platform = "python"
        self.project.save()

        project_same_worker = self.create_project(
            organization=self.organization, id=self.project.id + thread_number
        )
        project_same_worker.platform = "javascript"
        project_same_worker.save()
        event_same_worker = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": iso_format(before_now(seconds=10)),
            },
            project_id=project_same_worker.id,
            assert_no_errors=False,
        )
        event_same_worker.group.times_seen = 5
        event_same_worker.group.save()

        # Create one project where project_id % thread_number != worker_number
        self.create_project(organization=self.organization, id=self.project.id + 1)

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=None,
                last_processed_group_id_input=None,
                worker_number=worker_number,
            )

        project_last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]
        project_same_cohort_last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=project_same_worker.id)]
        )[0]
        expected_call_args_list = [
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": None,
                    "cohort": [self.project.id],
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": self.project.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": self.project.id,
                    "last_processed_group_id": project_last_group_id,
                    "cohort": [self.project.id],
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project_same_worker.id,
                    "last_processed_group_id": None,
                    "cohort": [project_same_worker.id],
                    "last_processed_project_index": None,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call("about to call next backfill", extra={"project_id": project_same_worker.id}),
            call(
                "calling next backfill task",
                extra={
                    "project_id": project_same_worker.id,
                    "last_processed_group_id": project_same_cohort_last_group_id,
                },
            ),
            call(
                "backfill_seer_grouping_records",
                extra={
                    "current_project_id": project_same_worker.id,
                    "last_processed_group_id": project_same_cohort_last_group_id,
                    "cohort": [project_same_worker.id],
                    "last_processed_project_index": 0,
                    "only_delete": False,
                    "skip_processed_projects": False,
                    "skip_project_ids": None,
                },
            ),
            call(
                "reached the end of the projects in cohort", extra={"worker_number": worker_number}
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list
