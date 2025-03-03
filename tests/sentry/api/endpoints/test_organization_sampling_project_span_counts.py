from datetime import timedelta

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
class OrganizationSamplingProjectSpanCountsTest(MetricsEnhancedPerformanceTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_1 = self.create_project(organization=self.org, name="project_1")
        self.project_2 = self.create_project(organization=self.org, name="project_2")
        self.project_3 = self.create_project(organization=self.org, name="project_3")
        self.project_4 = self.create_project(organization=self.org, name="project_4")
        self.url = reverse(
            "sentry-api-0-organization-sampling-root-counts",
            kwargs={"organization_id_or_slug": self.org.slug},
        )

        metric_data = (
            (self.project_1.id, self.project_2.id, 12),
            (self.project_1.id, self.project_3.id, 13),
            (self.project_2.id, self.project_1.id, 21),
        )

        hour_ago = self.MOCK_DATETIME - timedelta(hours=1)
        days_ago = self.MOCK_DATETIME - timedelta(days=5)
        fifty_days_ago = self.MOCK_DATETIME - timedelta(days=50)

        for project_source_id, target_project_id, span_count in metric_data:
            self.store_metric(
                org_id=self.org.id,
                value=span_count,
                project_id=int(project_source_id),
                mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"target_project_id": str(target_project_id)},
                timestamp=int(hour_ago.timestamp()),
            )
            self.store_metric(
                org_id=self.org.id,
                value=span_count,
                project_id=int(project_source_id),
                mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"target_project_id": str(target_project_id)},
                timestamp=int(days_ago.timestamp()),
            )
            self.store_metric(
                org_id=self.org.id,
                value=span_count,
                project_id=int(project_source_id),
                mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"target_project_id": str(target_project_id)},
                timestamp=int(fifty_days_ago.timestamp()),
            )

    def test_feature_flag_required(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    @django_db_all
    def test_get_span_counts_without_permission(self):
        user = self.create_user()
        self.login_as(user)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.client.get(
                self.url,
                data={"statsPeriod": "24h"},
            )

        assert response.status_code == 403

    @django_db_all
    def test_get_span_counts_with_ingested_data_24h(self):
        """Test span counts endpoint with actual ingested metrics data"""
        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.client.get(
                self.url,
                data={"statsPeriod": "24h"},
            )

        assert response.status_code == 200
        data = response.data  # type: ignore[attr-defined]
        span_counts = sorted(data["data"][0], key=lambda x: x["by"]["target_project_id"])

        assert span_counts[0]["by"]["project"] == self.project_2.name
        assert span_counts[0]["by"]["target_project_id"] == str(self.project_1.id)
        assert span_counts[0]["totals"] == 21.0

        assert span_counts[1]["by"]["project"] == self.project_1.name
        assert span_counts[1]["by"]["target_project_id"] == str(self.project_2.id)
        assert span_counts[1]["totals"] == 12.0

        assert span_counts[2]["by"]["project"] == self.project_1.name
        assert span_counts[2]["by"]["target_project_id"] == str(self.project_3.id)
        assert span_counts[2]["totals"] == 13.0

        assert data["end"] == MetricsEnhancedPerformanceTestCase.MOCK_DATETIME
        assert (data["end"] - data["start"]) == timedelta(days=1)

    @django_db_all
    def test_get_span_counts_with_ingested_data_30d(self):
        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.client.get(
                self.url,
                data={"statsPeriod": "30d"},
            )

        assert response.status_code == 200
        data = response.data  # type: ignore[attr-defined]
        span_counts = sorted(data["data"][0], key=lambda x: x["by"]["target_project_id"])

        assert span_counts[0]["by"]["project"] == self.project_2.name
        assert span_counts[0]["by"]["target_project_id"] == str(self.project_1.id)
        assert span_counts[0]["totals"] == 21.0 * 2

        assert span_counts[1]["by"]["project"] == self.project_1.name
        assert span_counts[1]["by"]["target_project_id"] == str(self.project_2.id)
        assert span_counts[1]["totals"] == 12.0 * 2

        assert span_counts[2]["by"]["project"] == self.project_1.name
        assert span_counts[2]["by"]["target_project_id"] == str(self.project_3.id)
        assert span_counts[2]["totals"] == 13.0 * 2

        assert data["end"] == MetricsEnhancedPerformanceTestCase.MOCK_DATETIME
        assert (data["end"] - data["start"]) == timedelta(days=30)

    @django_db_all
    def test_get_span_counts_with_many_projects(self):
        # Create 200 projects with incrementing span counts
        projects = []
        days_ago = self.MOCK_DATETIME - timedelta(days=5)
        for i in range(200):
            project = self.create_project(organization=self.org, name=f"gen_project_{i}")
            projects.append(project)

            self.store_metric(
                org_id=self.org.id,
                value=i,
                project_id=int(project.id),
                mri=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"target_project_id": str(self.project_1.id)},
                timestamp=int(days_ago.timestamp()),
            )

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.client.get(
                self.url,
                data={"statsPeriod": "30d"},
            )

        assert response.status_code == 200
        data = response.data  # type: ignore[attr-defined]
        span_counts = sorted(data["data"][0], key=lambda x: x["totals"], reverse=True)

        # Verify we get all 200 projects back
        assert len(span_counts) >= 200
