from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import orjson
import pytest
from django.contrib.auth.models import AnonymousUser

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.ingest import save_issue_occurrence
from sentry.seer.autofix.autofix import (
    TIMEOUT_SECONDS,
    _call_autofix,
    _get_github_username_for_user,
    _get_logs_for_event,
    _get_profile_from_trace_tree,
    _get_trace_tree_for_event,
    _respond_with_error,
    get_all_tags_overview,
    trigger_autofix,
)
from sentry.seer.explorer.utils import _convert_profile_to_execution_tree
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class TestConvertProfileToExecutionTree(TestCase):
    def test_convert_profile_to_execution_tree(self) -> None:
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                    {
                        "function": "external",
                        "module": "external.lib",
                        "filename": "lib.py",
                        "lineno": 30,
                        "in_app": False,
                    },
                ],
                "stacks": [
                    [2, 1, 0]
                ],  # One stack with three frames. In a call stack, the first function is the last frame
                "samples": [{"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 10000000}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should only include in_app frames from the selected thread (MainThread in this case)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1  # One root node
        root = execution_tree[0]
        assert root["function"] == "main"
        assert root["module"] == "app.main"
        assert root["filename"] == "main.py"
        assert root["lineno"] == 10
        assert len(root["children"]) == 1

        child = root["children"][0]
        assert child["function"] == "helper"
        assert child["module"] == "app.utils"
        assert child["filename"] == "utils.py"
        assert child["lineno"] == 20
        assert len(child["children"]) == 0  # No children for the last in_app frame

    def test_convert_profile_to_execution_tree_non_main_thread(self) -> None:
        """Test that the thread with in_app frames is selected (even if not MainThread)"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "worker",
                        "module": "app.worker",
                        "filename": "worker.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "2", "elapsed_since_start_ns": 10000000}],
                "thread_metadata": {"2": {"name": "WorkerThread"}, "3": {"name": "WorkerThread2"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should include the worker thread since it has in_app frames
        assert selected_thread_id == "2"
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "worker"
        assert execution_tree[0]["filename"] == "worker.py"

    def test_convert_profile_to_execution_tree_merges_duplicate_frames(self) -> None:
        """Test that duplicate frames in different samples are merged correctly"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0], [0]],  # Two stacks with the same frame
                "samples": [
                    {"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 10000000},
                    {"stack_id": 1, "thread_id": "1", "elapsed_since_start_ns": 20000000},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should only have one node even though frame appears in multiple samples
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "main"

    def test_convert_profile_to_execution_tree_calculates_durations(self) -> None:
        """Test that durations are correctly calculated for nodes in the execution tree"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "process_data",
                        "module": "app.processing",
                        "filename": "processing.py",
                        "lineno": 25,
                        "in_app": True,
                    },
                    {
                        "function": "save_result",
                        "module": "app.storage",
                        "filename": "storage.py",
                        "lineno": 50,
                        "in_app": True,
                    },
                ],
                # Three stacks representing a call sequence: main → process_data → save_result → process_data → main
                "stacks": [
                    [0],  # main only
                    [1, 0],  # main → process_data
                    [2, 1, 0],  # main → process_data → save_result
                    [1, 0],  # main → process_data (returned from save_result)
                    [0],  # main only (returned from process_data)
                ],
                # 5 samples at 10ms intervals
                "samples": [
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 10000000,
                    },  # 10ms: main
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 20000000,
                    },  # 20ms: main → process_data
                    {
                        "stack_id": 2,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 30000000,
                    },  # 30ms: main → process_data → save_result
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 40000000,
                    },  # 40ms: main → process_data
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 50000000,
                    },  # 50ms: main
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should have one root node (main)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        root = execution_tree[0]
        assert root["function"] == "main"

        # Check root duration - should span the entire profile (50ms - 10ms + 10ms interval = 50ms)
        assert root["duration_ns"] == 50000000

        # Check process_data duration - should be active from 20ms to 40ms (20ms + 10ms interval = 30ms)
        assert len(root["children"]) == 1
        process_data = root["children"][0]
        assert process_data["function"] == "process_data"
        assert process_data["duration_ns"] == 30000000

        # Check save_result duration - should be active only at 30ms (10ms interval = 10ms)
        assert len(process_data["children"]) == 1
        save_result = process_data["children"][0]
        assert save_result["function"] == "save_result"
        assert save_result["duration_ns"] == 10000000

    def test_convert_profile_to_execution_tree_with_timestamp(self) -> None:
        """Test that _convert_profile_to_execution_tree works with continuous profiles using timestamp"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ],
                "stacks": [
                    [0],  # main only
                    [1, 0],  # main → helper
                ],
                # Samples using timestamp instead of elapsed_since_start_ns
                "samples": [
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "timestamp": 1672567200.0,  # Base timestamp (Unix timestamp)
                    },
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "timestamp": 1672567200.01,  # 10ms later
                    },
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "timestamp": 1672567200.02,  # 20ms later
                    },
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should have one root node (main)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        root = execution_tree[0]
        assert root["function"] == "main"
        assert root["module"] == "app.main"
        assert root["filename"] == "main.py"
        assert root["lineno"] == 10

        # Should have one child (helper)
        assert len(root["children"]) == 1
        child = root["children"][0]
        assert child["function"] == "helper"
        assert child["module"] == "app.utils"
        assert child["filename"] == "utils.py"
        assert child["lineno"] == 20
        assert len(child["children"]) == 0

        # Check durations are calculated correctly from timestamps
        # Root should span from 0ns to 20ms (0.02s * 1e9 = 20000000ns) + interval
        # Allow for small floating point precision differences
        assert abs(root["duration_ns"] - 30000000) < 100  # 20ms + 10ms interval
        # Helper should be active from 10ms to 10ms (10ms interval = 10000000ns)
        assert abs(child["duration_ns"] - 10000000) < 100


@pytest.mark.django_db
class TestGetTraceTreeForEvent(APITestCase, OccurrenceTestMixin):
    @patch("sentry.api.endpoints.organization_trace.OrganizationTraceEndpoint.query_trace_data")
    def test_get_trace_tree_basic(self, mock_query_trace_data) -> None:
        """Test that we can get a basic trace tree."""
        trace_id = "1234567890abcdef1234567890abcdef"
        event_data = load_data("python")
        event_data.update(
            {"contexts": {"trace": {"trace_id": trace_id, "span_id": "abcdef0123456789"}}}
        )
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Mock the trace data response
        mock_trace_data = [
            {
                "id": "aaaaaaaaaaaaaaaa",
                "description": "Test Transaction",
                "is_transaction": True,
                "children": [],
                "errors": [],
                "occurrences": [],
            }
        ]
        mock_query_trace_data.return_value = mock_trace_data

        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is not None
        assert trace_tree["trace_id"] == trace_id
        assert trace_tree["trace"] == mock_trace_data

    @patch("sentry.api.endpoints.organization_trace.OrganizationTraceEndpoint.query_trace_data")
    def test_get_trace_tree_empty(self, mock_query_trace_data) -> None:
        """Test that when no spans exist, trace tree returns None."""
        trace_id = "1234567890abcdef1234567890abcdef"
        event_data = load_data("python")
        event_data.update(
            {"contexts": {"trace": {"trace_id": trace_id, "span_id": "abcdef0123456789"}}}
        )
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Mock empty trace data
        mock_query_trace_data.return_value = []

        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is None

    def test_get_trace_tree_no_trace_id(self) -> None:
        """Test that events without trace_id return None."""
        event_data = load_data("python")
        # Don't set trace_id
        event = self.store_event(data=event_data, project_id=self.project.id)

        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is None

    @patch("sentry.api.endpoints.organization_trace.OrganizationTraceEndpoint.query_trace_data")
    def test_get_trace_tree_with_spans(self, mock_query_trace_data) -> None:
        """Test trace tree with multiple spans."""
        trace_id = "1234567890abcdef1234567890abcdef"
        event_data = load_data("python")
        event_data.update(
            {"contexts": {"trace": {"trace_id": trace_id, "span_id": "abcdef0123456789"}}}
        )
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Mock trace data with parent-child relationship
        mock_trace_data = [
            {
                "id": "aaaaaaaaaaaaaaaa",
                "description": "Parent Transaction",
                "is_transaction": True,
                "children": [
                    {
                        "id": "bbbbbbbbbbbbbbbb",
                        "description": "Child Operation",
                        "parent_span": "aaaaaaaaaaaaaaaa",
                        "children": [],
                        "errors": [],
                        "occurrences": [],
                    }
                ],
                "errors": [],
                "occurrences": [],
            }
        ]
        mock_query_trace_data.return_value = mock_trace_data

        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is not None
        assert trace_tree["trace_id"] == trace_id
        assert len(trace_tree["trace"]) == 1

        parent_span = trace_tree["trace"][0]
        assert parent_span["description"] == "Parent Transaction"
        assert len(parent_span["children"]) == 1

        child_span = parent_span["children"][0]
        assert child_span["description"] == "Child Operation"
        assert child_span["parent_span"] == "aaaaaaaaaaaaaaaa"

    @patch("sentry.api.endpoints.organization_trace.OrganizationTraceEndpoint.query_trace_data")
    def test_get_trace_tree_with_web_vital_issue(self, mock_query_trace_data) -> None:
        """Test that we can get a trace tree for a web vital issue."""
        trace_id = "1234567890abcdef1234567890abcdef"
        event_data = load_data("javascript")
        event_data.update(
            {"contexts": {"trace": {"trace_id": trace_id, "span_id": "abcdef0123456789"}}}
        )

        occurrence_data = self.build_occurrence_data(
            project_id=self.project.id,
            type=WebVitalsGroup.type_id,
            issue_title="LCP score needs improvement",
            subtitle="/test-transaction has an LCP score of 75",
            culprit="/test-transaction",
            evidence_data={
                "transaction": "/test-transaction",
                "vital": "lcp",
                "score": 75,
                "trace_id": trace_id,
            },
            level="info",
        )

        event_data["event_id"] = occurrence_data["event_id"]
        event = self.store_event(data=event_data, project_id=self.project.id)

        _, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None
        group = group_info.group
        group_event = event.for_group(group)

        mock_trace_data = [
            {
                "id": "aaaaaaaaaaaaaaaa",
                "description": "Test Transaction",
                "is_transaction": True,
                "children": [],
                "errors": [],
                "occurrences": [],
            }
        ]
        mock_query_trace_data.return_value = mock_trace_data

        trace_tree = _get_trace_tree_for_event(group_event, self.project)

        assert trace_tree is not None
        assert trace_tree["trace_id"] == trace_id
        assert trace_tree["trace"] == mock_trace_data
        mock_query_trace_data.assert_called_once()
        call_args = mock_query_trace_data.call_args
        snuba_params = call_args[0][0]
        time_range = snuba_params.end - snuba_params.start
        assert time_range.days == 90


@requires_snuba
@pytest.mark.django_db
class TestGetProfileFromTraceTree(APITestCase, SnubaTestCase):
    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    def test_get_profile_from_trace_tree_basic(self, mock_get_from_profiling_service) -> None:
        """Test finding a profile for a matching transaction in trace tree."""
        # Setup mock event with transaction name
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"
        event.transaction = "/api/users"

        # Create a simple trace tree structure with a span that has a profile
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "trace": [
                {
                    "id": "tx-span-id",
                    "description": "/api/users",  # Matches event transaction
                    "profile_id": profile_id,
                    "start_timestamp": 1672567200.0,
                    "end_timestamp": 1672567210.0,
                    "children": [],
                }
            ],
        }

        # Mock the profile data response
        mock_profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 10000000}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert "execution_tree" in profile_result
        assert len(profile_result["execution_tree"]) == 1
        assert profile_result["execution_tree"][0]["function"] == "main"

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    @patch("sentry.profiles.profile_chunks.get_chunk_ids")
    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    def test_get_profile_from_trace_tree_with_profiler_id(
        self, mock_get_from_profiling_service, mock_get_chunk_ids
    ) -> None:
        """Test finding a continuous profile using profiler_id."""
        event = Mock()
        event.transaction = "/api/test"

        profiler_id = "12345678-1234-1234-1234-123456789abc"
        trace_tree = {
            "trace": [
                {
                    "description": "/api/test",
                    "profiler_id": profiler_id,
                    "start_timestamp": 1672567200.0,
                    "end_timestamp": 1672567210.0,
                    "children": [],
                }
            ],
        }

        # Mock continuous profile response (note the "chunk" wrapper)
        mock_profile_data = {
            "chunk": {
                "profile": {
                    "frames": [
                        {
                            "function": "test",
                            "module": "app",
                            "filename": "test.py",
                            "lineno": 5,
                            "in_app": True,
                        }
                    ],
                    "stacks": [[0]],
                    "samples": [
                        {"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 5000000}
                    ],
                    "thread_metadata": {"1": {"name": "MainThread"}},
                }
            }
        }

        mock_get_chunk_ids.return_value = ["chunk1"]
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert "execution_tree" in profile_result

        # Verify continuous profile endpoint was called
        mock_get_from_profiling_service.assert_called_once()
        args, kwargs = mock_get_from_profiling_service.call_args
        assert kwargs["method"] == "POST"
        assert (
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/chunks"
            in kwargs["path"]
        )
        assert kwargs["json_data"]["profiler_id"] == profiler_id

    def test_get_profile_from_trace_tree_no_matching_transaction(self) -> None:
        """Test that function returns None when no matching transaction is found."""
        event = Mock()
        event.transaction = "/api/different"

        trace_tree = {
            "trace": [
                {
                    "description": "/api/other",  # Doesn't match
                    "profile_id": "profile123",
                    "children": [],
                }
            ],
        }

        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)
        assert profile_result is None

    def test_get_profile_from_trace_tree_no_transaction_name(self) -> None:
        """Test that function returns None when event has no transaction name."""
        event = Mock()
        event.transaction = None

        trace_tree = {
            "trace": [
                {
                    "description": "/api/test",
                    "profile_id": "profile123",
                    "children": [],
                }
            ],
        }

        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)
        assert profile_result is None

    def test_get_profile_from_trace_tree_no_trace_tree(self) -> None:
        """Test that function returns None when trace tree is None."""
        event = Mock()
        event.transaction = "/api/test"

        profile_result = _get_profile_from_trace_tree(None, event, self.project)
        assert profile_result is None

    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    def test_get_profile_from_trace_tree_api_error(self, mock_get_from_profiling_service) -> None:
        """Test that function returns None when profiling API returns an error."""
        event = Mock()
        event.transaction = "/api/test"

        trace_tree = {
            "trace": [
                {
                    "description": "/api/test",
                    "profile_id": "profile123",
                    "start_timestamp": 1672567200.0,
                    "end_timestamp": 1672567210.0,
                    "children": [],
                }
            ],
        }

        mock_response = Mock()
        mock_response.status = 404
        mock_get_from_profiling_service.return_value = mock_response

        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)
        assert profile_result is None


