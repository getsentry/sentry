import uuid
from datetime import timedelta
from unittest import mock

import orjson

from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.seer.explorer.index_data import (
    get_issues_for_transaction,
    get_profiles_for_trace,
    get_trace_for_transaction,
    get_trace_from_id,
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
        # Create spans for different transactions with varying volumes
        transactions_data = [
            ("api/users/profile", 5),  # High volume
            ("api/posts/create", 3),  # Medium volume
            ("api/health", 1),  # Low volume
        ]

        # Store transaction spans with different volumes
        spans = []
        for transaction_name, count in transactions_data:
            for i in range(count):
                span = self.create_span(
                    {
                        "description": f"transaction-span-{i}",
                        "sentry_tags": {"transaction": transaction_name},
                        "is_segment": True,  # This marks it as a transaction span
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
                        },
                        start_ts=self.ten_mins_ago + timedelta(minutes=i, seconds=30),
                    )
                    spans.append(non_tx_span)

        self.store_spans(spans, is_eap=True)

        # Call our function
        result = get_transactions_for_project(self.project.id)

        # Verify basic structure and data
        assert len(result) == 3

        # Should be sorted by volume (count) descending - only transaction spans count
        transaction_names = [t.name for t in result]
        assert transaction_names[0] == "api/users/profile"  # Highest count (5 transaction spans)
        assert transaction_names[1] == "api/posts/create"  # Medium count (3 transaction spans)
        assert transaction_names[2] == "api/health"  # Lowest count (1 transaction span)

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
            (2, "trace-small"),  # 2 spans - smallest
            (5, "trace-medium"),  # 5 spans - median
            (8, "trace-large"),  # 8 spans - largest
        ]

        spans = []
        trace_ids = []

        for span_count, trace_suffix in traces_data:
            # Generate a unique trace ID
            trace_id = uuid.uuid4().hex
            trace_ids.append(trace_id)

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
                    start_ts=self.ten_mins_ago + timedelta(minutes=i),
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

        # Should choose the median trace (5 spans) - middle of [2, 5, 8]
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
            assert "trace-medium" in result_span.span_description  # Should be from the median trace

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

    def test_get_profiles_for_trace_merges_duplicate_profiles(self) -> None:
        """Test that profiles with same profile_id and is_continuous are merged, regardless of transaction name."""
        trace_id = "b" * 32  # Valid 32-char hex trace ID

        profile_id = uuid.uuid4().hex  # Same profile ID for multiple spans
        transaction_name1 = "api/duplicate/test"
        transaction_name2 = "api/different/transaction"

        # Create multiple spans with the same profile_id but different transactions
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

        # Create a span with different profile_id (should not be merged)
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
                                    "function": "merged_function",
                                    "module": "app",
                                    "filename": "merged.py",
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

            # Should have 2 profiles: 1 merged for the shared profile_id and 1 for the different profile_id
            assert len(result.profiles) == 2

            # Find the profiles by profile_id
            merged_profiles = [p for p in result.profiles if p.profile_id == profile_id]
            different_profiles = [
                p for p in result.profiles if p.profile_id == different_profile_id
            ]

            assert (
                len(merged_profiles) == 1
            ), "Should merge 3 spans with same profile_id into 1, regardless of transaction name"
            assert len(different_profiles) == 1, "Should keep different profile_id separate"

            # Verify that the profile service was called only twice (once per unique profile_id)
            assert mock_service.call_count == 2

            # Check that both unique profile_ids were processed
            profile_ids_found = [p.profile_id for p in result.profiles]
            assert profile_id in profile_ids_found
            assert different_profile_id in profile_ids_found

    def test_get_profiles_for_trace_merges_continuous_profiles(self) -> None:
        """Test that continuous profiles with same profiler_id and is_continuous are merged, regardless of transaction name."""
        trace_id = "c" * 32  # Valid 32-char hex trace ID

        profiler_id = uuid.uuid4().hex  # Same profiler ID for multiple spans
        thread_id = "67890"
        transaction_name1 = "api/continuous/test"
        transaction_name2 = "api/different/continuous"

        # Create multiple spans with the same profiler_id but different transactions (continuous profiles)
        spans = []
        for i in range(3):
            # Alternate between transaction names to test merging across transactions
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

        # Create a continuous profile span with different profiler_id (should not be merged)
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
                                        "function": "continuous_merged_function",
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

            # Should have 2 profiles: 1 merged for the shared profiler_id and 1 for the different profiler_id
            assert len(result.profiles) == 2

            # Find the profiles by profiler_id
            merged_profiles = [p for p in result.profiles if p.profile_id == profiler_id]
            different_profiles = [
                p for p in result.profiles if p.profile_id == different_profiler_id
            ]

            assert (
                len(merged_profiles) == 1
            ), "Should merge 3 continuous spans with same profiler_id into 1, regardless of transaction name"
            assert len(different_profiles) == 1, "Should keep different profiler_id separate"

            # Verify that the profile service was called only twice (once per unique profiler_id)
            # Both should use the /chunks endpoint for continuous profiles
            assert mock_service.call_count == 2

            # Check that all calls used the /chunks endpoint (continuous profiles)
            for call in mock_service.call_args_list:
                assert call[1]["method"] == "POST"
                assert "/chunks" in call[1]["path"]

            # Check that both unique profiler_ids were processed
            profile_ids_found = [p.profile_id for p in result.profiles]
            assert profiler_id in profile_ids_found
            assert different_profiler_id in profile_ids_found


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

    def _test_get_trace_from_id(self, use_short_id: bool) -> None:
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        spans = []
        for i in range(5):
            # Create a span tree for this trace
            span = self.create_span(
                {
                    **({"description": f"span-{i}"} if i != 4 else {}),
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": (None if i == 0 else spans[i // 2]["span_id"]),
                    "is_segment": i == 0,  # First span is the root
                },
                start_ts=self.ten_mins_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)
        result = get_trace_from_id(trace_id[:8] if use_short_id else trace_id, self.organization.id)
        assert isinstance(result, list)

        seen_span_ids = []
        root_spans = []

        def check(e):
            assert "event_id" in e
            assert e["transaction"] == transaction_name
            assert e["project_id"] == self.project.id

            # TODO: handle non-span events

            # Is a span
            assert "op" in e
            assert "description" in e
            assert "parent_span_id" in e
            assert "children" in e

            desc = e["description"]
            assert isinstance(desc, str)
            if desc:
                assert desc.startswith("span-")

            # TODO: test connected errors/occurrences

            seen_span_ids.append(e["event_id"])

            if e["parent_span_id"] is None:
                # Is root
                assert e["is_transaction"]
                root_spans.append(e["event_id"])

            # Recurse
            for child in e["children"]:
                check(child)

        for event in result:
            check(event)

        assert set(seen_span_ids) == {s["span_id"] for s in spans}
        assert len(root_spans) == 1

    def test_get_trace_from_short_id(self) -> None:
        self._test_get_trace_from_id(use_short_id=True)

    def test_get_trace_from_id_full_id(self) -> None:
        self._test_get_trace_from_id(use_short_id=False)

    def test_get_trace_from_id_wrong_project(self) -> None:
        transaction_name = "api/users/profile"
        trace_id = uuid.uuid4().hex
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        spans = []
        for i in range(2):
            span = self.create_span(
                {
                    "project_id": other_project.id,
                    "description": f"span-{i}",
                    "sentry_tags": {"transaction": transaction_name},
                    "trace_id": trace_id,
                    "parent_span_id": None if i == 0 else f"parent-{i-1}",
                    "is_segment": i == 0,  # First span is the transaction span
                },
                start_ts=self.ten_mins_ago + timedelta(minutes=i),
            )
            spans.append(span)

        self.store_spans(spans, is_eap=True)

        # Call with short ID
        result = get_trace_from_id(trace_id[:8], self.project.id)
        assert result is None
