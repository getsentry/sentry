import time
from unittest.mock import patch

from sentry.sentry_metrics import indexer
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS


class OrganizationMetricsTagDetailsIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-tag-details"

    def test_unknown_tag(self):
        indexer.record("bar")
        response = self.get_success_response(self.project.organization.slug, "bar")
        assert response.data == []

    def test_non_existing_tag(self):
        response = self.get_response(self.project.organization.slug, "bar")
        assert response.status_code == 400

    def test_non_existing_filter(self):
        indexer.record("bar")
        response = self.get_response(self.project.organization.slug, "bar", metric="bad")
        assert response.status_code == 200
        assert response.data == []

    def test_metric_tag_details(self):
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
        )
        assert response.data == [
            {"key": "tag1", "value": "value1"},
            {"key": "tag1", "value": "value2"},
        ]

        # When single metric_name is supplied, get only tag values for that metric:
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1"],
        )
        assert response.data == [
            {"key": "tag1", "value": "value1"},
        ]

        # When metric names are supplied, get intersection of tags:
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1", "metric2"],
        )
        assert response.data == []

        # We need to ensure that if the tag is present in the indexer but has no values in the
        # dataset, the intersection of it and other tags should not yield any results
        indexer.record("random_tag")
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1", "random_tag"],
        )
        assert response.data == []

    def test_tag_values_for_derived_metrics(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            "release",
            metric=["session.crash_free_rate", "session.init"],
        )
        assert response.data == [{"key": "release", "value": "foobar"}]

    def test_tag_not_available_in_the_indexer(self):
        response = self.get_response(
            self.organization.slug,
            "release",
            metric=["random_foo_metric"],
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Tag release is not available in the indexer"

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.datasource.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    def test_incorrectly_setup_derived_metric(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            "release",
            metric=["crash_free_fake"],
        )
        assert response.json()["detail"] == (
            "The following metrics {'crash_free_fake'} cannot be computed from single entities. "
            "Please revise the definition of these singular entity derived metrics"
        )
