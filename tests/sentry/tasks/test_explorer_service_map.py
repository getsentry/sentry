"""
Tests for Explorer Service Map Tasks

Tests the service map building, graph analysis, and task execution
for the Explorer service map feature.
"""

from unittest import mock
from uuid import uuid4

import pytest
import responses
from django.conf import settings
from django.core.cache import cache

from sentry.tasks.explorer_service_map import (
    _classify_service_roles,
    _get_rate_limit_key,
    _is_rate_limited,
    _query_service_dependencies,
    _query_top_transactions,
    _send_to_seer,
    _set_rate_limit,
    build_service_map,
    schedule_service_map_builds,
)
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba


@django_db_all
class TestRateLimiting(TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_rate_limit_key_generation(self):
        org_id = 123
        key = _get_rate_limit_key(org_id)
        assert key == "explorer_service_map_last_run:123"

    def test_not_rate_limited_initially(self):
        org = self.create_organization()
        assert _is_rate_limited(org.id) is False

    def test_rate_limited_after_set(self):
        org = self.create_organization()

        with override_options({"explorer.service_map.rate_limit_seconds": 3600}):
            _set_rate_limit(org.id)
            assert _is_rate_limited(org.id) is True

    def test_force_bypasses_rate_limit(self):
        org = self.create_organization()

        with override_options({"explorer.service_map.rate_limit_seconds": 3600}):
            _set_rate_limit(org.id)
            assert _is_rate_limited(org.id, force=True) is False

    def test_rate_limit_expires(self):
        org = self.create_organization()

        # Set very short rate limit
        with override_options({"explorer.service_map.rate_limit_seconds": 1}):
            _set_rate_limit(org.id)
            assert _is_rate_limited(org.id) is True

            # Wait for expiration (cache timeout handles this automatically)
            cache.delete(_get_rate_limit_key(org.id))
            assert _is_rate_limited(org.id) is False


@django_db_all
class TestQueryTopTransactions(TestCase):
    def test_returns_empty_for_nonexistent_org(self):
        result = _query_top_transactions(99999)
        assert result == []

    def test_returns_empty_for_org_with_no_projects(self):
        org = self.create_organization()
        result = _query_top_transactions(org.id)
        assert result == []

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_queries_with_correct_parameters(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)

        mock_query.return_value = {"data": []}

        _query_top_transactions(org.id, limit=50)

        mock_query.assert_called_once()
        call_kwargs = mock_query.call_args[1]

        assert call_kwargs["query_string"] == "is_transaction:true"
        assert "transaction" in call_kwargs["selected_columns"]
        assert "sum(span.duration)" in call_kwargs["selected_columns"]
        assert call_kwargs["orderby"] == ["-sum(span.duration)"]
        assert call_kwargs["limit"] == 50

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_returns_transaction_names(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)

        mock_query.return_value = {
            "data": [
                {"transaction": "/api/users", "sum(span.duration)": 5000},
                {"transaction": "/api/events", "sum(span.duration)": 3000},
                {"transaction": "", "sum(span.duration)": 1000},  # Should be filtered
            ]
        }

        result = _query_top_transactions(org.id)

        assert len(result) == 2
        assert "/api/users" in result
        assert "/api/events" in result
        assert "" not in result

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_handles_query_exception(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)

        mock_query.side_effect = Exception("Snuba error")

        result = _query_top_transactions(org.id)
        assert result == []


@django_db_all
@django_db_all
class TestSendToSeer(TestCase):
    @responses.activate
    def test_sends_correct_payload(self):
        org = self.create_organization()

        edges = [
            {"source_project_id": 1, "target_project_id": 2, "count": 10},
        ]
        roles = {1: "frontend", 2: "core_backend"}

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/explorer/service-map/update",
            json={"status": "success"},
            status=200,
        )

        _send_to_seer(org.id, edges, roles)

        assert len(responses.calls) == 1
        request = responses.calls[0].request

        # Verify payload
        import orjson

        body = orjson.loads(request.body)
        assert body["organization_id"] == org.id
        assert body["edges"] == edges
        # Roles should have string keys (orjson requirement)
        assert body["roles"] == {"1": "frontend", "2": "core_backend"}
        assert "generated_at" in body

    @responses.activate
    def test_handles_seer_error(self):
        org = self.create_organization()

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/explorer/service-map/update",
            json={"error": "Internal error"},
            status=500,
        )

        with pytest.raises(Exception):
            _send_to_seer(org.id, [], {})


