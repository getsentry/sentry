"""
Tests for Explorer Service Map Tasks

Tests the service map building, graph analysis, and task execution
for the Explorer service map feature.
"""

from unittest import mock

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
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


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
class TestQueryServiceDependencies(TestCase):
    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_returns_empty_for_no_transactions(self, mock_query):
        org = self.create_organization()
        result = _query_service_dependencies(org.id, [])
        assert result == []
        mock_query.assert_not_called()

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_returns_empty_for_nonexistent_org(self, mock_query):
        result = _query_service_dependencies(99999, ["/api/users"])
        assert result == []
        mock_query.assert_not_called()

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_queries_segment_spans_with_while_loop(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)
        project2 = self.create_project(organization=org)

        transactions = ["/api/users", "/api/events"]

        # Mock segment span query - first iteration gets all transactions
        mock_query.return_value = {
            "data": [
                {
                    "id": "span1",
                    "parent_span": "parent1",
                    "project.id": project2.id,
                    "transaction": "/api/users",
                },
                {
                    "id": "span2",
                    "parent_span": "parent2",
                    "project.id": project2.id,
                    "transaction": "/api/events",
                },
            ]
        }

        with override_options({"explorer.service_map.max_edges": 5000}):
            _query_service_dependencies(org.id, transactions)

        # Should call query at least twice (once for segments, once for parents)
        assert mock_query.call_count >= 2

        # First call should be for segment spans
        first_call = mock_query.call_args_list[0][1]
        assert "is_transaction:true" in first_call["query_string"]
        assert "/api/users" in first_call["query_string"]

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_builds_cross_project_edges(self, mock_query):
        org = self.create_organization()
        project1 = self.create_project(organization=org, name="frontend", slug="frontend")
        project2 = self.create_project(organization=org, name="backend", slug="backend")

        transactions = ["/api/users"]

        # Mock responses: segment spans, then parent spans
        mock_query.side_effect = [
            # First call: segment spans
            {
                "data": [
                    {
                        "id": "span1",
                        "parent_span": "parent1",
                        "project.id": project2.id,
                        "project.slug": project2.slug,
                        "transaction": "/api/users",
                    }
                ]
            },
            # Second call: parent spans
            {"data": [{"id": "parent1", "project.id": project1.id, "project.slug": project1.slug}]},
        ]

        with override_options({"explorer.service_map.max_edges": 5000}):
            result = _query_service_dependencies(org.id, transactions)

        assert len(result) == 1
        assert result[0]["source_project_id"] == project1.id
        assert result[0]["source_project_slug"] == project1.slug
        assert result[0]["target_project_id"] == project2.id
        assert result[0]["target_project_slug"] == project2.slug
        assert result[0]["count"] == 1

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_filters_same_project_edges(self, mock_query):
        org = self.create_organization()
        project = self.create_project(organization=org)

        transactions = ["/api/users"]

        mock_query.side_effect = [
            # Segment spans
            {
                "data": [
                    {
                        "id": "span1",
                        "parent_span": "parent1",
                        "project.id": project.id,
                        "transaction": "/api/users",
                    }
                ]
            },
            # Parent spans - same project
            {"data": [{"id": "parent1", "project.id": project.id}]},
        ]

        with override_options({"explorer.service_map.max_edges": 5000}):
            result = _query_service_dependencies(org.id, transactions)

        # Should filter out same-project edges
        assert len(result) == 0

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_aggregates_duplicate_edges(self, mock_query):
        org = self.create_organization()
        project1 = self.create_project(organization=org, slug="frontend")
        project2 = self.create_project(organization=org, slug="backend")

        # Use two different transactions to test aggregation
        transactions = ["/api/users", "/api/events"]

        mock_query.side_effect = [
            # Multiple segments with same parent (different transactions)
            {
                "data": [
                    {
                        "id": "span1",
                        "parent_span": "parent1",
                        "project.id": project2.id,
                        "project.slug": project2.slug,
                        "transaction": "/api/users",
                    },
                    {
                        "id": "span2",
                        "parent_span": "parent1",
                        "project.id": project2.id,
                        "project.slug": project2.slug,
                        "transaction": "/api/events",
                    },
                ]
            },
            # Parent spans
            {"data": [{"id": "parent1", "project.id": project1.id, "project.slug": project1.slug}]},
        ]

        with override_options({"explorer.service_map.max_edges": 5000}):
            result = _query_service_dependencies(org.id, transactions)

        assert len(result) == 1
        assert result[0]["count"] == 2  # Aggregated count from both transactions

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_respects_max_edges_limit(self, mock_query):
        org = self.create_organization()
        projects = [self.create_project(organization=org) for _ in range(10)]

        transactions = ["/api/users"]

        # Create many edges
        segment_data = []
        parent_data = []

        for i in range(10):
            segment_data.append(
                {
                    "id": f"span{i}",
                    "parent_span": f"parent{i}",
                    "project.id": projects[i].id,
                    "transaction": "/api/users",
                }
            )
            parent_data.append({"id": f"parent{i}", "project.id": projects[(i + 1) % 10].id})

        mock_query.side_effect = [
            {"data": segment_data},
            {"data": parent_data},
        ]

        with override_options({"explorer.service_map.max_edges": 5}):
            result = _query_service_dependencies(org.id, transactions)

        # Should limit to 5 edges
        assert len(result) <= 5

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_handles_missing_parent_spans(self, mock_query):
        org = self.create_organization()
        project = self.create_project(organization=org)

        transactions = ["/api/users"]

        mock_query.side_effect = [
            # Segment with parent
            {
                "data": [
                    {
                        "id": "span1",
                        "parent_span": "parent1",
                        "project.id": project.id,
                        "transaction": "/api/users",
                    }
                ]
            },
            # Parent not found
            {"data": []},
        ]

        with override_options({"explorer.service_map.max_edges": 5000}):
            result = _query_service_dependencies(org.id, transactions)

        # No edges since parent wasn't resolved
        assert len(result) == 0

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_batches_parent_span_queries(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)
        project2 = self.create_project(organization=org)

        # Create 600 different transactions to ensure we get 600 segments
        transactions = [f"/api/endpoint{i}" for i in range(600)]

        # Create 600 segments with different parent spans
        segment_data = [
            {
                "id": f"span{i}",
                "parent_span": f"parent{i}",
                "project.id": project2.id,
                "transaction": f"/api/endpoint{i}",
            }
            for i in range(600)
        ]

        mock_query.side_effect = [
            {"data": segment_data},
            {"data": []},  # First batch of parents
            {"data": []},  # Second batch of parents
        ]

        with override_options({"explorer.service_map.max_edges": 5000}):
            _query_service_dependencies(org.id, transactions)

        # Should be called 3 times: 1 for segments, 2 for parent batches (batch size 500)
        assert mock_query.call_count == 3

    @mock.patch("sentry.tasks.explorer_service_map.Spans.run_table_query")
    def test_stops_after_max_iterations(self, mock_query):
        org = self.create_organization()
        self.create_project(organization=org)

        # Create 150 transactions
        transactions = [f"/api/endpoint{i}" for i in range(150)]

        # Mock always returns empty data to trigger max iterations
        mock_query.return_value = {"data": []}

        with override_options({"explorer.service_map.max_edges": 5000}):
            result = _query_service_dependencies(org.id, transactions)

        # Should stop at max_iterations (10)
        assert mock_query.call_count <= 10
        assert result == []


