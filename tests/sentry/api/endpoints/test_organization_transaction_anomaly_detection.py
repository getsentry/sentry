from collections import namedtuple
from datetime import datetime, timezone
from unittest import mock

from django.http import HttpResponse
from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTransactionAnomalyDetectionEndpoint(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-transaction-anomaly-detection"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)
        self.features = {}
        self.snuba_raw_data = [(0, 0), (3, 0), (0, 0)]

    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.timeseries_query")
    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.get_anomalies")
    def test_get_1(self, mock_get_anomalies, mock_timeseries_query):
        SnubaTSResult = namedtuple("SnubaTSResult", "data")
        mock_timeseries_query.return_value = SnubaTSResult(
            data={"data": self.snuba_raw_data},
        )
        mock_get_anomalies.return_value = HttpResponse({"key": "value"})
        request = {
            "project": self.project.id,
            "query": "transaction.duration",
            "start": "2022-02-01",
            "end": "2022-02-02",
        }

        expected_snuba_io = {
            "query": "transaction.duration event.type:transaction",
            "data": self.snuba_raw_data,
            "granularity": 300,
            "params": {
                "start": datetime(2022, 2, 1, 0, 0, tzinfo=timezone.utc),
                "end": datetime(2022, 2, 2, 0, 0, tzinfo=timezone.utc),
                "project_id": [2],
                "organization_id": 2,
                "user_id": 1,
                "team_id": [2],
                "statsPeriodStart": datetime(2022, 1, 26, 0, 0),
                "statsPeriodEnd": datetime(2022, 2, 2, 0, 0),
            },
        }
        self.do_request(data=request)

        mock_get_anomalies.assert_called_once_with(expected_snuba_io)

    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.timeseries_query")
    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.get_anomalies")
    def test_get_no_query(self, mock_get_anomalies, mock_timeseries_query):
        SnubaTSResult = namedtuple("SnubaTSResult", "data")
        mock_timeseries_query.return_value = SnubaTSResult(
            data={"data": self.snuba_raw_data},
        )
        mock_get_anomalies.return_value = HttpResponse({"key": "value"})
        request = {
            "project": self.project.id,
            "start": "2022-01-01",
            "end": "2022-01-05",
        }

        expected_snuba_io = {
            "query": "event.type:transaction",
            "data": self.snuba_raw_data,
            "granularity": 600,
            "params": {
                "start": datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc),
                "end": datetime(2022, 1, 5, 0, 0, tzinfo=timezone.utc),
                "project_id": [3],
                "organization_id": 3,
                "user_id": 2,
                "team_id": [3],
                "statsPeriodStart": datetime(2021, 12, 22, 0, 0),
                "statsPeriodEnd": datetime(2022, 1, 5, 0, 0),
            },
        }
        self.do_request(data=request)

        mock_get_anomalies.assert_called_once_with(expected_snuba_io)

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
