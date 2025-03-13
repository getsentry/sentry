from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import orjson
import pytest
from django.contrib.auth.models import AnonymousUser

from sentry.seer.autofix import (
    TIMEOUT_SECONDS,
    _call_autofix,
    _convert_profile_to_execution_tree,
    _get_profile_from_trace_tree,
    _get_trace_tree_for_event,
    _respond_with_error,
    trigger_autofix,
)
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data


class TestConvertProfileToExecutionTree(TestCase):
    def test_convert_profile_to_execution_tree(self):
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
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree = _convert_profile_to_execution_tree(profile_data)

        # Should only include in_app frames from MainThread
        assert len(execution_tree) == 1  # One root node
        root = execution_tree[0]
        assert root["function"] == "helper"
        assert root["module"] == "app.utils"
        assert root["filename"] == "utils.py"
        assert root["lineno"] == 20
        assert len(root["children"]) == 1

        child = root["children"][0]
        assert child["function"] == "main"
        assert child["module"] == "app.main"
        assert child["filename"] == "main.py"
        assert child["lineno"] == 10
        assert len(child["children"]) == 0  # No children for the last in_app frame

    def test_convert_profile_to_execution_tree_non_main_thread(self):
        """Test that non-MainThread samples are excluded from execution tree"""
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
                "samples": [{"stack_id": 0, "thread_id": "2"}],
                "thread_metadata": {"2": {"name": "WorkerThread"}},
            }
        }

        execution_tree = _convert_profile_to_execution_tree(profile_data)

        # Should be empty since no MainThread samples
        assert len(execution_tree) == 0

    def test_convert_profile_to_execution_tree_merges_duplicate_frames(self):
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
                    {"stack_id": 0, "thread_id": "1"},
                    {"stack_id": 1, "thread_id": "1"},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree = _convert_profile_to_execution_tree(profile_data)

        # Should only have one node even though frame appears in multiple samples
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "main"


