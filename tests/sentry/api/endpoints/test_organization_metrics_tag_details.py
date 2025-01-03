import time

import pytest

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.cases import OrganizationMetricsIntegrationTestCase

pytestmark = pytest.mark.sentry_metrics


def _indexer_record(org_id: int, string: str) -> None:
    indexer.record(use_case_id=UseCaseID.SESSIONS, org_id=org_id, string=string)


class OrganizationMetricsTagDetailsTest(OrganizationMetricsIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-tag-details"

    def test_unknown_tag(self):
        _indexer_record(self.organization.id, "bar")
        response = self.get_response(self.project.organization.slug, "bar")
        assert response.status_code == 404
        assert response.json()["detail"] == "No data found for tag: bar"

    def test_non_existing_tag(self):
        response = self.get_response(self.project.organization.slug, "bar")
        assert response.status_code == 404
        assert response.json()["detail"] == "No data found for tag: bar"

    def test_non_existing_metric_name(self):
        _indexer_record(self.organization.id, "bar")
        response = self.get_response(self.project.organization.slug, "bar", metric="bad")
        assert response.status_code == 404
        assert response.json()["detail"] == "No data found for metric: bad and tag: bar"

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
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: session.abnormal_and_crashed and tag: release"
        )
