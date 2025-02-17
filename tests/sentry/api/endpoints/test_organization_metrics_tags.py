import time
from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.snuba.metrics import SessionMRI, TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS

pytestmark = pytest.mark.sentry_metrics


@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationMetricsTagsIntegrationTest(MetricsAPIBaseTestCase):

    endpoint = "sentry-api-0-organization-metrics-tags"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        release_1 = self.create_release(
            project=self.project, version="1.0", date_added=MetricsAPIBaseTestCase.MOCK_DATETIME
        )
        release_2 = self.create_release(
            project=self.project,
            version="2.0",
            date_added=MetricsAPIBaseTestCase.MOCK_DATETIME + timedelta(minutes=5),
        )

        # Use Case: TRANSACTIONS
        for value, transaction, platform, env, release, timestamp in (
            (1, "/hello", "android", "prod", release_1.version, self.now()),
            (6, "/hello", "ios", "dev", release_2.version, self.now()),
            (5, "/world", "windows", "prod", release_1.version, self.now() + timedelta(minutes=30)),
            (3, "/hello", "ios", "dev", release_2.version, self.now() + timedelta(hours=1)),
            (2, "/hello", "android", "dev", release_1.version, self.now() + timedelta(hours=1)),
            (
                4,
                "/world",
                "windows",
                "prod",
                release_2.version,
                self.now() + timedelta(hours=1, minutes=30),
            ),
        ):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                TransactionMRI.DURATION.value,
                {
                    "transaction": transaction,
                    "platform": platform,
                    "environment": env,
                    "release": release,
                },
                timestamp.timestamp(),
                value,
            )

        self.prod_env = self.create_environment(name="prod", project=self.project)
        self.dev_env = self.create_environment(name="dev", project=self.project)

    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_metric_tags(self):
        response = self.get_success_response(
            self.organization.slug, metric=[TransactionMRI.DURATION.value]
        )
        assert sorted(response.data, key=lambda x: x["key"]) == [
            {"key": "environment"},
            {"key": "platform"},
            {"key": "project"},
            {"key": "release"},
            {"key": "transaction"},
        ]

    def test_no_metric_in_request(self):
        response = self.get_response(
            self.organization.slug,
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]["message"]
            == "Please provide a single metric to query its tags."
        )

    def test_multiple_metrics_in_request(self):
        response = self.get_response(
            self.organization.slug,
            metric=["metric1", "metric2"],
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]["message"]
            == "Please provide a single metric to query its tags."
        )

    def test_metric_tags_metric_does_not_exist_in_indexer(self):

        response = self.get_response(
            self.organization.slug,
            metric=["foo.bar"],
        )
        assert response.status_code == 400
        assert (
            response.data["detail"]["message"]
            == "Please provide a valid MRI to query a metric's tags."
        )

    def test_metric_tags_metric_does_not_have_data(self):
        response = self.get_response(
            self.organization.slug,
            metric=["foo.bar"],
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]["message"]
            == "Please provide a valid MRI to query a metric's tags."
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
            metric=[SessionMRI.CRASH_FREE_RATE.value],
        )
        assert response.status_code == 200
        assert response.data == [{"key": "environment"}, {"key": "release"}, {"key": "project"}]

    def test_multiple_derived_metric_tags(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
            )
        )

        response = self.get_response(
            self.organization.slug,
            metric=["session.crash_free_rate", "session.all"],
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]["message"]
            == "Please provide a single metric to query its tags."
        )

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.datasource.get_derived_metrics")
    def test_incorrectly_setup_derived_metric(self, mocked_derived_metrics):
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
        assert (
            response.json()["detail"]["message"]
            == "Please provide a valid MRI to query a metric's tags."
        )

    def test_metric_tags_with_gauge(self):
        mri = "g:transactions/page_load@millisecond"
        self.store_metric(
            self.project.organization.id,
            self.project.id,
            mri,
            {"transaction": "/hello", "release": "1.0", "environment": "prod"},
            int(self.now().timestamp()),
            10,
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=self.project.id,
            useCase="transactions",
        )
        assert len(response.data) == 4

    def test_metric_not_in_indexer(self):
        mri = "c:transactions/sentry_metric@none"
        response = self.get_response(
            self.organization.slug,
            metric=[mri],
            project=self.project.id,
            useCase="transactions",
        )
        assert (
            response.json()["detail"]
            == "The specified metric was not found: c:transactions/sentry_metric@none"
        )
        assert response.status_code == 404

    def test_metric_without_tags_does_not_cause_issues(self):
        mri = TransactionMRI.SPAN_DURATION.value
        self.store_metric(
            self.project.organization.id,
            self.project.id,
            mri,
            {"transaction": "/hello", "release": "1.0", "environment": "prod"},
            int(self.now().timestamp()),
            10,
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=self.project.id,
        )
        assert len(response.data) == 4

        self.store_metric(
            self.project.organization.id,
            self.project.id,
            mri,
            {},
            int(self.now().timestamp()),
            10,
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=self.project.id,
        )
        assert len(response.data) == 4

    def test_metrics_tags_when_organization_has_no_projects(self):
        organization_without_projects = self.create_organization()
        self.create_member(user=self.user, organization=organization_without_projects)
        response = self.get_response(organization_without_projects.slug)
        assert response.status_code == 404
        assert response.data["detail"] == "You must supply at least one project to see its metrics"
