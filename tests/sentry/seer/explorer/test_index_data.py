import uuid
from datetime import timedelta
from unittest import mock

import orjson
import pytest

from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.seer.explorer.index_data import (
    get_issues_for_transaction,
    get_profiles_for_trace,
    get_trace_for_transaction,
    get_transactions_for_project,
)
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.search.test_backend import SharedSnubaMixin


class TestGetTransactionsForProject(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def test_get_transactions_for_project(self) -> None:
        """Test the full end-to-end happy path for get_transactions_for_project."""
        # Create spans for different transactions with varying total time spent
        # Format: (transaction_name, count, avg_duration_ms)
        transactions_data = [
            ("api/users/profile", 5, 100.0),  # 5 * 100 = 500ms total (highest)
            ("api/posts/create", 3, 150.0),  # 3 * 150 = 450ms total (middle)
            ("api/health", 10, 10.0),  # 10 * 10 = 100ms total (lowest, despite high count)
        ]

        # Store transaction spans with different volumes and durations
        spans = []
        for transaction_name, count, duration_ms in transactions_data:
            for i in range(count):
                span = self.create_span(
                    {
                        "description": f"transaction-span-{i}",
                        "sentry_tags": {"transaction": transaction_name},
                        "is_segment": True,  # This marks it as a transaction span
                        "duration_ms": duration_ms,
                    },
                    start_ts=self.ten_mins_ago + timedelta(minutes=i),
                )
                spans.append(span)

                # Also add some non-transaction spans that should be ignored
                if i < 2:  # Add 2 non-transaction spans per transaction
                    non_tx_span = self.create_span(
                        {
                            "description": f"regular-span-{i}",
                            "sentry_tags": {"transaction": transaction_name},
                            "is_segment": False,  # This marks it as a regular span
                            "duration_ms": 50.0,
                        },
                        start_ts=self.ten_mins_ago + timedelta(minutes=i, seconds=30),
                    )
                    spans.append(non_tx_span)

        self.store_spans(spans, is_eap=True)

        # Call our function
        result = get_transactions_for_project(self.project.id)

        # Verify basic structure and data
        assert len(result) == 3

        # Should be sorted by total time spent (sum of duration) descending
        transaction_names = [t.name for t in result]
        assert transaction_names[0] == "api/users/profile"  # 500ms total (highest)
        assert transaction_names[1] == "api/posts/create"  # 450ms total (middle)
        assert transaction_names[2] == "api/health"  # 100ms total (lowest despite high count)

        # Verify all transactions have correct project_id and structure
        for transaction in result:
            assert transaction.project_id == self.project.id
            assert hasattr(transaction, "name")
            assert isinstance(transaction.name, str)
            assert len(transaction.name) > 0

    def test_get_trace_for_transaction(self) -> None:
        transaction_name = "api/users/profile"

        # Create multiple traces with different span counts
        traces_data = [
            (5, "trace-medium", 0),  # 5 spans - starts at offset 0 (earliest)
            (2, "trace-small", 10),  # 2 spans - starts at offset 10 minutes
            (8, "trace-large", 20),  # 8 spans - starts at offset 20 minutes
        ]

        spans = []
        trace_ids = []
        expected_trace_id = None

        for span_count, trace_suffix, start_offset_minutes in traces_data:
            # Generate a unique trace ID
            trace_id = uuid.uuid4().hex
            trace_ids.append(trace_id)
            if trace_suffix == "trace-medium":
                expected_trace_id = trace_id

            for i in range(span_count):
                # Create spans for this trace
                span = self.create_span(
                    {
                        "description": f"span-{i}-{trace_suffix}",
                        "sentry_tags": {"transaction": transaction_name},
                        "trace_id": trace_id,
                        "parent_span_id": None if i == 0 else f"parent-{i-1}",
                        "is_segment": i == 0,  # First span is the transaction span
                    },
                    start_ts=self.ten_mins_ago + timedelta(minutes=start_offset_minutes + i),
                )
                spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Call our function
        result = get_trace_for_transaction(transaction_name, self.project.id)

        # Verify basic structure
        assert result is not None
        assert result.transaction_name == transaction_name
        assert result.project_id == self.project.id
        assert result.trace_id in trace_ids

        # Should choose the first trace by start_ts (trace-medium with 5 spans)
        assert result.trace_id == expected_trace_id
        assert result.total_spans == 5
        assert len(result.spans) == 5

        # Verify all spans have correct structure and belong to the chosen trace
        for result_span in result.spans:
            assert hasattr(result_span, "span_id")
            assert hasattr(result_span, "span_description")
            assert hasattr(result_span, "parent_span_id")
            assert hasattr(result_span, "span_op")
            assert result_span.span_description is not None
            assert result_span.span_description.startswith("span-")
            assert "trace-medium" in result_span.span_description  # Should be from the first trace

        # Verify parent-child relationships are preserved
        root_spans = [s for s in result.spans if s.parent_span_id is None]
        assert len(root_spans) == 1  # Should have exactly one root span


class TestGetProfilesForTrace(APITransactionTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def test_get_profiles_for_trace(self) -> None:
        """Test the full end-to-end happy path for get_profiles_for_trace."""
        trace_id = "a" * 32  # Valid 32-char hex trace ID

        profile1_id = uuid.uuid4().hex  # Transaction profile
        profile2_id = uuid.uuid4().hex  # Transaction profile
        profiler_id = uuid.uuid4().hex  # Continuous profile
        thread_id = "12345"

        # Create span with transaction profile (profile_id)
        span1 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "GET /api/users/profile",
                "sentry_tags": {"transaction": "api/users/profile", "op": "http.server"},
                "is_segment": True,
            },
            start_ts=self.ten_mins_ago,
        )
        span1.update({"profile_id": profile1_id})

        # Create span with transaction profile (profile_id)
        span2 = self.create_span(
            {
                "trace_id": trace_id,
                "parent_span_id": span1["span_id"],
                "description": "SELECT * FROM users",
                "sentry_tags": {"transaction": "api/users/profile", "op": "db.query"},
                "is_segment": False,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=10),
        )
        span2.update({"profile_id": profile2_id})

        # Create span with no profile data (should be ignored by query constraint)
        span3 = self.create_span(
            {
                "trace_id": trace_id,
                "parent_span_id": span1["span_id"],
                "description": "No profile span",
                "sentry_tags": {"transaction": "api/users/profile", "op": "other"},
                "is_segment": False,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=20),
        )
        # Remove any default profile data from span3
        if "profile_id" in span3:
            del span3["profile_id"]
        if "profiler_id" in span3:
            del span3["profiler_id"]
        if "thread_id" in span3:
            del span3["thread_id"]

        # Create span with continuous profile (profiler_id + thread_id)
        span4 = self.create_span(
            {
                "trace_id": trace_id,
                "parent_span_id": span1["span_id"],
                "description": "Continuous profile span",
                "sentry_tags": {
                    "transaction": "api/users/profile",
                    "op": "continuous",
                },
                "is_segment": False,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=30),
        )
        # Remove any default profile_id and set continuous profile fields
        if "profile_id" in span4:
            del span4["profile_id"]
        span4.update(
            {
                "profiler_id": profiler_id,
                "thread_id": thread_id,
                # Set in sentry_tags as well for proper field mapping
                "sentry_tags": {
                    **span4.get("sentry_tags", {}),
                    "profiler_id": profiler_id,
                    "thread.id": thread_id,
                },
            }
        )

        self.store_spans([span1, span2, span3, span4], is_eap=True)

        with mock.patch("sentry.seer.explorer.utils.get_from_profiling_service") as mock_service:
            # Mock profile service responses for both transaction and continuous profiles
            def mock_service_response(method, path, *args, **kwargs):
                if f"profiles/{profile1_id}" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps(
                        {
                            "profile": {
                                "frames": [
                                    {
                                        "function": "main",
                                        "module": "app",
                                        "filename": "main.py",
                                        "lineno": 10,
                                        "in_app": True,
                                    }
                                ],
                                "stacks": [[0]],
                                "samples": [
                                    {
                                        "elapsed_since_start_ns": 1000000,
                                        "thread_id": "1",
                                        "stack_id": 0,
                                    }
                                ],
                                "thread_metadata": {"1": {"name": "MainThread"}},
                            }
                        }
                    )
                    return response
                elif f"profiles/{profile2_id}" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps(
                        {
                            "profile": {
                                "frames": [
                                    {
                                        "function": "query",
                                        "module": "db",
                                        "filename": "db.py",
                                        "lineno": 20,
                                        "in_app": True,
                                    }
                                ],
                                "stacks": [[0]],
                                "samples": [
                                    {
                                        "elapsed_since_start_ns": 2000000,
                                        "thread_id": "1",
                                        "stack_id": 0,
                                    }
                                ],
                                "thread_metadata": {"1": {"name": "MainThread"}},
                            }
                        }
                    )
                    return response
                elif "/chunks" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps(
                        {
                            "chunk": {
                                "profile": {
                                    "frames": [
                                        {
                                            "function": "continuous_func",
                                            "module": "profiler",
                                            "filename": "profiler.py",
                                            "lineno": 30,
                                            "in_app": True,
                                        }
                                    ],
                                    "stacks": [[0]],
                                    "samples": [
                                        {
                                            "elapsed_since_start_ns": 3000000,
                                            "thread_id": "1",
                                            "stack_id": 0,
                                        }
                                    ],
                                    "thread_metadata": {"1": {"name": "MainThread"}},
                                }
                            }
                        }
                    )
                    return response
                else:
                    # Return 404 for unexpected calls
                    response = mock.Mock()
                    response.status = 404
                    return response

            mock_service.side_effect = mock_service_response

            # Call the function
            result = get_profiles_for_trace(trace_id, self.project.id)

            # Verify the result structure
            assert result is not None
            assert result.trace_id == trace_id
            assert result.project_id == self.project.id

            # Should find 3 spans with profile data (span3 filtered out by query constraint)
            assert len(result.profiles) == 3

            # Verify profiles are properly processed
            profile_ids_found = [p.profile_id for p in result.profiles]
            assert profile1_id in profile_ids_found
            assert profile2_id in profile_ids_found
            assert profiler_id in profile_ids_found

            # Verify correct service calls were made
            assert mock_service.call_count == 3

            # Check transaction profile calls use /profiles/ endpoint
            mock_service.assert_any_call(
                "GET",
                f"/organizations/{self.organization.id}/projects/{self.project.id}/profiles/{profile1_id}",
                params={"format": "sample"},
            )
            mock_service.assert_any_call(
                "GET",
                f"/organizations/{self.organization.id}/projects/{self.project.id}/profiles/{profile2_id}",
                params={"format": "sample"},
            )

            # Check continuous profile call uses /chunks/ endpoint
            mock_service.assert_any_call(
                method="POST",
                path=f"/organizations/{self.organization.id}/projects/{self.project.id}/chunks",
                json_data=mock.ANY,
            )

    def test_get_profiles_for_trace_aggregates_duplicate_profiles(self) -> None:
        """Test that aggregation query returns one row per unique profile_id."""
        trace_id = "b" * 32  # Valid 32-char hex trace ID

        profile_id = uuid.uuid4().hex  # Same profile ID for multiple spans
        transaction_name1 = "api/duplicate/test"
        transaction_name2 = "api/different/transaction"

        # Create multiple spans with the same profile_id but different transactions
        # The aggregation query should group these and return just one row
        span1 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "First span with profile",
                "sentry_tags": {"transaction": transaction_name1, "op": "http.server"},
                "is_segment": True,
            },
            start_ts=self.ten_mins_ago,
        )
        span1.update({"profile_id": profile_id})

        span2 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Second span with same profile",
                "sentry_tags": {"transaction": transaction_name1, "op": "db.query"},
                "is_segment": False,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=100),
        )
        span2.update({"profile_id": profile_id})

        span3 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Third span with same profile",
                "sentry_tags": {"transaction": transaction_name2, "op": "cache.get"},
                "is_segment": False,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=200),
        )
        span3.update({"profile_id": profile_id})

        # Create a span with different profile_id (should be separate row in aggregation)
        different_profile_id = uuid.uuid4().hex
        span4 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Different profile span",
                "sentry_tags": {"transaction": transaction_name1, "op": "http.server"},
                "is_segment": True,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=300),
        )
        span4.update({"profile_id": different_profile_id})

        self.store_spans([span1, span2, span3, span4], is_eap=True)

        # Mock the external profiling service calls
        with mock.patch("sentry.seer.explorer.utils.get_from_profiling_service") as mock_service:
            # Mock profile service response
            def mock_service_response(method, path, *args, **kwargs):
                response = mock.Mock()
                response.status = 200
                response.data = orjson.dumps(
                    {
                        "profile": {
                            "frames": [
                                {
                                    "function": "aggregated_function",
                                    "module": "app",
                                    "filename": "aggregated.py",
                                    "lineno": 10,
                                    "in_app": True,
                                }
                            ],
                            "stacks": [[0]],
                            "samples": [
                                {
                                    "elapsed_since_start_ns": 1000000,
                                    "thread_id": "1",
                                    "stack_id": 0,
                                }
                            ],
                            "thread_metadata": {"1": {"name": "MainThread"}},
                        }
                    }
                )
                return response

            mock_service.side_effect = mock_service_response

            # Call the function
            result = get_profiles_for_trace(trace_id, self.project.id)

            # Verify the result structure
            assert result is not None
            assert result.trace_id == trace_id
            assert result.project_id == self.project.id

            # Aggregation query should return 2 rows: one per unique profile_id
            assert len(result.profiles) == 2

            # Verify each unique profile_id appears exactly once
            profile_ids_found = [p.profile_id for p in result.profiles]
            assert profile_id in profile_ids_found
            assert different_profile_id in profile_ids_found
            assert profile_ids_found.count(profile_id) == 1
            assert profile_ids_found.count(different_profile_id) == 1

            # Verify that the profile service was called only twice (once per unique profile_id)
            assert mock_service.call_count == 2

            # Verify all profiles are transaction profiles (not continuous)
            for profile in result.profiles:
                assert profile.is_continuous is False

    def test_get_profiles_for_trace_aggregates_continuous_profiles(self) -> None:
        """Test that aggregation query returns one row per unique profiler_id for continuous profiles."""
        trace_id = "c" * 32  # Valid 32-char hex trace ID

        profiler_id = uuid.uuid4().hex  # Same profiler ID for multiple spans
        thread_id = "67890"
        transaction_name1 = "api/continuous/test"
        transaction_name2 = "api/different/continuous"

        # Create multiple spans with the same profiler_id but different transactions
        # The aggregation query should group these and return just one row
        spans = []
        for i in range(3):
            # Alternate between transaction names to test aggregation across transactions
            transaction_name = transaction_name1 if i % 2 == 0 else transaction_name2
            span = self.create_span(
                {
                    "trace_id": trace_id,
                    "description": f"Continuous span {i + 1}",
                    "sentry_tags": {
                        "transaction": transaction_name,
                        "op": f"continuous.{i + 1}",
                        "profiler_id": profiler_id,
                        "thread.id": thread_id,
                    },
                    "is_segment": i == 0,  # First span is transaction
                },
                start_ts=self.ten_mins_ago + timedelta(milliseconds=i * 100),
            )
            # Remove any default profile_id and set continuous profile fields
            if "profile_id" in span:
                del span["profile_id"]
            span.update(
                {
                    "profiler_id": profiler_id,
                    "thread_id": thread_id,
                }
            )
            spans.append(span)

        # Create a continuous profile span with different profiler_id (should be separate row)
        different_profiler_id = uuid.uuid4().hex
        span_different = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Different profiler continuous span",
                "sentry_tags": {
                    "transaction": transaction_name1,
                    "op": "continuous.different",
                    "profiler_id": different_profiler_id,
                    "thread.id": thread_id,
                },
                "is_segment": True,
            },
            start_ts=self.ten_mins_ago + timedelta(milliseconds=400),
        )
        if "profile_id" in span_different:
            del span_different["profile_id"]
        span_different.update(
            {
                "profiler_id": different_profiler_id,
                "thread_id": thread_id,
            }
        )
        spans.append(span_different)

        self.store_spans(spans, is_eap=True)

        # Mock the external profiling service calls
        with mock.patch("sentry.seer.explorer.utils.get_from_profiling_service") as mock_service:
            # Mock profile service response for continuous profiles (/chunks endpoint)
            def mock_service_response(method, path, *args, **kwargs):
                response = mock.Mock()
                response.status = 200
                response.data = orjson.dumps(
                    {
                        "chunk": {
                            "profile": {
                                "frames": [
                                    {
                                        "function": "continuous_aggregated_function",
                                        "module": "profiler",
                                        "filename": "continuous.py",
                                        "lineno": 15,
                                        "in_app": True,
                                    }
                                ],
                                "stacks": [[0]],
                                "samples": [
                                    {
                                        "elapsed_since_start_ns": 1000000,
                                        "thread_id": "1",
                                        "stack_id": 0,
                                    }
                                ],
                                "thread_metadata": {"1": {"name": "MainThread"}},
                            }
                        }
                    }
                )
                return response

            mock_service.side_effect = mock_service_response

            # Call the function
            result = get_profiles_for_trace(trace_id, self.project.id)

            # Verify the result structure
            assert result is not None
            assert result.trace_id == trace_id
            assert result.project_id == self.project.id

            # Aggregation query should return 2 rows: one per unique profiler_id
            assert len(result.profiles) == 2

            # Verify each unique profiler_id appears exactly once
            profile_ids_found = [p.profile_id for p in result.profiles]
            assert profiler_id in profile_ids_found
            assert different_profiler_id in profile_ids_found
            assert profile_ids_found.count(profiler_id) == 1
            assert profile_ids_found.count(different_profiler_id) == 1

            # Verify that the profile service was called only twice (once per unique profiler_id)
            # Both should use the /chunks endpoint for continuous profiles
            assert mock_service.call_count == 2

            # Check that all calls used the /chunks endpoint (continuous profiles)
            for call in mock_service.call_args_list:
                assert call[1]["method"] == "POST"
                assert "/chunks" in call[1]["path"]

            # Verify all profiles are continuous profiles
            for profile in result.profiles:
                assert profile.is_continuous is True

    def test_get_profiles_for_trace_uses_aggregated_timestamps(self) -> None:
        """Test that aggregation query correctly computes min/max timestamps for each profile."""
        trace_id = "d" * 32  # Valid 32-char hex trace ID

        profile_id = uuid.uuid4().hex

        # Create spans with the same profile_id at different times
        # The aggregation should use min(start) and max(end) timestamps
        span1_start = self.ten_mins_ago
        span1_duration_ms = 50.0  # span1 ends at ten_mins_ago + 50ms

        span2_start = self.ten_mins_ago + timedelta(milliseconds=100)
        span2_duration_ms = 100.0  # span2 ends at ten_mins_ago + 200ms (latest end)

        span3_start = self.ten_mins_ago + timedelta(milliseconds=25)
        span3_duration_ms = 50.0  # span3 ends at ten_mins_ago + 75ms (middle)

        span1 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "First span (earliest start)",
                "sentry_tags": {"transaction": "api/test", "op": "http.server"},
                "is_segment": True,
            },
            start_ts=span1_start,
            duration=int(span1_duration_ms),
        )
        span1.update({"profile_id": profile_id})

        span2 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Second span (latest end)",
                "sentry_tags": {"transaction": "api/test", "op": "db.query"},
                "is_segment": False,
            },
            start_ts=span2_start,
            duration=int(span2_duration_ms),
        )
        span2.update({"profile_id": profile_id})

        span3 = self.create_span(
            {
                "trace_id": trace_id,
                "description": "Third span (middle)",
                "sentry_tags": {"transaction": "api/test", "op": "cache.get"},
                "is_segment": False,
            },
            start_ts=span3_start,
            duration=int(span3_duration_ms),
        )
        span3.update({"profile_id": profile_id})

        self.store_spans([span1, span2, span3], is_eap=True)

        captured_timestamps = {}

        with mock.patch("sentry.seer.explorer.index_data.fetch_profile_data") as mock_fetch:
            # Mock to capture the timestamps passed to fetch_profile_data
            def capture_and_return(
                profile_id, organization_id, project_id, start_ts, end_ts, is_continuous
            ):
                captured_timestamps["start_ts"] = start_ts
                captured_timestamps["end_ts"] = end_ts
                captured_timestamps["profile_id"] = profile_id
                captured_timestamps["is_continuous"] = is_continuous

                return {
                    "profile": {
                        "frames": [
                            {
                                "function": "test_function",
                                "module": "app",
                                "filename": "test.py",
                                "lineno": 10,
                                "in_app": True,
                            }
                        ],
                        "stacks": [[0]],
                        "samples": [
                            {
                                "elapsed_since_start_ns": 1000000,
                                "thread_id": "1",
                                "stack_id": 0,
                            }
                        ],
                        "thread_metadata": {"1": {"name": "MainThread"}},
                    }
                }

            mock_fetch.side_effect = capture_and_return

            # Call the function
            result = get_profiles_for_trace(trace_id, self.project.id)

            # Verify result
            assert result is not None
            assert len(result.profiles) == 1

            # Verify fetch_profile_data was called with aggregated timestamps
            assert mock_fetch.call_count == 1

            # Calculate expected end times based on start + duration
            _ = span1_start + timedelta(milliseconds=span1_duration_ms)
            span2_end = span2_start + timedelta(milliseconds=span2_duration_ms)
            _ = span3_start + timedelta(milliseconds=span3_duration_ms)

            # The aggregation should use:
            # - min(start_ts) = span1_start (earliest start)
            # - max(finish_ts) = span2_end (latest end: ten_mins_ago + 200ms)
            assert captured_timestamps["start_ts"] == pytest.approx(span1_start.timestamp())
            assert captured_timestamps["end_ts"] == pytest.approx(span2_end.timestamp())
            assert captured_timestamps["profile_id"] == profile_id
            assert captured_timestamps["is_continuous"] is False


