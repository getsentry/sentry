"""
Tests for Explorer Service Map Tasks

Tests the service map building, graph analysis, and task execution
for the Explorer service map feature.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest import mock
from uuid import uuid4

import orjson
import pytest

from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.explorer_service_map_utils import (
    _build_nodes,
    _query_service_dependencies,
    _send_to_seer,
)
from sentry.tasks.context_engine_index import build_service_map
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba


def _make_snuba_params(organization, projects):
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    return SnubaParams(start=start, end=end, projects=projects, organization=organization)


@django_db_all
class TestSendToSeer(TestCase):
    def test_builds_correct_payload(self):
        org = self.create_organization()

        nodes = [
            {
                "project_id": 1,
                "project_slug": "frontend",
                "role": "caller",
                "callers": [],
                "callees": ["api"],
            },
            {
                "project_id": 2,
                "project_slug": "api",
                "role": "callee",
                "callers": ["frontend"],
                "callees": [],
            },
        ]
        edges = [
            {
                "source_project_id": 1,
                "source_project_slug": "frontend",
                "target_project_id": 2,
                "target_project_slug": "api",
                "count": 5,
            }
        ]

        mock_response = mock.MagicMock()
        mock_response.status = 200

        with mock.patch(
            "sentry.seer.explorer.explorer_service_map_utils.make_signed_seer_api_request",
            return_value=mock_response,
        ) as mock_request:
            _send_to_seer(org.id, nodes, edges)

        mock_request.assert_called_once()
        body = orjson.loads(mock_request.call_args[0][2])
        assert body["organization_id"] == org.id
        assert body["nodes"] == nodes
        assert body["edges"] == edges

    def test_filters_nodes_with_missing_slugs(self):
        org = self.create_organization()

        nodes: list[dict[str, Any]] = [
            {
                "project_id": 1,
                "project_slug": "frontend",
                "role": "caller",
                "callers": [],
                "callees": [],
            },
            {
                "project_id": 2,
                "project_slug": None,
                "role": "isolated",
                "callers": [],
                "callees": [],
            },
        ]
        edges: list[dict[str, Any]] = [
            {
                "source_project_id": 1,
                "source_project_slug": "frontend",
                "target_project_id": 3,
                "target_project_slug": None,
                "count": 1,
            },
        ]

        mock_response = mock.MagicMock()
        mock_response.status = 200

        with mock.patch(
            "sentry.seer.explorer.explorer_service_map_utils.make_signed_seer_api_request",
            return_value=mock_response,
        ) as mock_request:
            _send_to_seer(org.id, nodes, edges)

        body = orjson.loads(mock_request.call_args[0][2])
        assert len(body["nodes"]) == 1
        assert body["nodes"][0]["project_slug"] == "frontend"
        assert body["edges"] == []


@django_db_all
class TestBuildServiceMap(TestCase):
    def test_handles_no_projects(self):
        org = self.create_organization()

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.context_engine_index._query_service_dependencies"
            ) as mock_query:
                build_service_map(org.id)

        mock_query.assert_not_called()

    @mock.patch("sentry.tasks.context_engine_index._send_to_seer")
    @mock.patch("sentry.tasks.context_engine_index._query_service_dependencies")
    def test_complete_workflow(self, mock_dependencies, mock_send):
        org = self.create_organization()
        project1 = self.create_project(organization=org)
        project2 = self.create_project(organization=org)

        mock_dependencies.return_value = [
            {
                "source_project_id": project1.id,
                "source_project_slug": project1.slug,
                "target_project_id": project2.id,
                "target_project_slug": project2.slug,
                "count": 10,
            }
        ]

        with override_options({"explorer.context_engine_indexing.enable": True}):
            build_service_map(org.id)

        mock_dependencies.assert_called_once()
        snuba_params = mock_dependencies.call_args[0][0]
        assert isinstance(snuba_params, SnubaParams)
        mock_send.assert_called_once()

    @mock.patch("sentry.tasks.context_engine_index._build_nodes")
    @mock.patch("sentry.tasks.context_engine_index._query_service_dependencies")
    def test_handles_no_nodes(self, mock_dependencies, mock_build_nodes):
        org = self.create_organization()
        self.create_project(organization=org)

        mock_dependencies.return_value = []
        mock_build_nodes.return_value = []

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch("sentry.tasks.context_engine_index._send_to_seer") as mock_send:
                build_service_map(org.id)

        mock_send.assert_not_called()

    @mock.patch("sentry.tasks.context_engine_index._query_service_dependencies")
    def test_handles_exception(self, mock_dependencies):
        org = self.create_organization()

        mock_dependencies.side_effect = Exception("Test error")

        with override_options({"explorer.context_engine_indexing.enable": True}):
            build_service_map(org.id)


@django_db_all
class TestQueryServiceDependenciesPhase2(TestCase):
    """Unit tests for Phase 2 fallback scan for uncovered projects"""

    @mock.patch("sentry.seer.explorer.explorer_service_map_utils.Spans.run_table_query")
    def test_phase2_triggered_for_uncovered_projects(self, mock_query):
        org = self.create_organization()
        project_covered = self.create_project(organization=org)
        project_uncovered = self.create_project(organization=org)
        snuba_params = _make_snuba_params(org, [project_covered, project_uncovered])

        # Phase 1: only covered project appears
        phase1_data = [
            {
                "id": "aaa111aaa111aaa1",
                "parent_span": "bbb222bbb222bbb2",
                "project.id": project_covered.id,
                "project.slug": project_covered.slug,
            }
        ]
        # Phase 2 returns empty
        phase2_data: list[dict] = []
        # Phase 3 parent resolution returns empty
        phase3_data: list[dict] = []

        mock_query.side_effect = [
            {"data": phase1_data},
            {"data": phase2_data},
            {"data": phase3_data},
        ]

        _query_service_dependencies(snuba_params)

        assert mock_query.call_count == 3

        # Phase 2 call is the second call
        phase2_call_kwargs = mock_query.call_args_list[1][1]
        phase2_params = phase2_call_kwargs["params"]
        assert project_uncovered in phase2_params.projects
        assert project_covered not in phase2_params.projects

        # Phase 2 must NOT use has:parent_span
        assert "has:parent_span" not in phase2_call_kwargs["query_string"]

    @mock.patch("sentry.seer.explorer.explorer_service_map_utils.Spans.run_table_query")
    def test_phase2_not_triggered_when_all_projects_covered(self, mock_query):
        org = self.create_organization()
        project = self.create_project(organization=org)
        snuba_params = _make_snuba_params(org, [project])

        # Phase 1: covers the only project
        phase1_data = [
            {
                "id": "aaa111aaa111aaa1",
                "parent_span": "bbb222bbb222bbb2",
                "project.id": project.id,
                "project.slug": project.slug,
            }
        ]
        # Phase 3 parent resolution returns empty
        phase3_data: list[dict] = []

        mock_query.side_effect = [
            {"data": phase1_data},
            {"data": phase3_data},
        ]

        _query_service_dependencies(snuba_params)

        # Phase 1 + Phase 3 only — no Phase 2
        assert mock_query.call_count == 2

        # Second call is Phase 3: query is span ID filter, not a transaction scan
        phase3_call_kwargs = mock_query.call_args_list[1][1]
        assert "is_transaction" not in phase3_call_kwargs["query_string"]

    @mock.patch("sentry.seer.explorer.explorer_service_map_utils.Spans.run_table_query")
    def test_phase1_uses_has_parent_span_filter(self, mock_query):
        org = self.create_organization()
        project = self.create_project(organization=org)
        snuba_params = _make_snuba_params(org, [project])

        mock_query.return_value = {"data": []}

        _query_service_dependencies(snuba_params)

        phase1_call_kwargs = mock_query.call_args_list[0][1]
        assert "has:parent_span" in phase1_call_kwargs["query_string"]
        assert "is_transaction:true" in phase1_call_kwargs["query_string"]


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

    def _snuba_params(self):
        projects = list(self.organization.project_set.all())
        return _make_snuba_params(self.organization, projects)

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
        edges = _query_service_dependencies(self._snuba_params())

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

        edges = _query_service_dependencies(self._snuba_params())

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

        edges = _query_service_dependencies(self._snuba_params())

        # Verify no edges (same-project filtered)
        assert len(edges) == 0

    def test_aggregates_duplicate_edges(self):
        """Test that duplicate A→B edges are aggregated with count"""

        # Setup projects
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")

        spans = []

        # Create 3 separate traces with frontend→api pattern using different parent span IDs
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

        edges = _query_service_dependencies(self._snuba_params())

        # Verify single edge with count=3 (aggregated across different parent spans)
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

        edges = _query_service_dependencies(self._snuba_params())

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

        edges = _query_service_dependencies(self._snuba_params())

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

        edges = _query_service_dependencies(self._snuba_params())

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

    def _snuba_params(self):
        projects = list(self.organization.project_set.all())
        return _make_snuba_params(self.organization, projects)

    def test_caller_classification(self):
        """Test classification of caller service (high out-degree, low in-degree)"""

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

        projects = list(self.organization.project_set.all())
        edges = _query_service_dependencies(self._snuba_params())
        nodes = _build_nodes(edges, projects)
        roles = {n["project_id"]: n["role"] for n in nodes}

        # Frontend should be classified as caller (only outgoing edges)
        assert roles[project_frontend.id] == "caller"

    def test_hub_classification(self):
        """Test classification of hub service (high in-degree and out-degree)"""

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

        projects = list(self.organization.project_set.all())
        edges = _query_service_dependencies(self._snuba_params())
        nodes = _build_nodes(edges, projects)
        roles = {n["project_id"]: n["role"] for n in nodes}

        # API should be hub (both incoming and outgoing edges)
        assert roles[project_api.id] == "hub"

    def test_peripheral_classification(self):
        """Test classification of peripheral service (low connectivity in both directions)

        To produce a peripheral node we need avg degree > 1, which requires more edges
        than nodes. Graph: svc_a→svc_b, svc_b→svc_a, svc_a→svc_c, svc_b→svc_c,
        peripheral→svc_a (5 edges, 4 nodes, avg=1.25).

        Resulting degrees:
          svc_a:    out=2, in=2  → hub
          svc_b:    out=2, in=1  → caller
          svc_c:    out=0, in=2  → callee
          peripheral: out=1, in=0 → peripheral (both < 1.25)
        """
        project_a = self.create_project(organization=self.organization, slug="svc-a")
        project_b = self.create_project(organization=self.organization, slug="svc-b")
        project_c = self.create_project(organization=self.organization, slug="svc-c")
        project_p = self.create_project(organization=self.organization, slug="peripheral")

        start_ts = self.ten_mins_ago
        spans = []

        # Each tuple is (source_project, source_tx, target_project, target_tx)
        edges = [
            (project_a, "/a/calls-b", project_b, "/b/from-a"),
            (project_b, "/b/calls-a", project_a, "/a/from-b"),
            (project_a, "/a/calls-c", project_c, "/c/from-a"),
            (project_b, "/b/calls-c", project_c, "/c/from-b"),
            (project_p, "/p/calls-a", project_a, "/a/from-p"),
        ]

        for src_proj, src_tx, tgt_proj, tgt_tx in edges:
            trace_id = uuid4().hex
            src_span_id = uuid4().hex[:16]
            spans.extend(
                [
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": src_span_id,
                            "parent_span_id": "0000000000000000",
                            "is_segment": True,
                            "sentry_tags": {"transaction": src_tx},
                        },
                        project=src_proj,
                        start_ts=start_ts,
                        duration=2000,
                    ),
                    self.create_span(
                        extra_data={
                            "trace_id": trace_id,
                            "span_id": uuid4().hex[:16],
                            "parent_span_id": src_span_id,
                            "is_segment": True,
                            "sentry_tags": {"transaction": tgt_tx},
                        },
                        project=tgt_proj,
                        start_ts=start_ts,
                        duration=1000,
                    ),
                ]
            )

        self.store_spans(spans)

        projects = list(self.organization.project_set.all())
        detected_edges = _query_service_dependencies(self._snuba_params())
        nodes = _build_nodes(detected_edges, projects)
        roles = {n["project_id"]: n["role"] for n in nodes}

        assert roles[project_p.id] == "peripheral"


@pytest.mark.django_db(databases="__all__")
@pytest.mark.snuba
@requires_snuba
class TestBuildServiceMapIntegration(SnubaTestCase, SpanTestCase):
    """End-to-end integration tests for the complete service map pipeline"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        self.ten_mins_ago = before_now(minutes=10)
        yield

    def test_complete_workflow_realistic_topology(self):
        """Test complete workflow with realistic multi-service topology"""

        # Setup realistic topology: frontend → api → [database, cache]
        project_frontend = self.create_project(organization=self.organization, slug="frontend")
        project_api = self.create_project(organization=self.organization, slug="api")
        project_db = self.create_project(organization=self.organization, slug="database")
        project_cache = self.create_project(organization=self.organization, slug="cache")

        start_ts = self.ten_mins_ago
        spans = []

        # Create frontend → api traces (3 traces with unique parent span IDs)
        for i in range(3):
            trace_id = uuid4().hex
            frontend_span_id = uuid4().hex[:16]
            api_tx = f"/api/endpoint{i}"  # Unique transaction name

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

        # Create api → database traces (2 traces with unique parent span IDs)
        for i in range(2):
            trace_id = uuid4().hex
            api_span_id = uuid4().hex[:16]
            api_db_tx = f"/api/db-endpoint{i}"  # Unique transaction name
            db_tx = f"/db/query{i}"

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

        with mock.patch("sentry.tasks.context_engine_index._send_to_seer") as mock_send:
            with override_options(
                {
                    "explorer.context_engine_indexing.enable": True,
                    "explorer.service_map.max_edges": 5000,
                }
            ):
                build_service_map(self.organization.id)

        mock_send.assert_called_once()
        _, nodes, edges = mock_send.call_args[0]

        node_by_slug = {n["project_slug"]: n for n in nodes}

        # Verify all 4 services are present
        assert set(node_by_slug.keys()) == {"frontend", "api", "database", "cache"}

        # Verify edges are present and well-formed
        assert len(edges) > 0
        for edge in edges:
            assert "source_project_id" in edge
            assert "source_project_slug" in edge
            assert "target_project_id" in edge
            assert "target_project_slug" in edge
            assert "count" in edge

        # Verify caller/callee relationships
        assert node_by_slug["frontend"]["callees"] == ["api"]
        assert node_by_slug["frontend"]["callers"] == []

        assert "frontend" in node_by_slug["api"]["callers"]
        assert set(node_by_slug["api"]["callees"]) == {"cache", "database"}

        assert node_by_slug["database"]["callers"] == ["api"]
        assert node_by_slug["database"]["callees"] == []

        assert node_by_slug["cache"]["callers"] == ["api"]
        assert node_by_slug["cache"]["callees"] == []

        # Verify roles are present
        assert node_by_slug["frontend"]["role"] in {"hub", "caller", "callee", "peripheral"}
        assert node_by_slug["api"]["role"] in {"hub", "caller", "callee", "peripheral"}

        # Verify node format has required fields
        for node in nodes:
            assert "project_id" in node
            assert "project_slug" in node
            assert "role" in node
            assert "callers" in node
            assert "callees" in node