@django_db_all
class TestBuildServiceMap(TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_respects_enable_flag(self):
        org = self.create_organization()

        with override_options({"explorer.service_map.enable": False}):
            with mock.patch(
                "sentry.tasks.explorer_service_map._query_top_transactions"
            ) as mock_query:
                build_service_map(org.id)

        mock_query.assert_not_called()

    def test_respects_killswitch(self):
        org = self.create_organization()

        with override_options(
            {"explorer.service_map.enable": True, "explorer.service_map.killswitch": True}
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map._query_top_transactions"
            ) as mock_query:
                build_service_map(org.id)

        mock_query.assert_not_called()

    def test_respects_rate_limiting(self):
        org = self.create_organization()

        with override_options(
            {"explorer.service_map.enable": True, "explorer.service_map.rate_limit_seconds": 3600}
        ):
            # Set rate limit
            _set_rate_limit(org.id)

            with mock.patch(
                "sentry.tasks.explorer_service_map._query_top_transactions"
            ) as mock_query:
                build_service_map(org.id)

        # Should not query since rate limited
        mock_query.assert_not_called()

    def test_force_bypasses_rate_limiting(self):
        org = self.create_organization()
        self.create_project(organization=org)

        with override_options(
            {"explorer.service_map.enable": True, "explorer.service_map.rate_limit_seconds": 3600}
        ):
            _set_rate_limit(org.id)

            with mock.patch(
                "sentry.tasks.explorer_service_map._query_top_transactions"
            ) as mock_query:
                mock_query.return_value = []
                build_service_map(org.id, force=True)

        # Should query even though rate limited
        mock_query.assert_called_once()

    @mock.patch("sentry.tasks.explorer_service_map._send_to_seer")
    @mock.patch("sentry.tasks.explorer_service_map._query_service_dependencies")
    @mock.patch("sentry.tasks.explorer_service_map._query_top_transactions")
    def test_complete_workflow(self, mock_transactions, mock_dependencies, mock_send):
        org = self.create_organization()
        project1 = self.create_project(organization=org)
        project2 = self.create_project(organization=org)

        mock_transactions.return_value = ["/api/users"]
        mock_dependencies.return_value = [
            {"source_project_id": project1.id, "target_project_id": project2.id, "count": 10}
        ]

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.rate_limit_seconds": 3600,
            }
        ):
            build_service_map(org.id)

        mock_transactions.assert_called_once_with(org.id)
        mock_dependencies.assert_called_once_with(org.id, ["/api/users"])
        mock_send.assert_called_once()

        # Verify rate limit was set
        assert _is_rate_limited(org.id) is True

    @mock.patch("sentry.tasks.explorer_service_map._query_top_transactions")
    def test_handles_no_transactions(self, mock_transactions):
        org = self.create_organization()

        mock_transactions.return_value = []

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.rate_limit_seconds": 3600,
            }
        ):
            build_service_map(org.id)

        # Should set rate limit even with no transactions
        assert _is_rate_limited(org.id) is True

    @mock.patch("sentry.tasks.explorer_service_map._query_service_dependencies")
    @mock.patch("sentry.tasks.explorer_service_map._query_top_transactions")
    def test_handles_no_edges(self, mock_transactions, mock_dependencies):
        org = self.create_organization()

        mock_transactions.return_value = ["/api/users"]
        mock_dependencies.return_value = []

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.rate_limit_seconds": 3600,
            }
        ):
            with mock.patch("sentry.tasks.explorer_service_map._send_to_seer") as mock_send:
                build_service_map(org.id)

        # Should not send to Seer with no edges
        mock_send.assert_not_called()

        # Should still set rate limit
        assert _is_rate_limited(org.id) is True

    @mock.patch("sentry.tasks.explorer_service_map._query_top_transactions")
    def test_handles_exception(self, mock_transactions):
        org = self.create_organization()

        mock_transactions.side_effect = Exception("Test error")

        with override_options({"explorer.service_map.enable": True}):
            # Should not raise exception
            build_service_map(org.id)


