from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import requests
from django.conf import settings
from django.urls import reverse
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.test import APIClient
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.preprod.eap.constants import PREPROD_NAMESPACE
from sentry.search.eap.rpc_utils import anyvalue
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.eap import EAP_ITEMS_INSERT_ENDPOINT


class OrganizationPreprodAppSizeStatsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-app-size-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug}
        )

    def store_preprod_size_metric(
        self,
        project_id: int,
        organization_id: int,
        timestamp: datetime,
        preprod_artifact_id: int = 1,
        size_metric_id: int = 1,
        app_id: str = "com.example.app",
        artifact_type: int = 0,
        max_install_size: int = 100000,
        max_download_size: int = 80000,
        min_install_size: int = 95000,
        min_download_size: int = 75000,
        git_head_ref: str | None = None,
        build_configuration_name: str | None = None,
    ) -> None:
        """Write a preprod size metric to EAP for testing."""
        proto_timestamp = Timestamp()
        proto_timestamp.FromDatetime(timestamp)

        trace_id = uuid.uuid5(PREPROD_NAMESPACE, str(preprod_artifact_id)).hex
        item_id_str = f"size_metric_{size_metric_id}"
        item_id = int(uuid.uuid5(PREPROD_NAMESPACE, item_id_str).hex, 16).to_bytes(16, "little")

        attributes = {
            "preprod_artifact_id": anyvalue(preprod_artifact_id),
            "size_metric_id": anyvalue(size_metric_id),
            "sub_item_type": anyvalue("size_metric"),
            "metrics_artifact_type": anyvalue(0),
            "identifier": anyvalue(""),
            "min_install_size": anyvalue(min_install_size),
            "max_install_size": anyvalue(max_install_size),
            "min_download_size": anyvalue(min_download_size),
            "max_download_size": anyvalue(max_download_size),
            "artifact_type": anyvalue(artifact_type),
            "app_id": anyvalue(app_id),
        }

        if git_head_ref:
            attributes["git_head_ref"] = anyvalue(git_head_ref)
        if build_configuration_name:
            attributes["build_configuration_name"] = anyvalue(build_configuration_name)

        trace_item = TraceItem(
            organization_id=organization_id,
            project_id=project_id,
            item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
            timestamp=proto_timestamp,
            trace_id=trace_id,
            item_id=item_id,
            received=proto_timestamp,
            retention_days=90,
            attributes=attributes,
        )

        response = requests.post(
            settings.SENTRY_SNUBA + EAP_ITEMS_INSERT_ENDPOINT,
            files={"item_0": trace_item.SerializeToString()},
        )
        assert response.status_code == 200

    def test_get_with_defaults(self) -> None:
        """Test GET with default parameters returns proper structure."""
        response = self.get_success_response(self.organization.slug)

        assert "data" in response.data
        assert "start" in response.data
        assert "end" in response.data
        assert "meta" in response.data
        assert isinstance(response.data["data"], list)

    def test_get_with_start_and_end(self) -> None:
        """Test explicit time range parameters."""
        start = datetime(2024, 1, 1, 0, 0, 0)
        end = datetime(2024, 1, 2, 0, 0, 0)

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "start": str(int(start.timestamp())),
                "end": str(int(end.timestamp())),
            },
        )

        assert response.data["start"] == int(start.timestamp())
        assert response.data["end"] == int(end.timestamp())

    def test_get_with_stats_period(self) -> None:
        """Test relative time period (7d, 24h, etc.)."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"statsPeriod": "7d"},
        )

        assert "data" in response.data
        # Verify that end - start is approximately 7 days
        duration = response.data["end"] - response.data["start"]
        assert 6 * 86400 < duration < 8 * 86400

    def test_get_with_interval(self) -> None:
        """Test different time intervals."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"interval": "1h"},
        )

        assert response.status_code == 200

    def test_get_with_field(self) -> None:
        """Test different aggregate fields."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"field": "max(max_download_size)"},
        )

        assert response.data["meta"]["fields"]["max(max_download_size)"] == "integer"

    def test_get_with_query_filter(self) -> None:
        """Test query string filters (app_id, artifact_type, etc.)."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "app_id:com.example.app artifact_type:0"},
        )

        assert response.status_code == 200

    def test_get_with_include_filters(self) -> None:
        """Test that response includes available filter values."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"includeFilters": "true"},
        )

        assert "filters" in response.data
        assert "app_ids" in response.data["filters"]
        assert "branches" in response.data["filters"]
        assert "build_configs" in response.data["filters"]
        assert isinstance(response.data["filters"]["app_ids"], list)
        assert isinstance(response.data["filters"]["branches"], list)
        assert isinstance(response.data["filters"]["build_configs"], list)

    def test_get_invalid_field(self) -> None:
        """Test validation of field format."""
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"field": "invalid_field"},
        )
        assert "Invalid field format" in str(response.data)

    def test_get_invalid_aggregate_function(self) -> None:
        """Test validation of aggregate function."""
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"field": "median(max_install_size)"},
        )
        assert "Unsupported aggregate function" in str(response.data)

    def test_get_invalid_field_name(self) -> None:
        """Test validation of field name."""
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"field": "max(invalid_field)"},
        )
        assert "Invalid field" in str(response.data)

    def test_get_empty_field_name(self) -> None:
        """Test that empty field names are rejected."""
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"field": "count()"},
        )
        assert "Field name is required" in str(response.data)

    def test_get_requires_authentication(self) -> None:
        """Test that endpoint requires authentication."""
        client = APIClient()
        response = client.get(self.url)
        assert response.status_code == 401

    def test_cannot_access_other_organization_projects(self) -> None:
        """Test that users cannot access projects from other organizations (IDOR protection)."""
        # Create a second organization with a project that user doesn't have access to
        other_org = self.create_organization(name="Other Org")
        other_project = self.create_project(organization=other_org, name="Other Project")

        # Try to query our organization's endpoint with the other org's project ID
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": [other_project.id]},
        )

        # Should return 403 Forbidden since user doesn't have permission to access other_project
        # This validates that get_projects() properly validates project ownership
        assert response.status_code == 403
        assert "permission" in str(response.data).lower()

    def test_get_with_project_filter(self) -> None:
        """Test filtering by project ID."""
        project = self.create_project(organization=self.organization)

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": [project.id]},
        )

        assert response.status_code == 200

    def test_empty_response_structure(self) -> None:
        """Test response structure when no data exists."""
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"statsPeriod": "1d", "interval": "1h"},
        )

        # Verify proper response structure with time buckets
        assert len(response.data["data"]) > 0
        # Each time bucket should have structure: [timestamp, [{"count": value}]]
        for timestamp, values in response.data["data"]:
            assert isinstance(timestamp, int)
            assert isinstance(values, list)
            assert len(values) == 1
            assert "count" in values[0]

    def test_query_filter_parsing(self) -> None:
        """Test various query filter combinations."""
        # Test multiple filters
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "app_id:com.example.app artifact_type:0 git_head_ref:main"},
        )
        assert response.status_code == 200

        # Test with build configuration filter
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "build_configuration_name:Release"},
        )
        assert response.status_code == 200

    def test_all_aggregate_functions(self) -> None:
        """Test that all supported aggregate functions work."""
        for func in ["max", "min", "avg", "count"]:
            response = self.get_success_response(
                self.organization.slug,
                qs_params={"field": f"{func}(max_install_size)"},
            )
            assert response.status_code == 200
            assert f"{func}(max_install_size)" in response.data["meta"]["fields"]

    def test_get_with_actual_data(self) -> None:
        """Test querying actual data written to EAP."""
        now = before_now(minutes=5)
        start = now - timedelta(hours=2)

        # Write some test data
        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(hours=1),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.example.app",
            max_install_size=100000,
            min_install_size=95000,
        )

        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=2,
            size_metric_id=2,
            app_id="com.example.app",
            max_install_size=105000,
            min_install_size=98000,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "interval": "1h",
                "field": "max(max_install_size)",
            },
        )

        assert response.status_code == 200
        assert "data" in response.data
        # Verify we have time buckets with data
        data_points = response.data["data"]
        assert len(data_points) > 0

        # Check that at least one bucket has non-None values
        non_null_values = [d[1][0]["count"] for d in data_points if d[1][0]["count"] is not None]
        assert len(non_null_values) > 0
        # Verify the max value is correct
        assert max(non_null_values) == 105000

    def test_aggregation_with_real_data(self) -> None:
        """Test different aggregation functions with real data."""
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        # Write multiple metrics in the same time bucket
        for i, size in enumerate([100000, 150000, 125000]):
            self.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=now - timedelta(minutes=30),
                preprod_artifact_id=i + 1,
                size_metric_id=i + 1,
                max_install_size=size,
            )

        # Test max aggregation
        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "interval": "1h",
                "field": "max(max_install_size)",
            },
        )
        data_points = [
            d[1][0]["count"] for d in response.data["data"] if d[1][0]["count"] is not None
        ]
        assert max(data_points) == 150000

        # Test min aggregation
        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "interval": "1h",
                "field": "min(max_install_size)",
            },
        )
        data_points = [
            d[1][0]["count"] for d in response.data["data"] if d[1][0]["count"] is not None
        ]
        assert min(data_points) == 100000

    def test_filter_by_app_id(self) -> None:
        """Test filtering by app_id."""
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        # Write metrics for different apps
        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.example.app1",
            max_install_size=100000,
        )

        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=2,
            size_metric_id=2,
            app_id="com.example.app2",
            max_install_size=200000,
        )

        # Query for app1 only
        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "query": "app_id:com.example.app1",
                "field": "max(max_install_size)",
            },
        )

        data_points = [
            d[1][0]["count"] for d in response.data["data"] if d[1][0]["count"] is not None
        ]
        # Should only get app1's data
        assert len(data_points) > 0
        assert max(data_points) == 100000

    def test_include_filters_with_real_data(self) -> None:
        """Test that includeFilters returns actual filter values."""
        now = before_now(minutes=5)
        start = now - timedelta(minutes=10)

        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now,
            app_id="com.test.filters.app1",
            git_head_ref="main",
            build_configuration_name="Release",
        )

        self.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=now,
            app_id="com.test.filters.app2",
            git_head_ref="develop",
            build_configuration_name="Debug",
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "includeFilters": "true",
                "start": str(int(start.timestamp())),
                "end": str(int((now + timedelta(minutes=1)).timestamp())),
            },
        )

        assert "filters" in response.data
        app_ids = response.data["filters"]["app_ids"]
        branches = response.data["filters"]["branches"]
        configs = response.data["filters"]["build_configs"]

        assert "com.test.filters.app1" in app_ids
        assert "com.test.filters.app2" in app_ids
        assert "main" in branches
        assert "develop" in branches
        # Verify main comes before develop
        assert branches.index("main") < branches.index("develop")
        assert "Release" in configs
        assert "Debug" in configs

    def test_branch_sorting_priority(self) -> None:
        """Test that main and master branches are prioritized in the list."""
        now = before_now(minutes=5)
        start = now - timedelta(minutes=10)

        # Create metrics with various branch names using different artifact IDs
        # so they're stored as separate records
        for idx, branch in enumerate(["feature/test", "main", "develop", "master", "release/1.0"]):
            self.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=now,
                preprod_artifact_id=100 + idx,
                size_metric_id=100 + idx,
                app_id="com.test.branches",
                git_head_ref=branch,
            )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "includeFilters": "true",
                "start": str(int(start.timestamp())),
                "end": str(int((now + timedelta(minutes=1)).timestamp())),
            },
        )

        branches = response.data["filters"]["branches"]

        # Verify main is first, master is second
        assert branches[0] == "main"
        assert branches[1] == "master"
        # Others should be alphabetically sorted
        remaining = branches[2:]
        assert remaining == sorted(remaining, key=str.lower)
