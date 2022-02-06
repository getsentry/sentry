from unittest import mock

from django.urls import reverse

from sentry.testutils import AcceptanceTestCase, APITestCase


class OrganizationTransactionAnomalyDetectionEndpoint(APITestCase, AcceptanceTestCase):
    endpoint = "sentry-api-0-organization-transaction-anomaly-detection"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)
        self.features = {}

    @mock.patch("sentry.snuba.discover.timeseries_query")
    @mock.patch(
        "sentry.api.endpoints.organization_transaction_anomaly_detection.OrganizationTransactionAnomalyDetectionEndpoint.get_anomalies"
    )
    def test_get(self, mock_get_anomalies, mock_timeseries_query):
        mock_timeseries_query.return_value = {}
        mock_get_anomalies.return_value = {}
        request = {
            "project": 155735,
            "query": "transaction.duration",
            "statsPeriod": "24h",
            "userAgents": ["okhttp"],
        }

        # self.do_request(data=request)
        self.get_response(self.organization.slug, qs_params=request)

        mock_get_anomalies.assert_called_with(request)

    def do_request(self, data, url=None, features=None):
        self.url = reverse(
            "sentry-api-0-organization-transaction-anomaly-detection",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")