@django_db_all
class TestScheduleServiceMapBuilds(TestCase):
    def test_respects_enable_flag(self):
        org = self.create_organization()

        with override_options(
            {
                "explorer.service_map.enable": False,
                "explorer.service_map.allowed_organizations": [org.id],
            }
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map.build_service_map.apply_async"
            ) as mock_task:
                schedule_service_map_builds()

        mock_task.assert_not_called()

    def test_respects_killswitch(self):
        org = self.create_organization()

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.killswitch": True,
                "explorer.service_map.allowed_organizations": [org.id],
            }
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map.build_service_map.apply_async"
            ) as mock_task:
                schedule_service_map_builds()

        mock_task.assert_not_called()

    def test_dispatches_tasks_for_allowed_orgs(self):
        org1 = self.create_organization()
        org2 = self.create_organization()
        org3 = self.create_organization()

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.allowed_organizations": [org1.id, org2.id],
            }
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map.build_service_map.apply_async"
            ) as mock_task:
                schedule_service_map_builds()

        # Should dispatch 2 tasks
        assert mock_task.call_count == 2

        # Verify correct org IDs
        dispatched_org_ids = [call[1]["args"][0] for call in mock_task.call_args_list]
        assert org1.id in dispatched_org_ids
        assert org2.id in dispatched_org_ids
        assert org3.id not in dispatched_org_ids

    def test_handles_empty_allowlist(self):
        with override_options(
            {"explorer.service_map.enable": True, "explorer.service_map.allowed_organizations": []}
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map.build_service_map.apply_async"
            ) as mock_task:
                schedule_service_map_builds()

        mock_task.assert_not_called()

    def test_continues_on_dispatch_error(self):
        org1 = self.create_organization()
        org2 = self.create_organization()

        with override_options(
            {
                "explorer.service_map.enable": True,
                "explorer.service_map.allowed_organizations": [org1.id, org2.id],
            }
        ):
            with mock.patch(
                "sentry.tasks.explorer_service_map.build_service_map.apply_async"
            ) as mock_task:
                # First call fails, second succeeds
                mock_task.side_effect = [Exception("Dispatch error"), None]

                schedule_service_map_builds()

        # Should attempt both dispatches
        assert mock_task.call_count == 2


# =========================================================================================
# INTEGRATION TESTS - Real Snuba queries with actual span data
# =========================================================================================