@requires_snuba
@pytest.mark.django_db
class TestGetTraceTreeForEvent(APITestCase, SnubaTestCase):
    def test_get_trace_tree_for_event(self):
        """
        Tests that a trace tree is correctly created with the expected structure:

        trace (1234567890abcdef1234567890abcdef)
        ├── another-root-id (09:59:00Z) "browser - Earlier Transaction"
        └── root-tx-id (10:00:00Z) "http.server - Root Transaction"
            ├── child1-tx-id (10:00:10Z) "db - Database Query"
            │   └── grandchild1-error-id (10:00:15Z) "Database Error"
            └── child2-error-id (10:00:20Z) "Division by zero"

        Note: Events are ordered chronologically at each level.
        """
        event_data = load_data("python")
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Root event (a transaction)
        root_tx_span_id = "aaaaaaaaaaaaaaaa"
        root_tx_event_data = {
            "event_id": "root-tx-id",
            "datetime": "2023-01-01T10:00:00Z",
            "spans": [{"span_id": "child1-span-id"}, {"span_id": "child2-span-id"}],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": root_tx_span_id, "op": "http.server"}
            },
            "title": "Root Transaction",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Child 1 - transaction that happens before child 2
        child1_span_id = "child1-span-id"
        child1_tx_event_data = {
            "event_id": "child1-tx-id",
            "datetime": "2023-01-01T10:00:10Z",
            "spans": [{"span_id": "grandchild1-span-id"}],
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child1_span_id,
                    "parent_span_id": root_tx_span_id,
                    "op": "db",
                }
            },
            "title": "Database Query",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Child 2 - error that happens after child 1
        child2_span_id = "child2-span-id"
        child2_error_event_data = {
            "event_id": "child2-error-id",
            "datetime": "2023-01-01T10:00:20Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child2_span_id,
                    "parent_span_id": root_tx_span_id,
                }
            },
            "title": "Division by zero",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Grandchild 1 - error event (child of child1)
        grandchild1_span_id = "grandchild1-span-id"
        grandchild1_error_event_data = {
            "event_id": "grandchild1-error-id",
            "datetime": "2023-01-01T10:00:15Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": grandchild1_span_id,
                    "parent_span_id": child1_span_id,
                }
            },
            "title": "Database Error",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Add another root event that happens earlier
        another_root_span_id = "bbbbbbbbbbbbbbbb"
        another_root_tx_event_data = {
            "event_id": "another-root-id",
            "datetime": "2023-01-01T09:59:00Z",
            "spans": [],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": another_root_span_id, "op": "browser"}
            },
            "title": "Earlier Transaction",
            "platform": "javascript",
            "project_id": self.project.id,
        }

        # Create proper event objects instead of just mocks
        tx_events = []
        error_events = []

        # Create transaction events
        for event_data in [root_tx_event_data, child1_tx_event_data, another_root_tx_event_data]:
            mock_event = Mock()
            # Set attributes directly instead of using data property
            mock_event.event_id = event_data["event_id"]
            mock_event.datetime = datetime.fromisoformat(
                event_data["datetime"].replace("Z", "+00:00")
            )
            mock_event.data = event_data
            mock_event.title = event_data["title"]
            mock_event.platform = event_data["platform"]
            mock_event.project_id = event_data["project_id"]
            mock_event.trace_id = trace_id
            tx_events.append(mock_event)

        # Create error events
        for event_data in [child2_error_event_data, grandchild1_error_event_data]:
            mock_event = Mock()
            # Set attributes directly instead of using data property
            mock_event.event_id = event_data["event_id"]
            mock_event.datetime = datetime.fromisoformat(
                event_data["datetime"].replace("Z", "+00:00")
            )
            mock_event.data = event_data
            mock_event.title = event_data["title"]
            mock_event.platform = event_data["platform"]
            mock_event.project_id = event_data["project_id"]
            mock_event.trace_id = trace_id
            error_events.append(mock_event)

        # Update to patch both Transactions and Events dataset calls
        with patch("sentry.eventstore.backend.get_events") as mock_get_events:

            def side_effect(filter, dataset, **kwargs):
                if dataset == Dataset.Transactions:
                    return tx_events
                elif dataset == Dataset.Events:
                    return error_events
                return []

            mock_get_events.side_effect = side_effect

            # Call the function directly instead of through an endpoint
            trace_tree = _get_trace_tree_for_event(event, self.project)

        # Validate the trace tree structure
        assert trace_tree is not None
        assert trace_tree["trace_id"] == trace_id

        # We should have two root events in chronological order
        assert len(trace_tree["events"]) == 2

        # First root should be the earlier transaction
        first_root = trace_tree["events"][0]
        assert first_root["event_id"] == "another-root-id"
        assert first_root["title"] == "browser - Earlier Transaction"
        assert first_root["datetime"].isoformat() == "2023-01-01T09:59:00+00:00"
        assert first_root["is_transaction"] is True
        assert first_root["is_error"] is False
        assert len(first_root["children"]) == 0

        # Second root should be the main root transaction
        second_root = trace_tree["events"][1]
        assert second_root["event_id"] == "root-tx-id"
        assert second_root["title"] == "http.server - Root Transaction"
        assert second_root["datetime"].isoformat() == "2023-01-01T10:00:00+00:00"
        assert second_root["is_transaction"] is True
        assert second_root["is_error"] is False

        # Second root should have two children in chronological order
        assert len(second_root["children"]) == 2

        # First child of main root is child1
        child1 = second_root["children"][0]
        assert child1["event_id"] == "child1-tx-id"
        assert child1["title"] == "db - Database Query"
        assert child1["datetime"].isoformat() == "2023-01-01T10:00:10+00:00"
        assert child1["is_transaction"] is True
        assert child1["is_error"] is False

        # Child1 should have grandchild1
        assert len(child1["children"]) == 1
        grandchild1 = child1["children"][0]
        assert grandchild1["event_id"] == "grandchild1-error-id"
        assert grandchild1["title"] == "Database Error"
        assert grandchild1["datetime"].isoformat() == "2023-01-01T10:00:15+00:00"
        assert grandchild1["is_transaction"] is False
        assert grandchild1["is_error"] is True
        assert len(grandchild1["children"]) == 0

        # Second child of main root is child2
        child2 = second_root["children"][1]
        assert child2["event_id"] == "child2-error-id"
        assert child2["title"] == "Division by zero"
        assert child2["datetime"].isoformat() == "2023-01-01T10:00:20+00:00"
        assert child2["is_transaction"] is False
        assert child2["is_error"] is True
        assert len(child2["children"]) == 0

        # Verify that get_events was called twice - once for transactions and once for errors
        assert mock_get_events.call_count == 2
        # Check that the first call used the Transactions dataset
        assert mock_get_events.call_args_list[0][1]["dataset"] == Dataset.Transactions
        # Check that the second call used the Events dataset
        assert mock_get_events.call_args_list[1][1]["dataset"] == Dataset.Events

    @patch("sentry.eventstore.backend.get_events")
    def test_get_trace_tree_empty_results(self, mock_get_events):
        """
        Expected trace structure:

        None (empty trace tree)

        This test checks the behavior when no events are found for a trace.
        """
        mock_get_events.return_value = []

        event_data = load_data("python")
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Call the function directly instead of through an endpoint
        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is None
        # Should be called twice - once for transactions and once for errors
        assert mock_get_events.call_count == 2

    @patch("sentry.eventstore.backend.get_events")
    def test_get_trace_tree_out_of_order_processing(self, mock_get_events):
        """
        Expected trace structure:

        trace (1234567890abcdef1234567890abcdef)
        └── parent-id (10:00:00Z) "Parent Last"
            └── child-id (10:00:10Z) "Child First"

        This test verifies that the correct tree structure is built even when
        events are processed out of order (child before parent).
        """
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data = load_data("python")
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Child event that references a parent we haven't seen yet
        child_span_id = "cccccccccccccccc"
        parent_span_id = "pppppppppppppppp"

        # Create proper child event object
        child_event = Mock()
        child_event.event_id = "child-id"
        child_event.datetime = datetime.fromisoformat("2023-01-01T10:00:10+00:00")
        child_event.data = {
            "event_id": "child-id",
            "datetime": "2023-01-01T10:00:10Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child_span_id,
                    "parent_span_id": parent_span_id,
                }
            },
            "title": "Child First",
            "platform": "python",
            "project_id": self.project.id,
        }
        child_event.title = "Child First"
        child_event.platform = "python"
        child_event.project_id = self.project.id
        child_event.trace_id = trace_id

        # Create proper parent event object
        parent_event = Mock()
        parent_event.event_id = "parent-id"
        parent_event.datetime = datetime.fromisoformat("2023-01-01T10:00:00+00:00")
        parent_event.data = {
            "event_id": "parent-id",
            "datetime": "2023-01-01T10:00:00Z",
            "spans": [],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": parent_span_id, "op": "http.server"}
            },
            "title": "Parent Last",
            "platform": "python",
            "project_id": self.project.id,
        }
        parent_event.title = "Parent Last"
        parent_event.platform = "python"
        parent_event.project_id = self.project.id
        parent_event.trace_id = trace_id

        # Set up the mock to return different results for different dataset calls
        def side_effect(filter, dataset, **kwargs):
            if dataset == Dataset.Transactions:
                return [parent_event]  # Parent is a transaction
            elif dataset == Dataset.Events:
                return [child_event]  # Child is an error
            return []

        mock_get_events.side_effect = side_effect

        # Call the function directly instead of through an endpoint
        trace_tree = _get_trace_tree_for_event(event, self.project)

        assert trace_tree is not None
        assert len(trace_tree["events"]) == 1

        # Parent should be the root
        root = trace_tree["events"][0]
        assert root["event_id"] == "parent-id"
        assert root["span_id"] == parent_span_id

        # Child should be under parent
        assert len(root["children"]) == 1
        child = root["children"][0]
        assert child["event_id"] == "child-id"
        assert child["span_id"] == child_span_id

        # Verify that get_events was called twice
        assert mock_get_events.call_count == 2


