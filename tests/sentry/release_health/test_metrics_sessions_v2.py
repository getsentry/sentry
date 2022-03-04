from unittest.mock import patch

from django.urls import reverse

from sentry.release_health.duplex import compare_results
from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.release_health.sessions import SessionsReleaseHealthBackend
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.testutils.cases import APITestCase, SnubaTestCase
from tests.snuba.api.endpoints.test_organization_sessions import result_sorted


class MetricsSessionsV2Test(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.setup_fixture()

    def setup_fixture(self):
        self.organization1 = self.organization
        self.project1 = self.project
        self.project2 = self.create_project(
            name="teletubbies", slug="teletubbies", teams=[self.team], fire_project_created=True
        )

        self.release1 = self.create_release(project=self.project1, version="hello")
        self.release2 = self.create_release(project=self.project1, version="hola")
        self.release3 = self.create_release(project=self.project2, version="hallo")

        self.environment1 = self.create_environment(self.project1, name="development")
        self.environment2 = self.create_environment(self.project1, name="production")
        self.environment3 = self.create_environment(self.project2, name="testing")

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": (org or self.organization1).slug},
        )
        return self.client.get(url, query, format="json")

    def get_sessions_data(self, groupby, interval):
        response = self.do_request(
            {
                "organization_slug": [self.organization1],
                "project": [self.project1.id],
                "field": ["sum(session)"],
                "groupBy": [groupby],
                "interval": interval,
            }
        )
        assert response.status_code == 200
        return response.data

    def test_sessions_metrics_equal_num_keys(self):
        """
        Tests whether the number of keys in the metrics implementation of
        sessions data is the same as in the sessions implementation.

        Runs twice. Firstly, against sessions implementation to populate the
        cache. Then, against the metrics implementation, and compares with
        cached results.
        """
        empty_groupbyes = ["project", "release", "environment", "session.status"]
        interval_days = "1d"

        for groupby in empty_groupbyes:
            with patch(
                "sentry.api.endpoints.organization_sessions.release_health",
                SessionsReleaseHealthBackend(),
            ):
                sessions_data = result_sorted(self.get_sessions_data(groupby, interval_days))

            with patch(
                "sentry.release_health.metrics_sessions_v2.indexer.resolve", MockIndexer().resolve
            ), patch(
                "sentry.api.endpoints.organization_sessions.release_health",
                MetricsReleaseHealthBackend(),
            ):
                metrics_data = result_sorted(self.get_sessions_data(groupby, interval_days))

            errors = compare_results(
                sessions=sessions_data,
                metrics=metrics_data,
                rollup=interval_days * 24 * 60 * 60,  # days to seconds
            )
            assert len(errors) == 0