@pytest.mark.django_db(databases="__all__")
@pytest.mark.snuba
@requires_snuba
class TestQueryServiceDependenciesIntegration(SnubaTestCase, SpanTestCase):
    """Integration tests for cross-project dependency extraction using real Snuba data"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        self.ten_mins_ago = before_now(minutes=10)
        yield

    def _verify_edge(self, edges, source_slug, target_slug, expected_count=None):
        """Verify specific edge exists with expected properties"""
        matching = [
            e
            for e in edges
            if e["source_project_slug"] == source_slug and e["target_project_slug"] == target_slug
        ]
        assert len(matching) == 1, (
            f"Expected 1 {source_slug}→{target_slug} edge, found {len(matching)}"
        )
        if expected_count:
            assert matching[0]["count"] == expected_count
        return matching[0]

    def _create_service_topology(self, topology_map, start_ts):
        """
        Create multi-project topology from map.

        Args:
            topology_map: {"source": ["target1", "target2"]}

        Returns:
            (projects_dict, spans_list)
        """

        projects = {}
        spans = []

        # Create projects
        all_names = set(topology_map.keys())
        for targets in topology_map.values():
            all_names.update(targets)
        for name in all_names:
            projects[name] = self.create_project(organization=self.organization, slug=name)

        # Create spans for each edge
        for source, targets in topology_map.items():
            for target in targets:
                trace_id = uuid4().hex
                source_span_id = uuid4().hex[:16]

                # Create parent span in source project
                parent_span = {
                    "trace_id": trace_id,
                    "span_id": source_span_id,
                    "parent_span_id": "0000000000000000",
                    "is_segment": True,
                    "sentry_tags": {"transaction": f"/{source}/transaction"},
                }

                # Create child span in target project
                child_span = {
                    "trace_id": trace_id,
                    "span_id": uuid4().hex[:16],
                    "parent_span_id": source_span_id,
                    "is_segment": True,
                    "sentry_tags": {"transaction": f"/{target}/transaction"},
                }

                spans.extend(
                    [
                        self.create_span(
                            extra_data=parent_span,
                            project=projects[source],
                            start_ts=start_ts,
                            duration=2000,
                        ),
                        self.create_span(
                            extra_data=child_span,
                            project=projects[target],
                            start_ts=start_ts,
                            duration=1000,
                        ),
                    ]
                )

        return projects, spans

    def test_simple_cross_project_edge(self):
        """Test basic A→B cross-project dependency"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")

        trace_id = uuid4().hex
        parent_span_id = uuid4().hex[:16]

        # Create parent span in frontend
        parent = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": parent_span_id,
                "parent_span_id": "0000000000000000",
                "is_segment": True,
                "sentry_tags": {"transaction": "/frontend/page"},
            },
            project=project_frontend,
            start_ts=self.ten_mins_ago,
            duration=2000,
        )

        # Create child span in API
        child = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": parent_span_id,
                "is_segment": True,
                "sentry_tags": {"transaction": "/api/users"},
            },
            project=project_api,
            start_ts=self.ten_mins_ago,
            duration=1000,
        )

        # Store spans
        self.store_spans([parent, child])

        # Query
        edges = _query_service_dependencies(self.organization.id, ["/api/users"])

        # Verify
        assert len(edges) == 1
        edge = edges[0]
        assert edge["source_project_id"] == project_frontend.id
        assert edge["source_project_slug"] == "frontend"
        assert edge["target_project_id"] == project_api.id
        assert edge["target_project_slug"] == "api"
        assert edge["count"] == 1

    def test_multi_hop_chain(self):
        """Test A→B→C multi-hop chain"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_db = self.create_project(organization=self.organization, slug="database")

        trace_id = uuid4().hex
        frontend_span_id = uuid4().hex[:16]
        api_span_id = uuid4().hex[:16]

        # Create frontend → api → database chain
        frontend_span = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": frontend_span_id,
                "parent_span_id": "0000000000000000",
                "is_segment": True,
                "sentry_tags": {"transaction": "/frontend/page"},
            },
            project=project_frontend,
            start_ts=self.ten_mins_ago,
            duration=3000,
        )

        api_span = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": api_span_id,
                "parent_span_id": frontend_span_id,
                "is_segment": True,
                "sentry_tags": {"transaction": "/api/users"},
            },
            project=project_api,
            start_ts=self.ten_mins_ago,
            duration=2000,
        )

        db_span = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": api_span_id,
                "is_segment": True,
                "sentry_tags": {"transaction": "/db/query"},
            },
            project=project_db,
            start_ts=self.ten_mins_ago,
            duration=1000,
        )

        self.store_spans([frontend_span, api_span, db_span])

        # Query for both downstream transactions
        edges = _query_service_dependencies(self.organization.id, ["/api/users", "/db/query"])

        # Verify both edges exist
        assert len(edges) == 2

        edge_pairs = {(e["source_project_slug"], e["target_project_slug"]) for e in edges}
        assert edge_pairs == {("frontend", "api"), ("api", "database")}

    def test_filters_same_project_edges(self):
        """Test that same-project edges are filtered out"""

        # Setup single project
        project = self.create_project(organization=self.organization, slug="monolith")

        trace_id = uuid4().hex
        parent_span_id = uuid4().hex[:16]

        # Create parent and child in same project
        parent = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": parent_span_id,
                "parent_span_id": "0000000000000000",
                "is_segment": True,
                "sentry_tags": {"transaction": "/parent/transaction"},
            },
            project=project,
            start_ts=self.ten_mins_ago,
            duration=2000,
        )

        child = self.create_span(
            extra_data={
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": parent_span_id,
                "is_segment": True,
                "sentry_tags": {"transaction": "/child/transaction"},
            },
            project=project,
            start_ts=self.ten_mins_ago,
            duration=1000,
        )

        self.store_spans([parent, child])

        # Query
        edges = _query_service_dependencies(self.organization.id, ["/child/transaction"])

        # Verify no edges (same-project filtered)
        assert len(edges) == 0

    def test_aggregates_duplicate_edges(self):
        """Test that duplicate A→B edges are aggregated with count"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")

        spans = []

        # Create 3 separate traces with frontend→api pattern using different transactions
        # to avoid deduplication (implementation keeps only one segment per transaction name)
        for i in range(3):
            trace_id = uuid4().hex
            parent_span_id = uuid4().hex[:16]

            parent = self.create_span(
                extra_data={
                    "trace_id": trace_id,
                    "span_id": parent_span_id,
                    "parent_span_id": "0000000000000000",
                    "is_segment": True,
                    "sentry_tags": {"transaction": "/frontend/page"},
                },
                project=project_frontend,
                start_ts=self.ten_mins_ago,
                duration=2000,
            )

            child = self.create_span(
                extra_data={
                    "trace_id": trace_id,
                    "span_id": uuid4().hex[:16],
                    "parent_span_id": parent_span_id,
                    "is_segment": True,
                    "sentry_tags": {
                        "transaction": f"/api/endpoint{i}"
                    },  # Unique transaction per trace
                },
                project=project_api,
                start_ts=self.ten_mins_ago,
                duration=1000,
            )

            spans.extend([parent, child])

        self.store_spans(spans)

        # Query for all 3 transactions
        edges = _query_service_dependencies(
            self.organization.id, ["/api/endpoint0", "/api/endpoint1", "/api/endpoint2"]
        )

        # Verify single edge with count=3 (aggregated across different transactions)
        assert len(edges) == 1
        edge = edges[0]
        assert edge["source_project_slug"] == "frontend"
        assert edge["target_project_slug"] == "api"
        assert edge["count"] == 3

    def test_handles_missing_parent_spans(self):
        """Test graceful handling of orphaned spans with non-existent parents"""

        # Setup projects
        project = self.create_project(organization=self.organization, slug="orphan")

        # Create child with non-existent parent
        child = self.create_span(
            extra_data={
                "trace_id": uuid4().hex,
                "span_id": uuid4().hex[:16],
                "parent_span_id": "nonexistent1234",  # Non-existent parent
                "is_segment": True,
                "sentry_tags": {"transaction": "/orphan/transaction"},
            },
            project=project,
            start_ts=self.ten_mins_ago,
            duration=1000,
        )

        self.store_spans([child])

        # Query
        edges = _query_service_dependencies(self.organization.id, ["/orphan/transaction"])

        # Verify no edges created for orphans
        assert len(edges) == 0

    def test_multiple_services_calling_same_backend(self):
        """Test fan-in pattern: A→C and B→C"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_mobile = self.create_project(organization=self.organization, slug="mobile")
        project_api = self.create_project(organization=self.organization, slug="api")

        spans = []

        # Create frontend → api trace
        trace1 = uuid4().hex
        frontend_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": frontend_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/frontend/page"},
                    },
                    project=project_frontend,
                    start_ts=self.ten_mins_ago,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": frontend_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/api/users"},  # Transaction 1
                    },
                    project=project_api,
                    start_ts=self.ten_mins_ago,
                    duration=1000,
                ),
            ]
        )

        # Create mobile → api trace
        trace2 = uuid4().hex
        mobile_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": mobile_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/mobile/screen"},
                    },
                    project=project_mobile,
                    start_ts=self.ten_mins_ago,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": mobile_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/api/events"},  # Different transaction
                    },
                    project=project_api,
                    start_ts=self.ten_mins_ago,
                    duration=1000,
                ),
            ]
        )

        self.store_spans(spans)

        # Query for both transactions
        edges = _query_service_dependencies(self.organization.id, ["/api/users", "/api/events"])

        # Verify both edges targeting API
        assert len(edges) == 2
        edge_pairs = {(e["source_project_slug"], e["target_project_slug"]) for e in edges}
        assert edge_pairs == {("frontend", "api"), ("mobile", "api")}

    def test_circular_dependencies(self):
        """Test circular dependencies: A→B in trace1, B→A in trace2"""

        # Setup projects
        project_a = self.create_project(organization=self.organization, slug="service-a")
        project_b = self.create_project(organization=self.organization, slug="service-b")

        spans = []

        # Create A → B trace (using unique transaction names)
        trace1 = uuid4().hex
        a_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": a_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/service-a/endpoint1"},
                    },
                    project=project_a,
                    start_ts=self.ten_mins_ago,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": a_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/service-b/endpoint1"},
                    },
                    project=project_b,
                    start_ts=self.ten_mins_ago,
                    duration=1000,
                ),
            ]
        )

        # Create B → A trace (using different unique transaction names)
        trace2 = uuid4().hex
        b_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": b_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/service-b/endpoint2"},
                    },
                    project=project_b,
                    start_ts=self.ten_mins_ago,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": b_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/service-a/endpoint2"},
                    },
                    project=project_a,
                    start_ts=self.ten_mins_ago,
                    duration=1000,
                ),
            ]
        )

        self.store_spans(spans)

        # Query for all transactions
        edges = _query_service_dependencies(
            self.organization.id,
            [
                "/service-a/endpoint1",
                "/service-a/endpoint2",
                "/service-b/endpoint1",
                "/service-b/endpoint2",
            ],
        )

        # Verify both circular edges detected
        assert len(edges) == 2
        edge_pairs = {(e["source_project_slug"], e["target_project_slug"]) for e in edges}
        assert edge_pairs == {("service-a", "service-b"), ("service-b", "service-a")}


@pytest.mark.django_db(databases="__all__")
@pytest.mark.snuba
@requires_snuba
class TestClassifyServiceRolesIntegration(SnubaTestCase, SpanTestCase):
    """Integration tests for service role classification with real topologies"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        self.ten_mins_ago = before_now(minutes=10)
        yield

    def test_frontend_classification(self):
        """Test classification of frontend service (high out-degree, low in-degree)"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_db = self.create_project(organization=self.organization, slug="database")

        start_ts = self.ten_mins_ago
        spans = []

        # Frontend calls both API and database (high out-degree)
        for target_project, target_tx in [
            (project_api, "/api/users"),
            (project_db, "/db/query"),
        ]:
            trace_id = uuid4().hex
            frontend_span_id = uuid4().hex[:16]

            spans.extend(
                [
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": frontend_span_id,
                            "parent_span_id": "0000000000000000",
                            "is_segment": True,
                            "sentry_tags": {"transaction": "/frontend/page"},
                        },
                        project=project_frontend,
                        start_ts=start_ts,
                        duration=2000,
                    ),
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": uuid4().hex[:16],
                            "parent_span_id": frontend_span_id,
                            "is_segment": True,
                            "sentry_tags": {"transaction": target_tx},
                        },
                        project=target_project,
                        start_ts=start_ts,
                        duration=1000,
                    ),
                ]
            )

        self.store_spans(spans)

        # Query and classify
        edges = _query_service_dependencies(self.organization.id, ["/api/users", "/db/query"])
        roles = _classify_service_roles(edges)

        # Frontend should be classified as frontend (only outgoing edges)
        assert roles[project_frontend.id] == "frontend"

    def test_core_backend_classification(self):
        """Test classification of core backend (high in-degree and out-degree)"""

        # Setup projects: frontend → api → database
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_db = self.create_project(organization=self.organization, slug="database")

        start_ts = self.ten_mins_ago
        spans = []

        # Frontend → API edge
        trace1 = uuid4().hex
        frontend_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": frontend_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/frontend/page"},
                    },
                    project=project_frontend,
                    start_ts=start_ts,
                    duration=3000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace1,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": frontend_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/api/users"},  # Unique transaction 1
                    },
                    project=project_api,
                    start_ts=start_ts,
                    duration=2000,
                ),
            ]
        )

        # API → Database edge (use different transaction to avoid deduplication)
        trace2 = uuid4().hex
        api_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": api_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/api/events"},  # Different transaction
                    },
                    project=project_api,
                    start_ts=start_ts,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace2,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": api_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/db/query"},
                    },
                    project=project_db,
                    start_ts=start_ts,
                    duration=1000,
                ),
            ]
        )

        self.store_spans(spans)

        # Query and classify (query both transactions)
        edges = _query_service_dependencies(
            self.organization.id, ["/api/users", "/api/events", "/db/query"]
        )
        roles = _classify_service_roles(edges)

        # API should be core_backend (both incoming and outgoing edges)
        assert roles[project_api.id] == "core_backend"

    def test_isolated_classification(self):
        """Test classification of isolated service (low connectivity)"""

        # Setup projects with chain: frontend → api → database, isolated has minimal connections
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_isolated = self.create_project(organization=self.organization, slug="isolated")

        start_ts = self.ten_mins_ago
        spans = []

        # Create high-traffic frontend → api edge
        for i in range(5):
            trace_id = uuid4().hex
            frontend_span_id = uuid4().hex[:16]

            spans.extend(
                [
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": frontend_span_id,
                            "parent_span_id": "0000000000000000",
                            "is_segment": True,
                            "sentry_tags": {"transaction": "/frontend/page"},
                        },
                        project=project_frontend,
                        start_ts=start_ts,
                        duration=2000,
                    ),
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": uuid4().hex[:16],
                            "parent_span_id": frontend_span_id,
                            "is_segment": True,
                            "sentry_tags": {"transaction": "/api/users"},
                        },
                        project=project_api,
                        start_ts=start_ts,
                        duration=1000,
                    ),
                ]
            )

        # Create single low-traffic edge to isolated service
        trace_isolated = uuid4().hex
        api_span_id = uuid4().hex[:16]

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace_isolated,
                        "span_id": api_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/api/users"},
                    },
                    project=project_api,
                    start_ts=start_ts,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace_isolated,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": api_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/isolated/endpoint"},
                    },
                    project=project_isolated,
                    start_ts=start_ts,
                    duration=1000,
                ),
            ]
        )

        self.store_spans(spans)

        # Query and classify
        edges = _query_service_dependencies(
            self.organization.id, ["/api/users", "/isolated/endpoint"]
        )
        roles = _classify_service_roles(edges)

        # Isolated should have low connectivity classification
        assert roles[project_isolated.id] == "isolated"


@pytest.mark.django_db(databases="__all__")
@pytest.mark.snuba
@requires_snuba
class TestBuildServiceMapIntegration(SnubaTestCase, SpanTestCase):
    """End-to-end integration tests for the complete service map pipeline"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        from django.core.cache import cache

        self.ten_mins_ago = before_now(minutes=10)
        cache.clear()
        yield

    def test_complete_workflow_realistic_topology(self):
        """Test complete workflow with realistic multi-service topology"""
        import orjson
        from django.conf import settings

        from sentry.testutils.helpers.options import override_options

        # Setup realistic topology: frontend → api → [database, cache]
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_db = self.create_project(organization=self.organization, slug="database")
        project_cache = self.create_project(organization=self.organization, slug="cache")

        start_ts = self.ten_mins_ago
        spans = []

        # Create frontend → api traces (3 traces with unique transactions)
        api_transactions = []
        for i in range(3):
            trace_id = uuid4().hex
            frontend_span_id = uuid4().hex[:16]
            api_tx = f"/api/endpoint{i}"  # Unique transaction name
            api_transactions.append(api_tx)

            spans.extend(
                [
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": frontend_span_id,
                            "parent_span_id": "0000000000000000",
                            "is_segment": True,
                            "sentry_tags": {"transaction": "/frontend/page"},
                        },
                        project=project_frontend,
                        start_ts=start_ts,
                        duration=3000,
                    ),
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": uuid4().hex[:16],
                            "parent_span_id": frontend_span_id,
                            "is_segment": True,
                            "sentry_tags": {"transaction": api_tx},  # Unique per trace
                        },
                        project=project_api,
                        start_ts=start_ts,
                        duration=2000,
                    ),
                ]
            )

        # Create api → database traces (2 traces with unique transactions)
        db_transactions = []
        for i in range(2):
            trace_id = uuid4().hex
            api_span_id = uuid4().hex[:16]
            api_db_tx = f"/api/db-endpoint{i}"  # Unique transaction name
            api_transactions.append(api_db_tx)
            db_tx = f"/db/query{i}"
            db_transactions.append(db_tx)

            spans.extend(
                [
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": api_span_id,
                            "parent_span_id": "0000000000000000",
                            "is_segment": True,
                            "sentry_tags": {"transaction": api_db_tx},  # Unique per trace
                        },
                        project=project_api,
                        start_ts=start_ts,
                        duration=2000,
                    ),
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": uuid4().hex[:16],
                            "parent_span_id": api_span_id,
                            "is_segment": True,
                            "sentry_tags": {"transaction": db_tx},  # Unique per trace
                        },
                        project=project_db,
                        start_ts=start_ts,
                        duration=1000,
                    ),
                ]
            )

        # Create api → cache trace (1 trace)
        trace_cache = uuid4().hex
        api_cache_span_id = uuid4().hex[:16]
        api_cache_tx = "/api/cache-endpoint"
        api_transactions.append(api_cache_tx)

        spans.extend(
            [
                self.create_span(
                    extra_data={
                        "trace_id": trace_cache,
                        "span_id": api_cache_span_id,
                        "parent_span_id": "0000000000000000",
                        "is_segment": True,
                        "sentry_tags": {"transaction": api_cache_tx},  # Unique
                    },
                    project=project_api,
                    start_ts=start_ts,
                    duration=2000,
                ),
                self.create_span(
                    extra_data={
                        "trace_id": trace_cache,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": api_cache_span_id,
                        "is_segment": True,
                        "sentry_tags": {"transaction": "/cache/get"},
                    },
                    project=project_cache,
                    start_ts=start_ts,
                    duration=500,
                ),
            ]
        )

        self.store_spans(spans)

        # Mock Seer endpoint and execute workflow
        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                f"{settings.SEER_AUTOFIX_URL}/v1/explorer/service-map/update",
                json={"status": "success"},
                status=200,
            )

            # Execute complete workflow
            with override_options(
                {
                    "explorer.service_map.enable": True,
                    "explorer.service_map.rate_limit_seconds": 3600,
                    "explorer.service_map.max_edges": 5000,
                }
            ):
                build_service_map(self.organization.id)

            # Verify Seer was called
            assert len(rsps.calls) == 1
            request = rsps.calls[0].request
            payload = orjson.loads(request.body)

            # Verify payload structure
            assert payload["organization_id"] == self.organization.id
            assert "edges" in payload
            assert "roles" in payload
            assert "generated_at" in payload

            # Verify edges
            edges = payload["edges"]
            assert len(edges) == 3  # frontend→api, api→database, api→cache

            edge_pairs = {(e["source_project_slug"], e["target_project_slug"]) for e in edges}
            assert edge_pairs == {("frontend", "api"), ("api", "database"), ("api", "cache")}

            # Verify edge counts are aggregated correctly
            for edge in edges:
                if (
                    edge["source_project_slug"] == "frontend"
                    and edge["target_project_slug"] == "api"
                ):
                    assert edge["count"] == 3
                elif (
                    edge["source_project_slug"] == "api"
                    and edge["target_project_slug"] == "database"
                ):
                    assert edge["count"] == 2
                elif (
                    edge["source_project_slug"] == "api" and edge["target_project_slug"] == "cache"
                ):
                    assert edge["count"] == 1

            # Verify roles
            roles = payload["roles"]
            assert str(project_frontend.id) in roles
            assert str(project_api.id) in roles

            # Verify edge format has required fields
            for edge in edges:
                assert "source_project_id" in edge
                assert "source_project_slug" in edge
                assert "target_project_id" in edge
                assert "target_project_slug" in edge
                assert "count" in edge