@pytest.mark.django_db
class TestGetAllTagsOverview(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        # Create events with real tag data
        # Event 1: production environment with user_role admin
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"user_role": "admin", "service": "api"},
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 2: production environment with user_role admin (duplicate to test counts)
        event2 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"user_role": "admin", "service": "web"},
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 3: staging environment with user_role user
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "staging",
                "tags": {"user_role": "user", "service": "api"},
                "timestamp": before_now(minutes=3).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 4: development environment with user_role user
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "development",
                "tags": {"user_role": "user", "service": "worker"},
                "timestamp": before_now(minutes=4).isoformat(),
            },
            project_id=self.project.id,
        )

        self.group = event2.group

    def test_get_all_tags_overview_basic(self) -> None:
        """Test basic functionality of getting all tags overview with real data."""
        result = get_all_tags_overview(self.group)

        assert result is not None
        assert "tags_overview" in result

        # Should have environment, user_role, and service tags, but not level since it's excluded
        assert len(result["tags_overview"]) >= 3

        # Find specific tags
        tag_keys = {tag["key"]: tag for tag in result["tags_overview"]}

        # Check environment tag (built-in Sentry tag)
        assert "environment" in tag_keys
        env_tag = tag_keys["environment"]
        assert env_tag["name"] == "Environment"
        assert env_tag["total_values"] == 4  # 4 events

        # Should have production (2), staging (1), development (1)
        env_values = {val["value"]: val for val in env_tag["top_values"]}
        assert "production" in env_values
        assert env_values["production"]["count"] == 2
        assert env_values["production"]["percentage"] == "50%"

        # Check custom tag
        assert "user_role" in tag_keys
        user_tag = tag_keys["user_role"]
        assert user_tag["name"] == "User Role"  # Should get proper label
        assert user_tag["total_values"] == 4

        user_values = {val["value"]: val for val in user_tag["top_values"]}
        assert "admin" in user_values
        assert "user" in user_values
        assert user_values["admin"]["count"] == 2
        assert user_values["user"]["count"] == 2

    def test_get_all_tags_overview_percentage_calculation(self) -> None:
        """Test that percentage calculations work correctly."""
        result = get_all_tags_overview(self.group)

        assert result is not None

        # Find environment tag (we know this exists from setUp)
        env_tag = next(
            (tag for tag in result["tags_overview"] if tag["key"] == "environment"), None
        )
        assert env_tag is not None
        assert env_tag["total_values"] == 4  # 4 events from setUp

        # Check that percentages add up correctly
        env_values = {val["value"]: val for val in env_tag["top_values"]}

        # Verify percentage calculation for known values
        # Production should be 2/4 = 50%
        assert "production" in env_values
        production_val = env_values["production"]
        assert production_val["count"] == 2
        assert production_val["percentage"] == "50%"

        # Development and staging should each be 1/4 = 25%
        assert "development" in env_values
        dev_val = env_values["development"]
        assert dev_val["count"] == 1
        assert dev_val["percentage"] == "25%"

        assert "staging" in env_values
        staging_val = env_values["staging"]
        assert staging_val["count"] == 1
        assert staging_val["percentage"] == "25%"


