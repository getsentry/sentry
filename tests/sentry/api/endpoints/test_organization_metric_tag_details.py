import time
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import get_mri
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from tests.sentry.api.endpoints.test_organization_metrics import (
    MOCKED_DERIVED_METRICS,
    mocked_mri_resolver,
)

pytestmark = pytest.mark.sentry_metrics


def _indexer_record(org_id: int, string: str) -> None:
    indexer.record(use_case_id=UseCaseID.SESSIONS, org_id=org_id, string=string)


@region_silo_test
class OrganizationMetricsTagDetailsIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-tag-details"

    def test_unknown_tag(self):
        _indexer_record(self.organization.id, "bar")
        response = self.get_success_response(self.project.organization.slug, "bar")
        assert response.data == []

    def test_non_existing_tag(self):
        response = self.get_response(self.project.organization.slug, "bar")
        assert response.status_code == 400

    @patch("sentry.snuba.metrics.datasource.get_mri", mocked_mri_resolver(["bad"], get_mri))
    def test_non_existing_filter(self):
        _indexer_record(self.organization.id, "bar")
        response = self.get_response(self.project.organization.slug, "bar", metric="bad")
        assert response.status_code == 200
        assert response.data == []

    @patch(
        "sentry.snuba.metrics.datasource.get_mri",
        mocked_mri_resolver(["metric1", "metric2", "metric3", "random_tag"], get_mri),
    )
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
        _indexer_record(self.organization.id, "random_tag")
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1", "random_tag"],
        )
        assert response.data == []

    def test_tag_values_for_session_status_tag(self):
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
            "session.status",
        )
        assert response.data["detail"] == "Tag name session.status is an unallowed tag"

    @freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=30))
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
            metric=[
                SessionMetricKey.CRASH_FREE_RATE.value,
                SessionMetricKey.ALL.value,
            ],
        )
        assert response.data == [{"key": "release", "value": "foobar"}]

    def test_metric_not_in_naming_layer(self):
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
            "release",
            metric=["session.abnormal_and_crashed"],
        )
        assert response.data == []

    @freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=30))
    def test_tag_values_for_composite_derived_metrics(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
                errors=2,
            )
        )
        response = self.get_success_response(
            self.organization.slug,
            "release",
            metric=[SessionMetricKey.HEALTHY.value],
        )
        assert response.data == [{"key": "release", "value": "foobar@2.0"}]

    def test_tag_not_available_in_the_indexer(self):
        response = self.get_response(
            self.organization.slug,
            "random_foo_tag",
            metric=[SessionMetricKey.HEALTHY.value],
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Tag random_foo_tag is not available in the indexer"

    @freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=30))
    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.datasource.get_mri")
    @patch("sentry.snuba.metrics.datasource.get_derived_metrics")
    def test_incorrectly_setup_derived_metric(self, mocked_derived_metrics, mocked_mri):
        mocked_derived_metrics.return_value = MOCKED_DERIVED_METRICS
        mocked_mri.return_value = "crash_free_fake"
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
