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
from google.api_core.exceptions import ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request
from urllib3.response import HTTPResponse

from sentry import options
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import Event
from sentry.grouping.api import GroupingConfigNotFound
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.grouping_records import CreateGroupingRecordData
from sentry.seer.similarity.types import RawSeerSimilarIssueData
from sentry.seer.similarity.utils import MAX_FRAME_COUNT
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project import (
    backfill_seer_grouping_records_for_project,
)
from sentry.tasks.embeddings_grouping.constants import PROJECT_BACKFILL_COMPLETED
from sentry.tasks.embeddings_grouping.utils import (
    _make_postgres_call_with_filter,
    get_data_from_snuba,
    get_events_from_nodestore,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.safe import get_path
from sentry.utils.snuba import QueryTooManySimultaneous, RateLimitExceeded, bulk_snuba_queries

EXCEPTION: dict[str, Any] = {
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
ONLY_STACKTRACE = {
    "stacktrace": {
        "frames": [
            {
                "function": "Cake\\Http\\Server::run",
                "filename": "/var/www/gib-potato/vendor/cakephp/cakephp/src/Http/Server.php",
                "abs_path": "/var/www/gib-potato/vendor/cakephp/cakephp/src/Http/Server.php",
                "lineno": 104,
                "in_app": False,
            },
            {
                "function": "App\\Middleware\\SentryMiddleware::process",
                "filename": "/var/www/gib-potato/src/Middleware/SentryMiddleware.php",
                "abs_path": "/var/www/gib-potato/src/Middleware/SentryMiddleware.php",
                "lineno": 65,
                "in_app": False,
            },
        ]
    }
}
EVENT_WITH_THREADS_STACKTRACE = {
    "threads": {
        "values": [
            {
                "stacktrace": {
                    "frames": [
                        {
                            "function": "run",
                            "module": "java.lang.Thread",
                            "filename": "Thread.java",
                            "abs_path": "Thread.java",
                            "lineno": 834,
                            "in_app": False,
                        },
                    ]
                }
            }
        ]
    },
}


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
                "timestamp": before_now(seconds=10).isoformat(),
                "title": "title",
            }
            event = self.create_event(self.project.id, data, times_seen=5)
            assert event.group is not None
            events.append(event)
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

    def create_event(
        self, project_id: int, data: Mapping[str, Any] | None = None, times_seen: int = 1
    ) -> Event:
        _data = (
            {
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": before_now(seconds=10).isoformat(),
            }
            if data is None
            else data
        )
        event = self.store_event(
            data=_data,
            project_id=project_id,
            assert_no_errors=False,
        )
        assert event.group is not None
        if times_seen > 1:
            event.group.times_seen = times_seen
            event.group.save()
        return event

    def assert_groups_metadata_updated(self, groups: BaseQuerySet[Group, Group]) -> None:
        for group in groups:
            hashes = self.group_hashes.get(group.id)
            if not hashes:
                hashes = GroupHash.objects.get(group_id=group.id).hash
            self.assert_group_metadata_updated(group, hashes)

    def assert_group_metadata_updated(self, group: Group, hashes: str) -> None:
        assert group.data["metadata"].get("seer_similarity") == {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": hashes,
        }

    def assert_groups_metadata_not_updated(self, groups: BaseQuerySet[Group, Group]) -> None:
        for group in groups:
            self.assert_group_metadata_not_updated(group)

    def assert_group_metadata_not_updated(self, group: Group) -> None:
        assert group.data["metadata"].get("seer_similarity") is None

    def setUp(self):
        super().setUp()
        bulk_data = self.create_group_event_rows(5)
        self.event = bulk_data["events"][0]
        self.bulk_rows, self.bulk_events = (bulk_data["rows"], bulk_data["events"])

        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

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

    def test_lookup_group_data_stacktrace_bulk_not_stacktrace_grouping(self):
        """
        Test that if a group does not use the stacktrace for grouping, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}
        # Add one event where the stacktrace is not used for grouping
        event = self.create_event(
            self.project.id,
            data={"exception": EXCEPTION, "title": "title", "fingerprint": ["2"]},
        )
        assert event.group is not None
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
        event = self.create_event(self.project.id, data={})
        assert event.group is not None
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        hashes.update({event.group_id: GroupHash.objects.get(group_id=event.group.id).hash})

        bulk_group_data_stacktraces, _ = get_events_from_nodestore(self.project, rows, group_ids)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
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

    @patch("sentry.seer.similarity.utils.metrics")
    def test_lookup_group_data_stacktrace_bulk_invalid_stacktrace_exception(self, mock_metrics):
        """
        Test that if a group has over MAX_FRAME_COUNT frames, its data is not included in
        the bulk lookup result
        """
        # Use 2 events
        rows, events, hashes = self.bulk_rows[:2], self.bulk_events[:2], {}
        group_ids = [row["group_id"] for row in rows]
        for group_id in group_ids:
            hashes.update({group_id: self.group_hashes[group_id]})
        # Create one event where the stacktrace has over MAX_FRAME_COUNT frames
        exception = copy.deepcopy(EXCEPTION)
        exception["values"][0]["stacktrace"]["frames"] = [
            {
                "function": f"divide_by_zero_{i}",
                "module": "__main__",
                "filename": "java_onboarding_{i}.java",
                "abs_path": "/Users/user/java_onboarding/java_onboarding_{i}.java",
                "lineno": i,
                "in_app": False,
            }
            for i in range(MAX_FRAME_COUNT + 1)
        ]
        event = self.create_event(
            self.project.id,
            data={
                "platform": "java",
                "exception": exception,
                "title": "title",
                "timestamp": before_now(seconds=10).isoformat(),
            },
        )
        assert event.group is not None
        rows.append({"event_id": event.event_id, "group_id": event.group_id})
        group_hash = GroupHash.objects.filter(group_id=event.group.id).first()
        assert group_hash
        hashes.update({event.group_id: group_hash.hash})

        bulk_group_data_stacktraces, _ = get_events_from_nodestore(self.project, rows, group_ids)
        expected_group_data = [
            CreateGroupingRecordData(
                group_id=event.group.id,
                hash=hashes[event.group.id],
                project_id=self.project.id,
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

        sample_rate = options.get("seer.similarity.metrics_sample_rate")
        mock_metrics.incr.assert_called_with(
            "grouping.similarity.frame_count_filter",
            sample_rate=sample_rate,
            tags={
                "platform": "java",
                "referrer": "backfill",
                "stacktrace_type": "system",
                "outcome": "block",
            },
        )

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

    @patch("time.sleep", return_value=None)
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch(
        "sentry.tasks.embeddings_grouping.utils.bulk_snuba_queries", side_effect=RateLimitExceeded
    )
    def test_get_data_from_snuba_rate_limit_exception(
        self, mock_bulk_snuba_queries, mock_logger, mock_sleep
    ):
        group_ids_last_seen = {
            group.id: group.last_seen for group in Group.objects.filter(project_id=self.project.id)
        }
        with pytest.raises(Exception):
            get_data_from_snuba(self.project, group_ids_last_seen)
        mock_logger.exception.assert_called_with(
            "tasks.backfill_seer_grouping_records.snuba_query_limit_exceeded",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "error": "Snuba Rate Limit Exceeded",
            },
        )

    @patch("time.sleep", return_value=None)
    @patch("sentry.tasks.embeddings_grouping.utils.logger")
    @patch(
        "sentry.tasks.embeddings_grouping.utils.bulk_snuba_queries",
        side_effect=QueryTooManySimultaneous,
    )
    def test_get_data_from_snuba_too_many_simultaneous_exception(
        self, mock_bulk_snuba_queries, mock_logger, mock_sleep
    ):
        group_ids_last_seen = {
            group.id: group.last_seen for group in Group.objects.filter(project_id=self.project.id)
        }
        with pytest.raises(Exception):
            get_data_from_snuba(self.project, group_ids_last_seen)
        mock_logger.exception.assert_called_with(
            "tasks.backfill_seer_grouping_records.snuba_query_limit_exceeded",
            extra={
                "organization_id": self.project.organization.id,
                "project_id": self.project.id,
                "error": "Too Many Simultaneous Snuba Queries",
            },
        )

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_success_simple(self, mock_post_bulk_grouping_records):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id)
        self.assert_groups_metadata_updated(groups)

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    @override_options(
        {"similarity.backfill_seer_threads": 2, "similarity.backfill_seer_chunk_size": 10}
    )
    def test_backfill_seer_grouping_records_success_cohorts_simple(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        project2 = self.create_project(organization=self.organization)
        self.create_event(project2.id, times_seen=5)
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                cohort=[self.project.id, project2.id],
                last_processed_project_index_input=0,
            )

        groups = Group.objects.filter(project_id__in=[self.project.id, project2.id])
        self.assert_groups_metadata_updated(groups)

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    @override_options(
        {"similarity.backfill_seer_threads": 2, "similarity.backfill_seer_chunk_size": 10}
    )
    def test_backfill_seer_grouping_records_success_cohorts_project_does_not_exist(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that the metadata is set for all groups showing that the record has been created.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=99999999999999,
                cohort=[99999999999999, self.project.id],
                last_processed_project_index_input=0,
            )

        groups = Group.objects.filter(project_id__in=[99999999999999, self.project.id])
        self.assert_groups_metadata_updated(groups)

    @patch("time.sleep", return_value=None)
    @patch(
        "sentry.nodestore.backend.get_multi",
        side_effect=ServiceUnavailable(message="Service Unavailable"),
    )
    def test_backfill_seer_grouping_records_failure(self, mock_get_multi, mock_sleep):
        """
        Test that the group metadata isn't updated on a failure.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id)
        self.assert_groups_metadata_not_updated(groups)

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
        for i in range(5):
            data = {
                "exception": self.create_exception_values(
                    function_names[i], type_names[i], value_names[i]
                ),
                "title": "title",
                "timestamp": before_now(seconds=10).isoformat(),
            }
            self.create_event(self.project.id, data)

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        self.assert_groups_metadata_updated(groups)
        groups_seen_once = Group.objects.filter(project_id=self.project.id, times_seen=1)
        self.assert_groups_metadata_not_updated(groups_seen_once)

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
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.create_event(self.project.id, data, times_seen=2)
        assert event.group is not None

        # Make the similar group a hash that does not exist
        group_with_neighbor[str(event.group.id)] = RawSeerSimilarIssueData(
            stacktrace_distance=0.01,
            should_group=True,
            parent_hash="00000000000000000000000000000000",
        )

        mock_post_bulk_grouping_records.return_value = {
            "success": True,
            "groups_with_neighbor": group_with_neighbor,
        }

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id, times_seen__gt=1)
        for group in groups:
            if str(group.id) not in group_with_neighbor:
                self.assert_group_metadata_updated(group, self.group_hashes[group.id])
            else:
                self.assert_group_metadata_not_updated(group)
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
                "timestamp": before_now(seconds=10).isoformat(),
            }
            self.create_event(self.project.id, data, times_seen=2)

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                cohort=None,
                last_processed_project_index_input=0,
            )

        groups = Group.objects.filter(project_id=self.project.id)
        self.assert_groups_metadata_updated(groups)

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
                    "worker_number": None,
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
                    "worker_number": None,
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
                    "worker_number": None,
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
                    "batch_len": 5,
                    "last_processed_group_id": project_group_ids[-1],
                },
            ),
            call(
                "backfill_seer_grouping_records.bulk_update",
                extra={"project_id": self.project.id, "num_updated": 5},
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
                "timestamp": before_now(seconds=10).isoformat(),
            }
            event = self.create_event(self.project.id, data, times_seen=2)
            assert event.group is not None
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

    @patch("sentry.tasks.embeddings_grouping.utils.delete_project_grouping_records")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_cohort_only_delete(
        self, mock_post_bulk_grouping_records, mock_delete_grouping_records
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
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=project2.id,
            assert_no_errors=False,
        )
        event2.group.times_seen = 5
        event2.group.save()
        group_hashes = GroupHash.objects.all().distinct("group_id")
        self.group_hashes = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}
        projects = [self.project.id, project2.id]

        # First generate all data - not using only_delete
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                cohort=projects,
                last_processed_project_index_input=0,
            )
        groups = Group.objects.filter(project_id__in=projects)
        self.assert_groups_metadata_updated(groups)

        # Now delete the data
        mock_delete_grouping_records.return_value = True
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                current_project_id=self.project.id,
                cohort=projects,
                last_processed_project_index_input=0,
                only_delete=True,
            )

        groups = Group.objects.filter(project_id__in=projects)
        self.assert_groups_metadata_not_updated(groups)

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_exclude_groups_pending_deletion(
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
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.PENDING_DELETION
        event.group.substatus = None
        event.group.save()
        deleted_group_ids.append(event.group.id)

        data = {
            "exception": self.create_exception_values("function name?", "type?", "value?"),
            "title": "title",
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.DELETION_IN_PROGRESS
        event.group.substatus = None
        event.group.save()
        deleted_group_ids.append(event.group.id)

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id__in=deleted_group_ids)
        self.assert_groups_metadata_updated(groups)
        groups = Group.objects.filter(project_id=self.project.id, id__in=deleted_group_ids)
        self.assert_groups_metadata_not_updated(groups)

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
            backfill_seer_grouping_records_for_project(self.project.id)

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
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.last_seen = datetime.now(UTC) - timedelta(days=90)
        event.group.save()
        old_group_id = event.group.id

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id=old_group_id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        # Assert metadata was not set for groups that is 90 days old
        old_group = Group.objects.get(project_id=self.project.id, id=old_group_id)
        assert old_group.data["metadata"].get("seer_similarity") is None

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
            backfill_seer_grouping_records_for_project(self.project.id)

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
            skip_processed_projects=True,
            skip_project_ids=None,
            worker_number=None,
        )

    @patch("sentry.tasks.embeddings_grouping.utils.lookup_group_data_stacktrace_bulk")
    @patch(
        "sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.call_next_backfill"
    )
    def test_backfill_seer_grouping_records_nodestore_grouping_config_not_found(
        self, mock_call_next_backfill, mock_lookup_group_data_stacktrace_bulk
    ):
        exceptions = (GroupingConfigNotFound(), ResourceDoesNotExist(), InvalidEnhancerConfig())

        for exception in exceptions:
            mock_lookup_group_data_stacktrace_bulk.side_effect = exception

            with TaskRunner():
                backfill_seer_grouping_records_for_project(self.project.id)

            groups = Group.objects.all()
            group_ids_sorted = sorted([group.id for group in groups], reverse=True)
            mock_call_next_backfill.assert_called_with(
                last_processed_group_id=group_ids_sorted[-1],
                project_id=self.project.id,
                last_processed_project_index=0,
                cohort=None,
                enable_ingestion=False,
                skip_processed_projects=True,
                skip_project_ids=None,
                worker_number=None,
            )

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
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id).exclude(id=event.group.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        group_no_grouping_stacktrace = Group.objects.get(id=event.group.id)
        assert group_no_grouping_stacktrace.data["metadata"].get("seer_similarity") is None

    @override_options({"seer.similarity-backfill-killswitch.enabled": True})
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_killswitch_enabled(self, mock_logger):
        """
        Test that the metadata is not set for groups when the backfill killswitch is true.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert not group.data["metadata"].get("seer_similarity")
        mock_logger.info.assert_called_with(
            "backfill_seer_grouping_records.killswitch_enabled",
        )

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
            backfill_seer_grouping_records_for_project(self.project.id, enable_ingestion=True)

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
        assert self.project.get_option(PROJECT_BACKFILL_COMPLETED) is not None

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_no_enable_ingestion(
        self, mock_post_bulk_grouping_records
    ):
        """
        Test that when the enable_ingestion flag is False, the project option is not set.
        """
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}

        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

        groups = Group.objects.filter(project_id=self.project.id)
        for group in groups:
            assert group.data["metadata"].get("seer_similarity") == {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": self.group_hashes[group.id],
            }

        assert self.project.get_option(PROJECT_BACKFILL_COMPLETED) is None

    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_skip_project_already_processed(self, mock_logger):
        """
        Test that projects that have a backfill completed project option are skipped.
        """
        self.project.update_option(PROJECT_BACKFILL_COMPLETED, int(time.time()))
        with TaskRunner():
            backfill_seer_grouping_records_for_project(self.project.id)

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
                    "worker_number": None,
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

    @override_options({"similarity.backfill_total_worker_count": 1})
    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_seer_grouping_records_typical_backfill_request(
        self, mock_post_bulk_grouping_records, mock_logger
    ):
        """
        Test that projects that have the backfill completed option set are skipped when we backfill
        all projects.
        """
        # Create two more projects and one of them is already backfilled
        project2 = self.create_project(organization=self.organization)
        project2.update_option(PROJECT_BACKFILL_COMPLETED, int(time.time()))
        project3 = self.create_project(organization=self.organization)

        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            # This is the typical way of backfilling all projects
            backfill_seer_grouping_records_for_project(
                current_project_id=None,
                enable_ingestion=True,
                worker_number=0,
            )

        key = "backfill_seer_grouping_records"
        # Since we set the total worker count to 1, the project cohort will have all projects
        # except the one that has already been backfilled
        cohort = [self.project.id, project3.id]
        extra = {
            "current_project_id": self.project.id,
            "last_processed_group_id": None,
            "cohort": cohort,
            "last_processed_project_index": None,
            "only_delete": False,
            "skip_processed_projects": True,
            "skip_project_ids": None,
            "worker_number": 0,
        }
        last_group_id = sorted(
            [group.id for group in Group.objects.filter(project_id=self.project.id)]
        )[0]
        expected_call_args_list = [
            call(key, extra=extra),
            call(
                key,
                extra={
                    **extra,
                    "last_processed_group_id": last_group_id,
                    "last_processed_project_index": 0,
                },
            ),
            call(
                key,
                extra={
                    **extra,
                    "current_project_id": project3.id,
                    "last_processed_project_index": 1,
                },
            ),
            call("reached the end of the projects in cohort", extra={"worker_number": 0}),
        ]
        assert mock_logger.info.call_args_list == expected_call_args_list
        assert self.project.get_option(PROJECT_BACKFILL_COMPLETED) is not None
        assert project3.get_option(PROJECT_BACKFILL_COMPLETED) is not None

    @patch("sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project.logger")
    def test_backfill_seer_grouping_records_manually_skip_project(self, mock_logger):
        """
        Test that project ids that are included in the skip_project_ids field are skipped.
        """
        with TaskRunner():
            backfill_seer_grouping_records_for_project(
                self.project.id, skip_project_ids=[self.project.id]
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
                    "skip_project_ids": [self.project.id],
                    "worker_number": None,
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
                "timestamp": before_now(seconds=10).isoformat(),
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
                "timestamp": before_now(seconds=10).isoformat(),
            }
            event = self.store_event(
                data=data, project_id=project_invalid_batch.id, assert_no_errors=False
            )
            event.group.times_seen = 1 if i < batch_size / 2 else 2
            event.group.status = (
                GroupStatus.PENDING_DELETION if i >= batch_size / 2 else GroupStatus.UNRESOLVED
            )
            event.group.substatus = None
            event.group.save()
            group_ids_invalid.append(event.group.id)
        group_ids_invalid.sort()

        with TaskRunner():
            backfill_seer_grouping_records_for_project(project_invalid_batch.id)

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
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=self.project.id, assert_no_errors=False)
        event.group.times_seen = 2
        event.group.status = GroupStatus.PENDING_DELETION
        event.group.substatus = None
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
            backfill_seer_grouping_records_for_project(self.project.id)

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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.seer_failed",
                extra={
                    "reason": "Gateway Timeout",
                    "current_project_id": self.project.id,
                    "last_processed_project_index": 0,
                    "worker_number": None,
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
                    "worker_number": None,
                },
            ),
            call("backfill finished, no cohort", extra={"project_id": self.project.id}),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

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
            backfill_seer_grouping_records_for_project(self.project.id)

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
                    "worker_number": None,
                },
            ),
            call(
                "backfill_seer_grouping_records.seer_failed",
                extra={
                    "reason": "Internal Error",
                    "current_project_id": self.project.id,
                    "last_processed_project_index": 0,
                    "worker_number": None,
                },
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
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

        project_same_cohort = self.create_project(
            organization=self.organization, id=self.project.id + thread_number
        )
        event_same_cohort = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": before_now(seconds=10).isoformat(),
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
                current_project_id=None, worker_number=worker_number
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
                },
            ),
            call(
                "reached the end of the projects in cohort", extra={"worker_number": worker_number}
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @override_options({"similarity.new_project_seer_grouping.enabled": True})
    @override_options({"similarity.backfill_project_cohort_size": 1})
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

        project_same_worker = self.create_project(
            organization=self.organization, id=self.project.id + thread_number
        )
        event_same_worker = self.store_event(
            data={
                "exception": EXCEPTION,
                "title": "title",
                "timestamp": before_now(seconds=10).isoformat(),
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
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
                    "skip_processed_projects": True,
                    "skip_project_ids": None,
                    "worker_number": worker_number,
                },
            ),
            call(
                "reached the end of the projects in cohort", extra={"worker_number": worker_number}
            ),
        ]

        assert mock_logger.info.call_args_list == expected_call_args_list

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_for_project_with_only_stacktrace(self, mock_post_bulk_grouping_records):
        project = self.create_project(organization=self.organization)
        data = {
            **ONLY_STACKTRACE,
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=project.id)
        event.group.times_seen = 2
        event.group.save()
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(project.id, None)

        group = Group.objects.get(id=event.group.id)
        assert group.data["metadata"].get("seer_similarity") == {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": ANY,
        }

    @patch("sentry.tasks.embeddings_grouping.utils.post_bulk_grouping_records")
    def test_backfill_for_project_with_threads_stacktrace(self, mock_post_bulk_grouping_records):
        project = self.create_project(organization=self.organization)
        data = {
            **EVENT_WITH_THREADS_STACKTRACE,
            "timestamp": before_now(seconds=10).isoformat(),
        }
        event = self.store_event(data=data, project_id=project.id)
        event.group.times_seen = 2
        event.group.save()
        mock_post_bulk_grouping_records.return_value = {"success": True, "groups_with_neighbor": {}}
        with TaskRunner():
            backfill_seer_grouping_records_for_project(project.id)

        group = Group.objects.get(id=event.group.id)
        assert group.data["metadata"].get("seer_similarity") == {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": ANY,
        }