@requires_snuba
@pytest.mark.django_db
@with_feature("organizations:gen-ai-features")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=True)
class TestTriggerAutofix(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    def setUp(self) -> None:
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.seer.autofix.autofix.get_all_tags_overview")
    @patch("sentry.seer.autofix.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_trigger_autofix_with_event_id(
        self,
        mock_check_autofix_status,
        mock_call,
        mock_get_trace,
        mock_get_profile,
        mock_get_tags,
        mock_record_seer_run,
        mock_get_seer_org_acknowledgement,
    ):
        """Tests triggering autofix with a specified event_id."""
        # Setup test data
        mock_get_profile.return_value = {"profile_data": "test"}
        mock_get_trace.return_value = {"trace_data": "test"}
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Create an event with a stacktrace
        data = load_data("python", timestamp=before_now(minutes=1))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}

        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        # Setup the mock return value for _call_autofix
        mock_call.return_value = 123

        # Set test user
        test_user = self.create_user()

        # Call the function
        response = trigger_autofix(
            group=group,
            event_id=event.event_id,
            user=test_user,
            instruction="Test instruction",
            pr_to_comment_on_url="https://github.com/getsentry/sentry/pull/123",
        )

        # Verify the response
        assert response.status_code == 202
        assert response.data["run_id"] == 123

        # Verify the field is updated in the database
        group.refresh_from_db()
        assert group.seer_autofix_last_triggered is not None
        assert isinstance(group.seer_autofix_last_triggered, datetime)

        # Verify the function calls
        mock_call.assert_called_once()
        mock_record_seer_run.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["user"] == test_user
        assert call_kwargs["group"] == group
        assert call_kwargs["profile"] == {"profile_data": "test"}
        assert call_kwargs["trace_tree"] == {"trace_data": "test"}
        assert call_kwargs["tags_overview"] == {
            "tags_overview": [{"key": "test_tag", "top_values": []}]
        }
        assert call_kwargs["instruction"] == "Test instruction"
        assert call_kwargs["timeout_secs"] == TIMEOUT_SECONDS
        assert call_kwargs["pr_to_comment_on_url"] == "https://github.com/getsentry/sentry/pull/123"

        # Verify check_autofix_status was scheduled
        mock_check_autofix_status.assert_called_once_with(
            args=[123, group.organization.id], countdown=timedelta(minutes=15).seconds
        )

    @patch("sentry.models.Group.get_recommended_event_for_environments")
    @patch("sentry.models.Group.get_latest_event")
    @patch("sentry.seer.autofix.autofix._get_serialized_event")
    def test_trigger_autofix_without_event_id_no_events(
        self,
        mock_get_serialized_event,
        mock_get_latest_event,
        mock_get_recommended_event,
        mock_get_seer_org_acknowledgement,
    ):
        """Tests error handling when no event can be found for the group."""
        mock_get_recommended_event.return_value = None
        mock_get_latest_event.return_value = None
        # We should never reach _get_serialized_event since we have no event
        mock_get_serialized_event.return_value = (None, None)

        group = self.create_group()
        user = Mock(spec=AnonymousUser)

        response = trigger_autofix(group=group, user=user, instruction="Test instruction")

        assert response.status_code == 400
        assert (
            "Could not find an event for the issue, please try providing an event_id"
            in response.data["detail"]
        )
        # Verify _get_serialized_event was not called since we have no event
        mock_get_serialized_event.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.seer.autofix.autofix.get_all_tags_overview")
    @patch("sentry.seer.autofix.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_trigger_autofix_with_web_vitals_issue(
        self,
        mock_check_autofix_status,
        mock_call,
        mock_get_trace,
        mock_get_profile,
        mock_get_tags,
        mock_record_seer_run,
        mock_get_seer_org_acknowledgement,
    ):
        """Tests triggering autofix with a web vitals issue."""
        # Setup test data
        mock_get_profile.return_value = {"profile_data": "test"}
        mock_get_trace.return_value = {"trace_data": "test"}
        mock_get_tags.return_value = {"tags_overview": [{"key": "test_tag", "top_values": []}]}

        # Create an event
        data = load_data("javascript", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        # Create an occurrence to obtain a WebVitalsGroup group
        occurrence_data = self.build_occurrence_data(
            event_id=event.event_id,
            project_id=self.project.id,
            type=WebVitalsGroup.type_id,
            issue_title="LCP score needs improvement",
            subtitle="/test-transaction has an LCP score of 75",
            culprit="/test-transaction",
            evidence_data={
                "transaction": "/test-transaction",
                "vital": "lcp",
                "score": 75,
                "trace_id": "1234567890",
            },
            level="info",
        )

        _, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None
        group = group_info.group

        user = Mock(spec=AnonymousUser)

        response = trigger_autofix(group=group, user=user, instruction="Test instruction")
        assert response.status_code == 202
        mock_record_seer_run.assert_called_once()


@requires_snuba
@pytest.mark.django_db
@with_feature("organizations:gen-ai-features")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=False)
class TestTriggerAutofixWithoutOrgAcknowledgement(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.models.Group.get_recommended_event_for_environments")
    @patch("sentry.models.Group.get_latest_event")
    @patch("sentry.seer.autofix.autofix._get_serialized_event")
    def test_trigger_autofix_without_org_acknowledgement(
        self,
        mock_get_serialized_event,
        mock_get_latest_event,
        mock_get_recommended_event,
        mock_get_seer_org_acknowledgement,
    ):
        """Tests error handling when no event can be found for the group."""
        mock_get_recommended_event.return_value = None
        mock_get_latest_event.return_value = None
        # We should never reach _get_serialized_event since we have no event
        mock_get_serialized_event.return_value = (None, None)

        group = self.create_group()
        user = Mock(spec=AnonymousUser)

        response = trigger_autofix(group=group, user=user, instruction="Test instruction")

        assert response.status_code == 403
        assert (
            "Seer has not been enabled for this organization. Please open an issue at sentry.io/issues and set up Seer."
            in response.data["detail"]
        )
        # Verify _get_serialized_event was not called since we have no event
        mock_get_serialized_event.assert_not_called()


@requires_snuba
@pytest.mark.django_db
@with_feature("organizations:gen-ai-features")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=True)
class TestTriggerAutofixWithHideAiFeatures(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)
        self.organization.update_option("sentry:hide_ai_features", True)

    @patch("sentry.models.Group.get_recommended_event_for_environments")
    @patch("sentry.models.Group.get_latest_event")
    @patch("sentry.seer.autofix.autofix._get_serialized_event")
    def test_trigger_autofix_with_hide_ai_features_enabled(
        self,
        mock_get_serialized_event,
        mock_get_latest_event,
        mock_get_recommended_event,
        mock_get_seer_org_acknowledgement,
    ):
        """Tests that autofix is blocked when organization has hideAiFeatures set to True"""
        mock_get_recommended_event.return_value = None
        mock_get_latest_event.return_value = None
        # We should never reach _get_serialized_event since hideAiFeatures should block the request
        mock_get_serialized_event.return_value = (None, None)

        group = self.create_group()
        user = self.create_user()

        response = trigger_autofix(group=group, user=user, instruction="Test instruction")

        assert response.status_code == 403
        assert "AI features are disabled for this organization" in response.data["detail"]
        # Verify _get_serialized_event was not called since AI features are disabled
        mock_get_serialized_event.assert_not_called()


