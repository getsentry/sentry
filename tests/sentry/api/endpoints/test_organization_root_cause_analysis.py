import pytest
from django.urls import reverse

from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test

ROOT_CAUSE_FEATURE_FLAG = "organizations:statistical-detectors-root-cause-analysis"

FEATURES = [ROOT_CAUSE_FEATURE_FLAG]

pytestmark = [pytest.mark.sentry_metrics]


@region_silo_test(stable=True)
@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationRootCauseAnalysisTest(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-organization-events-root-cause-analysis", args=[self.org.slug]
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=1,
        )

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_404s_without_feature_flag(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_transaction_name_required(self):
        with self.feature(FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

    def test_project_id_required(self):
        with self.feature(FEATURES):
            response = self.client.get(self.url, format="json", data={"transaction": "foo"})

        assert response.status_code == 400, response.content

    def test_transaction_must_exist(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={"transaction": "foo", "project": self.project.id},
            )

        assert response.status_code == 200, response.content

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "does not exist",
                    "project": self.project.id,
                },
            )

        assert response.status_code == 400, response.content
