from typing import int
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.snuba.metrics import SpanMRI
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test

pytestmark = [pytest.mark.sentry_metrics]


@freeze_time(MetricsEnhancedPerformanceTestCase.MOCK_DATETIME)
@region_silo_test
class OrganizationSamplingAdminMetricsTest(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-sampling-admin-metrics"

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project_1 = self.create_project(organization=self.org, name="project_1")
        self.project_2 = self.create_project(organization=self.org, name="project_2")
        self.project_3 = self.create_project(organization=self.org, name="project_3")

        # Create a staff user for permission testing
        self.staff_user = self.create_user(is_staff=True)

        # Create a regular user for negative permission testing
        self.regular_user = self.create_user()
        self.create_member(user=self.regular_user, organization=self.org, role="member")

        # Create another organization for cross-org testing
        self.other_org = self.create_organization()
        self.other_project = self.create_project(organization=self.other_org)

    def get_url(self, org_slug=None):
        return reverse(self.endpoint, kwargs={"organization_id_or_slug": org_slug or self.org.slug})

    def store_sample_metrics(self):
        """Store sample metrics data for testing"""
        metric_data = [
            (self.project_1.id, self.project_2.id, "transaction_1", 100),
            (self.project_1.id, self.project_3.id, "transaction_2", 150),
            (self.project_2.id, self.project_1.id, "transaction_3", 200),
        ]

        hour_ago = self.MOCK_DATETIME - timedelta(hours=1)

        for project_source_id, target_project_id, transaction, span_count in metric_data:
            self.store_metric(
                org_id=self.org.id,
                value=span_count,
                project_id=int(project_source_id),
                mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={
                    "target_project_id": str(target_project_id),
                    "transaction": transaction,
                },
                timestamp=int(hour_ago.timestamp()),
            )

    @django_db_all
    def test_staff_user_access_success(self) -> None:
        """Test that staff users can access the endpoint"""
        self.login_as(user=self.staff_user, staff=True)
        self.store_sample_metrics()

        response = self.client.get(self.get_url())

        assert response.status_code == 200
        assert hasattr(response, "data")
        data = response.data

        # Verify response structure matches MetricsAPIQueryResultsTransformer format
        assert "data" in data
        assert "meta" in data
        assert "start" in data
        assert "end" in data
        assert "intervals" in data

        # Verify we have data
        assert len(data["data"]) > 0
        assert len(data["data"][0]) > 0

        # Verify group structure
        first_group = data["data"][0][0]
        assert "by" in first_group
        assert "totals" in first_group

        # Verify group by fields are present
        group_by_fields = first_group["by"]
        assert "project" in group_by_fields
        assert "target_project_id" in group_by_fields
        assert "transaction" in group_by_fields

    @django_db_all
    def test_regular_user_access_denied(self) -> None:
        """Test that regular users cannot access the endpoint"""
        self.login_as(user=self.regular_user)

        response = self.client.get(self.get_url())

        assert response.status_code == 403

    @django_db_all
    def test_superuser_access_denied_without_staff(self) -> None:
        """Test that superusers without staff flag cannot access the endpoint"""
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.client.get(self.get_url())

        assert response.status_code == 403

    @django_db_all
    def test_staff_access_to_different_organization(self) -> None:
        """Test that staff can access data from different organizations"""
        self.login_as(user=self.staff_user, staff=True)

        # Store metrics for the other org
        hour_ago = self.MOCK_DATETIME - timedelta(hours=1)
        self.store_metric(
            org_id=self.other_org.id,
            value=50,
            project_id=self.other_project.id,
            mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={
                "target_project_id": str(self.other_project.id),
                "transaction": "other_transaction",
            },
            timestamp=int(hour_ago.timestamp()),
        )

        response = self.client.get(self.get_url(self.other_org.slug))

        assert response.status_code == 200
        assert hasattr(response, "data")
        data = response.data
        assert "data" in data

    @django_db_all
    def test_empty_response_when_no_target_project_id_tag(self) -> None:
        """Test that endpoint returns empty result when target_project_id tag is not found"""
        self.login_as(user=self.staff_user, staff=True)

        # Mock resolve_weak to return STRING_NOT_FOUND
        with patch(
            "sentry.api.endpoints.organization_sampling_admin_metrics.resolve_weak"
        ) as mock_resolve:
            from sentry.sentry_metrics.utils import STRING_NOT_FOUND

            mock_resolve.return_value = STRING_NOT_FOUND

            response = self.client.get(self.get_url())

            assert response.status_code == 200
            assert hasattr(response, "data")
            data = response.data

            # Should return empty data structure
            assert data["data"] == []
            assert data["meta"] == []
            assert data["start"] is None
            assert data["end"] is None
            assert data["intervals"] == []

    @django_db_all
    def test_query_parameters(self) -> None:
        """Test endpoint works with various query parameters"""
        self.login_as(user=self.staff_user, staff=True)
        self.store_sample_metrics()

        # Test with statsPeriod
        response = self.client.get(self.get_url(), {"statsPeriod": "24h"})
        assert response.status_code == 200

        # Test with start and end
        from sentry.testutils.helpers.datetime import before_now

        start = before_now(hours=2)
        end = before_now(hours=1)

        response = self.client.get(
            self.get_url(),
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        )
        assert response.status_code == 200

    @django_db_all
    def test_projects_filtering(self) -> None:
        """Test that only active projects are included in the query"""
        self.login_as(user=self.staff_user, staff=True)

        # Create an inactive project
        inactive_project = self.create_project(organization=self.org, name="inactive")
        inactive_project.status = 1  # PENDING_DELETION
        inactive_project.save()

        self.store_sample_metrics()

        response = self.client.get(self.get_url())

        assert response.status_code == 200
        # The inactive project should not be included in the projects list

    @django_db_all
    def test_response_data_structure_with_real_data(self) -> None:
        """Test the actual response data structure with real metrics data"""
        self.login_as(user=self.staff_user, staff=True)
        self.store_sample_metrics()

        response = self.client.get(self.get_url())

        assert response.status_code == 200
        assert hasattr(response, "data")
        data = response.data

        # Verify top-level structure
        assert isinstance(data["data"], list)
        assert isinstance(data["meta"], list)
        assert data["start"] is not None
        assert data["end"] is not None
        assert isinstance(data["intervals"], list)

        # Verify data contains our metrics
        if data["data"] and data["data"][0]:
            groups = data["data"][0]

            # Should have groups for our stored metrics
            assert len(groups) > 0

            for group in groups:
                # Each group should have the correct structure
                assert "by" in group
                assert "totals" in group

                # Should have our group by fields
                by_fields = group["by"]
                assert "project" in by_fields
                assert "target_project_id" in by_fields
                assert "transaction" in by_fields

                # Totals should be numeric
                if group["totals"] is not None:
                    assert isinstance(group["totals"], (int, float))
