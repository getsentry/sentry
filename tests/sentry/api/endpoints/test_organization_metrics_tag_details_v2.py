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
        # Use Case: CUSTOM
        for value, release, tag_value, time in (
            (1, release_1.version, "tag_value_1", self.now()),
            (1, release_1.version, "tag_value_1", self.now()),
            (1, release_1.version, "tag_value_2", self.now() - timedelta(days=40)),
            (1, release_2.version, "tag_value_3", self.now() - timedelta(days=50)),
            (1, release_2.version, "tag_value_4", self.now() - timedelta(days=60)),
            (1, release_2.version, "my_tag_value_5", self.now() - timedelta(days=60)),
        ):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                "d:transactions/my_test_metric@percent",
                {
                    "transaction": "/hello",
                    "platform": "platform",
                    "environment": "prod",
                    "release": release,
                    "mytag": tag_value,
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

    def test_tag_details_prefix(self):
        response = self.get_success_response(
            self.project.organization.slug,
            "mytag",
            metric=["d:transactions/my_test_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
            prefix="tag_val",
        )
        assert sorted(response.data, key=lambda x: x["value"]) == [
            {"key": "mytag", "value": "tag_value_1"},
            {"key": "mytag", "value": "tag_value_2"},
            {"key": "mytag", "value": "tag_value_3"},
            {"key": "mytag", "value": "tag_value_4"},
        ]

    def test_tag_details_prefix_empty_result(self):
        response = self.get_success_response(
            self.project.organization.slug,
            "mytag",
            metric=["d:transactions/my_test_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
            prefix="this_does_not_exist",
        )
        assert len(response.data) == 0

    def test_tag_details_prefix_non_existent_metric(self):
        response = self.get_response(
            self.project.organization.slug,
            "mytag",
            metric=["d:transactions/my_non_existent_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
            prefix="this_does_not_exist",
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: d:transactions/my_non_existent_metric@percent and tag: mytag"
        )

    def test_tag_details_prefix_non_existent_tag_key(self):
        response = self.get_response(
            self.project.organization.slug,
            "mytagkeydoesnotexist",
            metric=["d:transactions/my_non_existent_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
            prefix="this_does_not_exist",
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: d:transactions/my_non_existent_metric@percent and tag: mytagkeydoesnotexist"
        )

    def test_tag_details_empty_prefix(self):
        response = self.get_success_response(
            self.project.organization.slug,
            "mytag",
            metric=["d:transactions/my_test_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
            prefix="",
        )
        assert sorted(response.data, key=lambda x: x["value"]) == [
            {"key": "mytag", "value": "my_tag_value_5"},
            {"key": "mytag", "value": "tag_value_1"},
            {"key": "mytag", "value": "tag_value_2"},
            {"key": "mytag", "value": "tag_value_3"},
            {"key": "mytag", "value": "tag_value_4"},
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

    def test_non_existing_tag_for_custom_use_case(self):
        response = self.get_error_response(
            self.project.organization.slug,
            "my_non_existent_tag",
            metric=["d:transactions/my_test_metric@percent"],
            project=[self.project.id],
            useCase="transactions",
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "No data found for metric: d:transactions/my_test_metric@percent and tag: my_non_existent_tag"
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
        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Please supply only a single metric name. Specifying multiple metric names is not supported for this endpoint."
        )

    def test_metrics_tags_when_organization_has_no_projects(self):
        organization_without_projects = self.create_organization()
        self.create_member(user=self.user, organization=organization_without_projects)
        response = self.get_error_response(organization_without_projects.slug, "mytag")
        assert response.status_code == 404
        assert response.data["detail"] == "You must supply at least one project to see its metrics"