@requires_snuba
@pytest.mark.django_db
class TestGetProfileFromTraceTree(APITestCase, SnubaTestCase):
    @patch("sentry.seer.autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method which finds a profile for a transaction
        that is a parent of an error event in a trace tree.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with a transaction that has a profile_id
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "tx-root-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,
                    "children": [
                        {
                            "event_id": "error-event-id",
                            "span_id": "event-span-id",
                            "is_transaction": False,
                            "is_error": True,
                            "children": [],
                        }
                    ],
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
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        # Configure the mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        # Call the function directly instead of through an endpoint
        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert profile_result["profile_matches_issue"] is True
        assert "execution_tree" in profile_result
        assert len(profile_result["execution_tree"]) == 1
        assert profile_result["execution_tree"][0]["function"] == "main"

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    @patch("sentry.seer.autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree_api_error(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method when the profiling service API returns an error.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with a transaction that has a profile_id
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "tx-root-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,
                    "children": [
                        {
                            "event_id": "error-event-id",
                            "span_id": "event-span-id",
                            "is_transaction": False,
                            "is_error": True,
                            "children": [],
                        }
                    ],
                }
            ],
        }

        # Configure the mock response to simulate an API error
        mock_response = Mock()
        mock_response.status = 404
        mock_get_from_profiling_service.return_value = mock_response

        # Call the function directly instead of through an endpoint
        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is None

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    @patch("sentry.seer.autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree_multi_level(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method with a multi-level trace tree
        where the profile is found in a grandparent transaction.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with multiple levels
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "root-tx-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,  # Profile is at the root level
                    "children": [
                        {
                            "event_id": "mid-tx-id",
                            "span_id": "mid-span-id",
                            "is_transaction": True,
                            "is_error": False,
                            # No profile_id at this level
                            "children": [
                                {
                                    "event_id": "error-event-id",
                                    "span_id": "event-span-id",
                                    "is_transaction": False,
                                    "is_error": True,
                                    "children": [],
                                }
                            ],
                        }
                    ],
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
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        # Configure the mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        # Call the function directly instead of through an endpoint
        profile_result = _get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert profile_result["profile_matches_issue"] is True
        assert "execution_tree" in profile_result

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )


