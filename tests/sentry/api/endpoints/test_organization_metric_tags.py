import time
from unittest.mock import patch

from sentry.sentry_metrics import indexer
from sentry.snuba.metrics.naming_layer import get_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase
from tests.sentry.api.endpoints.test_organization_metrics import (
    MOCKED_DERIVED_METRICS,
    mocked_mri_resolver,
)


class OrganizationMetricsTagsIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-tags"

    @patch(
        "sentry.snuba.metrics.datasource.get_mri",
        mocked_mri_resolver(["metric1", "metric2", "metric3"], get_mri),
    )
    def test_metric_tags(self):
        response = self.get_success_response(
            self.organization.slug,
        )
        assert response.data == [
            {"key": "tag1"},
            {"key": "tag2"},
            {"key": "tag3"},
            {"key": "tag4"},
        ]

        # When metric names are supplied, get intersection of tag names:
        response = self.get_success_response(
            self.organization.slug,
            metric=["metric1", "metric2"],
        )
        assert response.data == [
            {"key": "tag1"},
            {"key": "tag2"},
        ]

        response = self.get_success_response(
            self.organization.slug,
            metric=["metric1", "metric2", "metric3"],
        )
        assert response.data == []

    def test_session_metric_tags(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
            )
        )
        response = self.get_success_response(
            self.organization.slug,
        )
        assert response.data == [
            {"key": "environment"},
            {"key": "release"},
            {"key": "tag1"},
            {"key": "tag2"},
            {"key": "tag3"},
            {"key": "tag4"},
        ]

    def test_metric_tags_metric_does_not_exist_in_naming_layer(self):
        response = self.get_response(
            self.organization.slug,
            metric=["foo.bar"],
        )
        assert response.data == []

    def test_metric_tags_metric_does_not_have_data(self):
        indexer.record(self.organization.id, SessionMRI.SESSION.value)
        assert (
            self.get_response(
                self.organization.slug,
                metric=[SessionMetricKey.CRASH_FREE_RATE.value],
            ).data
            == []
        )

    def test_derived_metric_tags(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
            )
        )
        response = self.get_success_response(
            self.organization.slug,
            metric=["session.crash_free_rate"],
        )
        assert response.data == [
            {"key": "environment"},
            {"key": "release"},
        ]

        response = self.get_success_response(
            self.organization.slug,
            metric=[
                SessionMetricKey.CRASH_FREE_RATE.value,
                SessionMetricKey.ALL.value,
            ],
        )
        assert response.data == [
            {"key": "environment"},
            {"key": "release"},
        ]

    def test_composite_derived_metrics(self):
        for minute in range(4):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                    release="foobar@2.0",
                    errors=2,
                )
            )
        response = self.get_success_response(
            self.organization.slug,
            metric=[SessionMetricKey.HEALTHY.value],
        )
        assert response.data == [
            {"key": "environment"},
            {"key": "release"},
        ]

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.datasource.get_mri")
    @patch("sentry.snuba.metrics.datasource.get_derived_metrics")
    def test_incorrectly_setup_derived_metric(self, mocked_derived_metrics, mocked_mri):
        mocked_mri.return_value = "crash_free_fake"
        mocked_derived_metrics.return_value = MOCKED_DERIVED_METRICS
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            metric=["crash_free_fake"],
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "The following metrics {'crash_free_fake'} cannot be computed from single entities. "
            "Please revise the definition of these singular entity derived metrics"
        )
