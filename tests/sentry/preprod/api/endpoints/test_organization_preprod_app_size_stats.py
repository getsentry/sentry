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

    def test_get_with_include_filters(self) -> None:
        """Test that response includes available filter values."""
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(minutes=10)

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now,
            app_id="com.test.app",
            git_head_ref="main",
            build_configuration_name="Release",
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project.id],
                "includeFilters": "true",
                "start": str(int(start.timestamp())),
                "end": str(int((now + timedelta(minutes=1)).timestamp())),
            },
        )

        assert response.status_code == 200
        assert "filters" in response.data
        assert "app_ids" in response.data["filters"]
        assert "branches" in response.data["filters"]
        assert "build_configs" in response.data["filters"]
        assert isinstance(response.data["filters"]["app_ids"], list)
        assert isinstance(response.data["filters"]["branches"], list)
        assert isinstance(response.data["filters"]["build_configs"], list)
        assert "com.test.app" in response.data["filters"]["app_ids"]
        assert "main" in response.data["filters"]["branches"]
        assert "Release" in response.data["filters"]["build_configs"]

    def test_get_invalid_field(self) -> None:
        """Test validation of field format."""
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"field": "invalid_field"},
        )
        assert "Invalid field format" in str(response.data)

    def test_get_requires_authentication(self) -> None:
        """Test that endpoint requires authentication."""
        client = APIClient()
        response = client.get(self.url)
        assert response.status_code == 401

    def test_cannot_access_other_organization_projects(self) -> None:
        """Test that users cannot access projects from other organizations (IDOR protection)."""
        other_org = self.create_organization(name="Other Org")
        other_project = self.create_project(organization=other_org, name="Other Project")

        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": [other_project.id]},
        )

        assert response.status_code == 403

    def test_get_with_project_filter(self) -> None:
        """Test filtering by project ID actually filters the data."""
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        project1 = self.create_project(organization=self.organization, name="Project 1")
        project2 = self.create_project(organization=self.organization, name="Project 2")

        self.store_preprod_size_metric(
            project_id=project1.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.project1.app",
            max_install_size=100000,
        )

        self.store_preprod_size_metric(
            project_id=project2.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=2,
            size_metric_id=2,
            app_id="com.project2.app",
            max_install_size=200000,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project1.id],
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "includeFilters": "true",
            },
        )

        assert response.status_code == 200
        app_ids = response.data["filters"]["app_ids"]
        assert "com.project1.app" in app_ids
        assert "com.project2.app" not in app_ids

    def test_aggregate_functions(self) -> None:
        """Test that all supported aggregate functions work."""
        for func in ["max", "min", "avg", "count"]:
            with self.subTest(func=func):
                response = self.get_success_response(
                    self.organization.slug,
                    qs_params={"field": f"{func}(max_install_size)"},
                )
                assert response.status_code == 200
                assert f"{func}(max_install_size)" in response.data["meta"]["fields"]

    def test_get_with_data(self) -> None:
        """Test querying actual data written to EAP."""
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(hours=2)

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(hours=1),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.example.app",
            max_install_size=100000,
            min_install_size=95000,
        )

        self.store_preprod_size_metric(
            project_id=project.id,
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
                "project": [project.id],
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "interval": "1h",
                "field": "max(max_install_size)",
            },
        )

        assert response.status_code == 200
        assert "data" in response.data
        data_points = response.data["data"]
        assert len(data_points) > 0

        non_null_values = [d[1][0]["count"] for d in data_points if d[1][0]["count"] is not None]
        assert len(non_null_values) > 0
        assert max(non_null_values) == 105000

    def test_aggregation_data(self) -> None:
        """Test different aggregation functions with real data."""
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        for i, size in enumerate([100000, 150000, 125000]):
            self.store_preprod_size_metric(
                project_id=project.id,
                organization_id=self.organization.id,
                timestamp=now - timedelta(minutes=30),
                preprod_artifact_id=i + 1,
                size_metric_id=i + 1,
                max_install_size=size,
            )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project.id],
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

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project.id],
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
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.example.app1",
            max_install_size=100000,
        )

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=2,
            size_metric_id=2,
            app_id="com.example.app2",
            max_install_size=200000,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project.id],
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "app_id": "com.example.app1",
                "field": "max(max_install_size)",
            },
        )

        data_points = [
            d[1][0]["count"] for d in response.data["data"] if d[1][0]["count"] is not None
        ]
        # Should only get app1's data
        assert len(data_points) > 0
        assert max(data_points) == 100000

    def test_multiple_filters(self) -> None:
        """Test combining multiple filter parameters."""
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(hours=1)

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=1,
            size_metric_id=1,
            app_id="com.example.app",
            git_head_ref="main",
            build_configuration_name="Release",
            artifact_type=0,
            max_install_size=100000,
        )

        self.store_preprod_size_metric(
            project_id=project.id,
            organization_id=self.organization.id,
            timestamp=now - timedelta(minutes=30),
            preprod_artifact_id=2,
            size_metric_id=2,
            app_id="com.example.app",
            git_head_ref="develop",
            build_configuration_name="Debug",
            artifact_type=1,
            max_install_size=200000,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [project.id],
                "start": str(int(start.timestamp())),
                "end": str(int(now.timestamp())),
                "app_id": "com.example.app",
                "git_head_ref": "main",
                "build_configuration_name": "Release",
                "artifact_type": "0",
                "field": "max(max_install_size)",
            },
        )

        data_points = [
            d[1][0]["count"] for d in response.data["data"] if d[1][0]["count"] is not None
        ]
        assert len(data_points) > 0
        assert max(data_points) == 100000

    def test_branch_sorting_priority(self) -> None:
        """Test that main and master branches are prioritized in the list."""
        project = self.create_project(organization=self.organization)
        now = before_now(minutes=5)
        start = now - timedelta(minutes=10)

        for idx, branch in enumerate(["feature/test", "main", "develop", "master", "release/1.0"]):
            self.store_preprod_size_metric(
                project_id=project.id,
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
                "project": [project.id],
                "includeFilters": "true",
                "start": str(int(start.timestamp())),
                "end": str(int((now + timedelta(minutes=1)).timestamp())),
            },
        )

        branches = response.data["filters"]["branches"]

        # Verify main is first, master is second
        assert branches[0] == "main"
        assert branches[1] == "master"
        remaining = branches[2:]
        assert remaining == sorted(remaining, key=str.lower)
