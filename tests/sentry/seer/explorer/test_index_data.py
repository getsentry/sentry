import uuid
from datetime import timedelta
from unittest import mock

import orjson

from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.seer.explorer.index_data import (
    get_issues_for_transaction,
    get_profiles_for_trace,
    get_trace_for_transaction,
    get_transactions_for_project,
)
from sentry.seer.sentry_data_models import ExecutionTreeNode
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

        # Mock only the external profiling service calls
        with (
            mock.patch(
                "sentry.seer.explorer.index_data.get_from_profiling_service"
            ) as mock_service,
            mock.patch(
                "sentry.seer.explorer.index_data.convert_profile_to_execution_tree"
            ) as mock_convert,
        ):
            # Mock profile service responses for both transaction and continuous profiles
            def mock_service_response(method, path, *args, **kwargs):
                if f"profiles/{profile1_id}" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps({"profile": "transaction_data1"})
                    return response
                elif f"profiles/{profile2_id}" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps({"profile": "transaction_data2"})
                    return response
                elif f"chunks/{profiler_id}" in path:
                    response = mock.Mock()
                    response.status = 200
                    response.data = orjson.dumps({"profile": "continuous_data"})
                    return response
                else:
                    # Return 404 for unexpected calls
                    response = mock.Mock()
                    response.status = 404
                    return response

            mock_service.side_effect = mock_service_response

            # Mock execution tree conversion
            def mock_convert_response(data):
                if data.get("profile") == "transaction_data1":
                    return [
                        ExecutionTreeNode(
                            function="main",
                            module="app",
                            filename="main.py",
                            lineno=10,
                            in_app=True,
                            children=[],
                            node_id="node1",
                            sample_count=5,
                        )
                    ]
                elif data.get("profile") == "transaction_data2":
                    return [
                        ExecutionTreeNode(
                            function="query",
                            module="db",
                            filename="db.py",
                            lineno=20,
                            in_app=True,
                            children=[],
                            node_id="node2",
                            sample_count=3,
                        )
                    ]
                elif data.get("profile") == "continuous_data":
                    return [
                        ExecutionTreeNode(
                            function="continuous_func",
                            module="profiler",
                            filename="profiler.py",
                            lineno=30,
                            in_app=True,
                            children=[],
                            node_id="node3",
                            sample_count=7,
                        )
                    ]
                return None

            mock_convert.side_effect = mock_convert_response

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
                "GET",
                f"/organizations/{self.organization.id}/projects/{self.project.id}/chunks/{profiler_id}",
                params={"format": "sample"},
            )


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

        # Since search backend indexing doesn't work reliably in tests,
        # let's mock the search backend to return our created groups
        groups = [event1.group, event2.group, event3.group]

        # Verify transaction tags are set correctly
        for group in groups:
            latest_event = group.get_latest_event()
            transaction_tag = latest_event.get_tag("transaction")
            assert (
                transaction_tag == transaction_name
            ), f"Expected transaction tag '{transaction_name}', got '{transaction_tag}'"

        # Mock the search backend to return our groups
        with mock.patch("sentry.seer.explorer.index_data.search.backend.query") as mock_search:
            mock_search.return_value = iter(groups)

            # Call the function
            result = get_issues_for_transaction(transaction_name, self.project.id)

            # Verify the result
            assert result is not None
            assert result.transaction_name == transaction_name
            assert result.project_id == self.project.id
            assert len(result.issues) == 3

            # Get the issues and sort them by ID for consistent ordering
            issues = sorted(result.issues, key=lambda x: x.issue_id)
            sorted_groups = sorted(groups, key=lambda x: x.id)

            # Check each issue matches the corresponding group
            for i, (issue, group) in enumerate(zip(issues, sorted_groups)):
                assert issue.issue_id == group.id
                assert issue.title == group.title
                assert issue.culprit == group.culprit
                # transaction field in issue should come from the event tags
                assert issue.transaction == transaction_name
                assert "id" in issue.events[0]
                assert "message" in issue.events[0]
                # Check that the event has the transaction in its tags or serialized data
                assert (
                    "tags" in issue.events[0]
                    or issue.events[0].get("transaction") == transaction_name
                )