class TestGetIssuesForTransaction(APITransactionTestCase, SpanTestCase, SharedSnubaMixin):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    def test_get_issues_for_transaction(self) -> None:
        """Test the full end-to-end happy path for get_issues_for_transaction."""
        transaction_name = "api/users/profile"

        # Create some real events/issues for the transaction
        # For error events, transaction should be stored as a tag
        event1 = self.store_event(
            data={
                "message": "Database connection failed",
                "tags": [["transaction", transaction_name]],
                "fingerprint": ["database-error"],
                "platform": "python",
                "timestamp": self.ten_mins_ago.isoformat(),
                "level": "error",
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "message": "Timeout error",
                "tags": [["transaction", transaction_name]],
                "fingerprint": ["timeout-error"],
                "platform": "python",
                "timestamp": self.ten_mins_ago.isoformat(),
                "level": "error",
            },
            project_id=self.project.id,
        )

        event3 = self.store_event(
            data={
                "message": "Permission denied",
                "tags": [["transaction", transaction_name]],
                "fingerprint": ["permission-error"],
                "platform": "python",
                "timestamp": self.ten_mins_ago.isoformat(),
                "level": "error",
            },
            project_id=self.project.id,
        )

        groups = [event1.group, event2.group, event3.group]

        for group in groups:
            latest_event = group.get_latest_event()
            transaction_tag = latest_event.get_tag("transaction")
            assert (
                transaction_tag == transaction_name
            ), f"Expected transaction tag '{transaction_name}', got '{transaction_tag}'"

        result = get_issues_for_transaction(transaction_name, self.project.id)

        assert result is not None
        assert result.transaction_name == transaction_name
        assert result.project_id == self.project.id
        assert len(result.issues) == 3

        issues = sorted(result.issues, key=lambda x: x.id)
        sorted_groups = sorted(groups, key=lambda x: x.id)

        for i, (issue, group) in enumerate(zip(issues, sorted_groups)):
            assert issue.id == group.id
            assert issue.title == group.title
            assert issue.culprit == group.culprit
            assert issue.transaction == transaction_name
            assert "id" in issue.events[0]
            assert "message" in issue.events[0]
            assert (
                "tags" in issue.events[0] or issue.events[0].get("transaction") == transaction_name
            )

    def test_get_issues_for_transaction_with_quotes(self) -> None:
        """Test that transaction names with quotes and search operators are properly escaped in search queries."""
        # Test case 1: Transaction name with quotes that would break search syntax if not escaped
        transaction_name_quotes = 'GET /api/users/"john"/profile'

        # Create an event/issue for the transaction with quotes
        event1 = self.store_event(
            data={
                "message": "Authentication failed for quoted user",
                "tags": [["transaction", transaction_name_quotes]],
                "fingerprint": ["auth-error-quotes"],
                "platform": "python",
                "timestamp": self.ten_mins_ago.isoformat(),
                "level": "error",
            },
            project_id=self.project.id,
        )

        # Test case 2: Transaction name with " IN " operator that could break search syntax
        transaction_name_in = "POST /api/check IN database/users"

        # Create an event/issue for the transaction with IN operator
        event2 = self.store_event(
            data={
                "message": "Database operation failed",
                "tags": [["transaction", transaction_name_in]],
                "fingerprint": ["database-in-error"],
                "platform": "python",
                "timestamp": self.ten_mins_ago.isoformat(),
                "level": "error",
            },
            project_id=self.project.id,
        )

        # Verify both events were stored with correct transaction names
        latest_event1 = event1.group.get_latest_event()
        transaction_tag1 = latest_event1.get_tag("transaction")
        assert transaction_tag1 == transaction_name_quotes

        latest_event2 = event2.group.get_latest_event()
        transaction_tag2 = latest_event2.get_tag("transaction")
        assert transaction_tag2 == transaction_name_in

        # Test quotes case - this should not crash despite quotes in transaction name
        result1 = get_issues_for_transaction(transaction_name_quotes, self.project.id)

        # Verify the quotes result
        assert result1 is not None
        assert result1.transaction_name == transaction_name_quotes
        assert result1.project_id == self.project.id
        assert len(result1.issues) == 1

        issue1 = result1.issues[0]
        assert issue1.id == event1.group.id
        assert issue1.transaction == transaction_name_quotes

        # Test IN operator case - this should not crash despite IN operator in transaction name
        result2 = get_issues_for_transaction(transaction_name_in, self.project.id)

        # Verify the IN operator result
        assert result2 is not None
        assert result2.transaction_name == transaction_name_in
        assert result2.project_id == self.project.id
        assert len(result2.issues) == 1

        issue2 = result2.issues[0]
        assert issue2.id == event2.group.id
        assert issue2.transaction == transaction_name_in
