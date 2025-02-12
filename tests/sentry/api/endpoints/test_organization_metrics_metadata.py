from datetime import timedelta

import pytest

from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics


@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationMetricsTagValues(MetricsAPIBaseTestCase):
    method = "get"
    endpoint = "sentry-api-0-organization-metrics-tag-details"

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
        for value, transaction, platform, env, release, time in (
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
                self.now().timestamp(),
                value,
            )

        self.prod_env = self.create_environment(name="prod", project=self.project)
        self.dev_env = self.create_environment(name="dev", project=self.project)

    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_tag_details_for_transactions_use_case(self):
        response = self.get_success_response(
            self.project.organization.slug,
            "transaction",
            metric=["d:transactions/duration@millisecond"],
            project=[self.project.id],
            useCase="transactions",
        )
        assert sorted(response.data, key=lambda x: x["value"]) == [
            {"key": "transaction", "value": "/hello"},
            {"key": "transaction", "value": "/world"},
        ]

    def test_non_existing_tag_for_transactions_use_case(self):
        response = self.get_error_response(
            self.project.organization.slug,
            "my_non_existent_tag",
            metric=["d:transactions/duration@millisecond"],
            project=[self.project.id],
            useCase="transactions",
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: d:transactions/duration@millisecond and tag: my_non_existent_tag"
        )

    def test_tag_details_for_non_existent_metric(self):
        response = self.get_error_response(
            self.project.organization.slug,
            "my_non_existent_tag",
            metric=["d:transactions/my_non_existent_test_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: d:transactions/my_non_existent_test_metric@percent and tag: my_non_existent_tag"
        )

    # fix this
    def test_tag_details_for_multiple_supplied_metrics(self):
        response = self.get_error_response(
            self.project.organization.slug,
            "my_non_existent_tag",
            metric=[
                "d:transactions/my_test_metric@percent",
                "d:transactions/duration@millisecond",
            ],
            project=[self.project.id],
            useCase="transactions",
        )

        assert (
            response.json()["detail"]
            == "Please supply only a single metric name. Specifying multiple metric names is not supported for this endpoint."
        )