class TestCallAutofix(TestCase):
    @patch("sentry.seer.autofix.autofix._get_github_username_for_user")
    @patch("sentry.seer.autofix.autofix.requests.post")
    @patch("sentry.seer.autofix.autofix.sign_with_seer_secret")
    def test_call_autofix(self, mock_sign, mock_post, mock_get_username) -> None:
        """Tests the _call_autofix function makes the correct API call."""
        # Setup mocks
        mock_sign.return_value = {"Authorization": "Bearer test"}
        mock_post.return_value.json.return_value = {"run_id": "test-run-id"}
        mock_get_username.return_value = None  # No GitHub username

        # Mock objects
        user = Mock()
        user.id = 123
        user.get_display_name.return_value = "Test User"

        group = Mock()
        group.organization.id = 456
        group.project.id = 789
        group.id = 101112
        group.title = "Test Group"
        group.qualified_short_id = "TEST-123"
        now = datetime.now()
        group.first_seen = now

        # Test data
        repos = [{"name": "test-repo"}]
        serialized_event = {"event_id": "test-event"}
        profile = {"profile_data": "test"}
        trace_tree = {"trace_data": "test"}
        logs = {"logs": [{"message": "test-log"}]}
        tags_overview = {"tags": [{"key": "environment", "top_values": []}]}
        instruction = "Test instruction"

        # Call the function with keyword arguments
        run_id = _call_autofix(
            user=user,
            group=group,
            repos=repos,
            serialized_event=serialized_event,
            profile=profile,
            trace_tree=trace_tree,
            logs=logs,
            tags_overview=tags_overview,
            instruction=instruction,
            timeout_secs=TIMEOUT_SECONDS,
            pr_to_comment_on_url="https://github.com/getsentry/sentry/pull/123",
        )

        # Verify the result
        assert run_id == "test-run-id"

        # Verify the API call
        mock_post.assert_called_once()
        url = mock_post.call_args[0][0]
        assert "/v1/automation/autofix/start" in url

        # Verify the request body
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["organization_id"] == 456
        assert body["project_id"] == 789
        assert body["repos"] == repos
        assert body["issue"]["id"] == 101112
        assert body["issue"]["title"] == "Test Group"
        assert body["issue"]["short_id"] == "TEST-123"
        assert body["issue"]["first_seen"] == now.isoformat()
        assert body["issue"]["events"] == [serialized_event]
        assert body["profile"] == profile
        assert body["trace_tree"] == trace_tree
        assert body["logs"] == logs
        assert body["tags_overview"] == tags_overview
        assert body["instruction"] == "Test instruction"
        assert body["timeout_secs"] == TIMEOUT_SECONDS
        assert body["invoking_user"]["id"] == 123
        assert body["invoking_user"]["display_name"] == "Test User"
        assert body["invoking_user"]["github_username"] is None
        assert (
            body["options"]["comment_on_pr_with_url"]
            == "https://github.com/getsentry/sentry/pull/123"
        )
        assert body["options"]["disable_coding_step"] is False

        # Verify headers
        headers = mock_post.call_args[1]["headers"]
        assert headers["content-type"] == "application/json;charset=utf-8"
        assert headers["Authorization"] == "Bearer test"