@django_db_all
class TestClassifyServiceRoles(TestCase):
    def test_returns_empty_for_no_edges(self):
        result = _classify_service_roles([])
        assert result == {}

    def test_classifies_core_backend(self):
        # Service with high in-degree and out-degree
        edges = [
            {"source_project_id": 1, "target_project_id": 2, "count": 10},
            {"source_project_id": 3, "target_project_id": 1, "count": 10},
            {"source_project_id": 1, "target_project_id": 4, "count": 10},
        ]

        result = _classify_service_roles(edges)

        # Project 1 has both incoming and outgoing edges
        assert result[1] == "core_backend"

    def test_classifies_frontend(self):
        # Service with high out-degree, low in-degree
        edges = [
            {"source_project_id": 1, "target_project_id": 2, "count": 10},
            {"source_project_id": 1, "target_project_id": 3, "count": 10},
            {"source_project_id": 2, "target_project_id": 3, "count": 10},
        ]

        result = _classify_service_roles(edges)

        # Project 1 only has outgoing edges
        assert result[1] == "frontend"

    def test_classifies_isolated(self):
        # Service with low connectivity
        edges = [
            {"source_project_id": 1, "target_project_id": 2, "count": 10},
            {"source_project_id": 2, "target_project_id": 3, "count": 10},
        ]

        result = _classify_service_roles(edges)

        # Project 3 only has one incoming edge (below average)
        assert result[3] == "isolated"

    def test_handles_complex_graph(self):
        edges = [
            {"source_project_id": 1, "target_project_id": 2, "count": 10},
            {"source_project_id": 1, "target_project_id": 3, "count": 10},
            {"source_project_id": 2, "target_project_id": 3, "count": 10},
            {"source_project_id": 2, "target_project_id": 4, "count": 10},
            {"source_project_id": 3, "target_project_id": 4, "count": 10},
            {"source_project_id": 3, "target_project_id": 5, "count": 10},
        ]

        result = _classify_service_roles(edges)

        # All projects should be classified
        assert len(result) == 5
        assert all(role in ["core_backend", "frontend", "isolated"] for role in result.values())


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