@requires_snuba
@pytest.mark.django_db
@apply_feature_flag_on_cls("organizations:gen-ai-features")
class TestTriggerAutofix(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.seer.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix._get_trace_tree_for_event")
    @patch("sentry.seer.autofix._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_trigger_autofix_with_event_id(
        self, mock_check_autofix_status, mock_call, mock_get_trace, mock_get_profile
    ):
        """Tests triggering autofix with a specified event_id."""
        # Setup test data
        mock_get_profile.return_value = {"profile_data": "test"}
        mock_get_trace.return_value = {"trace_data": "test"}

        # Create an event with a stacktrace
        data = load_data("python", timestamp=before_now(minutes=1))
        data["exception"] = {"values": [{"type": "Exception", "value": "Test exception"}]}

        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        # Setup the mock return value for _call_autofix
        mock_call.return_value = "test-run-id"

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
        assert response.data["run_id"] == "test-run-id"

        # Verify the function calls
        mock_call.assert_called_once()
        call_args = mock_call.call_args[0]
        assert call_args[0] == test_user  # user
        assert call_args[1] == group  # group
        assert call_args[4] == {"profile_data": "test"}  # profile
        assert call_args[5] == {"trace_data": "test"}  # trace tree
        assert call_args[6] == "Test instruction"  # instruction
        assert call_args[7] == TIMEOUT_SECONDS  # timeout
        assert call_args[8] == "https://github.com/getsentry/sentry/pull/123"  # PR URL

        # Verify check_autofix_status was scheduled
        mock_check_autofix_status.assert_called_once_with(
            args=["test-run-id"], countdown=timedelta(minutes=15).seconds
        )

    @patch("sentry.models.Group.get_recommended_event_for_environments")
    @patch("sentry.models.Group.get_latest_event")
    @patch("sentry.seer.autofix._get_serialized_event")
    def test_trigger_autofix_without_event_id_no_events(
        self, mock_get_serialized_event, mock_get_latest_event, mock_get_recommended_event
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

    @patch("sentry.seer.autofix._get_serialized_event")
    def test_trigger_autofix_without_stacktrace(self, mock_get_serialized_event):
        """Tests error handling when the event doesn't have a stacktrace."""
        # Mock an event without stacktrace entries
        serialized_event = {"entries": [{"type": "request"}]}
        mock_get_serialized_event.return_value = (serialized_event, Mock())

        group = self.create_group()
        user = Mock(spec=AnonymousUser)

        response = trigger_autofix(
            group=group, event_id="test-event-id", user=user, instruction="Test instruction"
        )

        assert response.status_code == 400
        assert "Cannot fix issues without a stacktrace" in response.data["detail"]


class TestCallAutofix(TestCase):
    @patch("sentry.seer.autofix.requests.post")
    @patch("sentry.seer.autofix.sign_with_seer_secret")
    def test_call_autofix(self, mock_sign, mock_post):
        """Tests the _call_autofix function makes the correct API call."""
        # Setup mocks
        mock_sign.return_value = {"Authorization": "Bearer test"}
        mock_post.return_value.json.return_value = {"run_id": "test-run-id"}

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

        # Test data
        repos = [{"name": "test-repo"}]
        serialized_event = {"event_id": "test-event"}
        profile = {"profile_data": "test"}
        trace_tree = {"trace_data": "test"}
        instruction = "Test instruction"

        # Call the function
        run_id = _call_autofix(
            user,
            group,
            repos,
            serialized_event,
            profile,
            trace_tree,
            instruction,
            TIMEOUT_SECONDS,
            "https://github.com/getsentry/sentry/pull/123",
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
        assert body["issue"]["events"] == [serialized_event]
        assert body["profile"] == profile
        assert body["trace_tree"] == trace_tree
        assert body["instruction"] == "Test instruction"
        assert body["timeout_secs"] == TIMEOUT_SECONDS
        assert body["invoking_user"]["id"] == 123
        assert body["invoking_user"]["display_name"] == "Test User"
        assert (
            body["options"]["comment_on_pr_with_url"]
            == "https://github.com/getsentry/sentry/pull/123"
        )

        # Verify headers
        headers = mock_post.call_args[1]["headers"]
        assert headers["content-type"] == "application/json;charset=utf-8"
        assert headers["Authorization"] == "Bearer test"


class TestRespondWithError(TestCase):
    def test_respond_with_error(self):
        """Tests that the _respond_with_error function returns the expected Response object."""
        response = _respond_with_error("Test error message", 400)

        assert response.status_code == 400
        assert response.data["detail"] == "Test error message"