class TestGetGithubUsernameForUser(TestCase):
    def test_get_github_username_for_user_with_github(self) -> None:
        """Tests getting GitHub username from ExternalActor with GitHub provider."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with GitHub provider
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@testuser",
            external_id="12345",
            integration_id=1,
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "testuser"

    def test_get_github_username_for_user_with_github_enterprise(self) -> None:
        """Tests getting GitHub username from ExternalActor with GitHub Enterprise provider."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with GitHub Enterprise provider
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB_ENTERPRISE.value,
            external_name="@gheuser",
            external_id="67890",
            integration_id=2,
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "gheuser"

    def test_get_github_username_for_user_without_at_prefix(self) -> None:
        """Tests getting GitHub username when external_name doesn't have @ prefix."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor without @ prefix
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="noprefixuser",
            external_id="11111",
            integration_id=3,
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "noprefixuser"

    def test_get_github_username_for_user_no_mapping(self) -> None:
        """Tests that None is returned when user has no GitHub mapping."""
        user = self.create_user()
        organization = self.create_organization()

        username = _get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_non_github_provider(self) -> None:
        """Tests that None is returned when user only has non-GitHub external actors."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with Slack provider (should be ignored)
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.SLACK.value,
            external_name="@slackuser",
            external_id="slack123",
            integration_id=4,
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_multiple_mappings(self) -> None:
        """Tests that most recent GitHub mapping is used when multiple exist."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create older mapping
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@olduser",
            external_id="old123",
            integration_id=5,
            date_added=before_now(days=10),
        )

        # Create newer mapping
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newuser",
            external_id="new456",
            integration_id=6,
            date_added=before_now(days=1),
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "newuser"

    def test_get_github_username_for_user_from_commit_author(self) -> None:
        """Tests getting GitHub username from CommitAuthor when ExternalActor doesn't exist."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor with GitHub external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Test Committer",
            email="committer@example.com",
            external_id="github:githubuser",
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "githubuser"

    def test_get_github_username_for_user_from_commit_author_github_enterprise(self) -> None:
        """Tests getting GitHub Enterprise username from CommitAuthor."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@company.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor with GitHub Enterprise external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Enterprise User",
            email="committer@company.com",
            external_id="github_enterprise:ghuser",
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username == "ghuser"

    def test_get_github_username_for_user_external_actor_priority(self) -> None:
        """Tests that ExternalActor is checked before CommitAuthor."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create both ExternalActor and CommitAuthor
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@externaluser",
            external_id="ext123",
            integration_id=7,
        )

        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Commit User",
            email="committer@example.com",
            external_id="github:commituser",
        )

        # Should use ExternalActor (higher priority)
        username = _get_github_username_for_user(user, organization.id)
        assert username == "externaluser"

    def test_get_github_username_for_user_commit_author_no_external_id(self) -> None:
        """Tests that None is returned when CommitAuthor exists but has no external_id."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor without external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="No External ID",
            email="committer@example.com",
            external_id=None,
        )

        username = _get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_wrong_organization(self) -> None:
        """Tests that CommitAuthor from different organization is not used."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization1 = self.create_organization()
        organization2 = self.create_organization()
        self.create_member(user=user, organization=organization1)

        # Create CommitAuthor in different organization
        CommitAuthor.objects.create(
            organization_id=organization2.id,
            name="Wrong Org User",
            email="committer@example.com",
            external_id="github:wrongorguser",
        )

        username = _get_github_username_for_user(user, organization1.id)
        assert username is None

    def test_get_github_username_for_user_unverified_email_not_matched(self) -> None:
        """Tests that unverified emails don't match CommitAuthor (security requirement)."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="verified@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Add an unverified email to the user
        self.create_useremail(user=user, email="unverified@example.com", is_verified=False)

        # Create CommitAuthor that matches the UNVERIFIED email
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="unverified",
            email="unverified@example.com",
            external_id="github:unverified",
        )

        # Should NOT match the unverified email (security fix)
        username = _get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_verified_secondary_email_matched(self) -> None:
        """Tests that verified secondary emails DO match CommitAuthor."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="primary@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Add a verified secondary email
        self.create_useremail(user=user, email="secondary@example.com", is_verified=True)

        # Create CommitAuthor that matches the verified secondary email
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Developer",
            email="secondary@example.com",
            external_id="github:developeruser",
        )

        # Should match the verified secondary email
        username = _get_github_username_for_user(user, organization.id)
        assert username == "developeruser"


class TestRespondWithError(TestCase):
    def test_respond_with_error(self) -> None:
        """Tests that the _respond_with_error function returns the expected Response object."""
        response = _respond_with_error("Test error message", 400)

        assert response.status_code == 400
        assert response.data["detail"] == "Test error message"


class TestGetLogsForEvent(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.trace_id = "1234567890abcdef1234567890abcdef"
        self.now = before_now(minutes=0)

    @patch("sentry.snuba.ourlogs.OurLogs.run_table_query")
    def test_merging_consecutive_logs(self, mock_query) -> None:
        # Simulate logs with identical message/severity in sequence
        dt = self.now
        logs = [
            {
                "project.id": self.project.id,
                "timestamp": (dt - timedelta(seconds=3)).isoformat(),
                "message": "foo",
                "severity": "info",
            },
            {
                "project.id": self.project.id,
                "timestamp": (dt - timedelta(seconds=2)).isoformat(),
                "message": "foo",
                "severity": "info",
            },
            {
                "project.id": self.project.id,
                "timestamp": (dt - timedelta(seconds=1)).isoformat(),
                "message": "bar",
                "severity": "error",
            },
            {
                "project.id": self.project.id,
                "timestamp": dt.isoformat(),
                "message": "foo",
                "severity": "info",
            },
        ]
        mock_query.return_value = {"data": logs}
        # Use a mock event with datetime at dt
        event = Mock()
        event.trace_id = self.trace_id
        event.datetime = dt
        project = self.project
        # Patch project.organization to avoid DB hits
        project.organization = self.organization
        result = _get_logs_for_event(event, project)
        assert result is not None
        merged = result["logs"]
        # The first two "foo" logs should be merged (consecutive), the last "foo" is not consecutive
        foo_merged = [
            log for log in merged if log["message"] == "foo" and log.get("consecutive_count") == 2
        ]
        foo_single = [
            log for log in merged if log["message"] == "foo" and "consecutive_count" not in log
        ]
        bar = [log for log in merged if log["message"] == "bar"]
        assert len(foo_merged) == 1
        assert len(foo_single) == 1
        assert len(bar) == 1
        # Order: merged foo, bar, single foo
        assert merged[0]["message"] == "foo" and merged[0]["consecutive_count"] == 2
        assert merged[1]["message"] == "bar"
        assert merged[2]["message"] == "foo" and "consecutive_count" not in merged[2]
