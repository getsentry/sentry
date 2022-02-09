from collections import namedtuple
from datetime import datetime, timezone
from unittest import mock

from django.http import HttpResponse
from django.urls import reverse
from freezegun import freeze_time

from sentry.api.endpoints.organization_transaction_anomaly_detection import map_snuba_queries
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
    def test_get_start_end(self, mock_get_anomalies, mock_timeseries_query):
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
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
                "statsPeriodStart": datetime(2022, 1, 26, 0, 0),
                "statsPeriodEnd": datetime(2022, 2, 2, 0, 0),
            },
            "start": "2022-02-01 00:00:00",
            "end": "2022-02-02 00:00:00",
        }
        self.do_request(data=request)

        mock_get_anomalies.assert_called_once_with(expected_snuba_io)

    @freeze_time("2022-02-11 03:21:34")
    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.timeseries_query")
    @mock.patch("sentry.api.endpoints.organization_transaction_anomaly_detection.get_anomalies")
    def test_get_stats_period(self, mock_get_anomalies, mock_timeseries_query):
        SnubaTSResult = namedtuple("SnubaTSResult", "data")
        mock_timeseries_query.return_value = SnubaTSResult(
            data={"data": self.snuba_raw_data},
        )
        mock_get_anomalies.return_value = HttpResponse({"key": "value"})
        request = {
            "project": self.project.id,
            "query": "transaction.duration",
            "statsPeriod": "13h",
        }

        expected_snuba_io = {
            "query": "transaction.duration event.type:transaction",
            "data": self.snuba_raw_data,
            "granularity": 300,
            "params": {
                "start": datetime(2022, 2, 10, 14, 21, 4, tzinfo=timezone.utc),
                "end": datetime(2022, 2, 11, 3, 21, 4, tzinfo=timezone.utc),
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
                "statsPeriodStart": datetime(2022, 2, 4, 3, 21, 34),
                "statsPeriodEnd": datetime(2022, 2, 11, 3, 21, 34),
            },
            "start": "2022-02-10 14:21:34",
            "end": "2022-02-11 03:21:34",
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
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
                "statsPeriodStart": datetime(2021, 12, 22, 0, 0),
                "statsPeriodEnd": datetime(2022, 1, 5, 0, 0),
            },
            "start": "2022-01-01 00:00:00",
            "end": "2022-01-05 00:00:00",
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

    @staticmethod
    def test_map_snuba_queries_1():
        expected_tuple = (datetime(2021, 12, 26, 0, 0), datetime(2022, 1, 2, 0, 0), 300)
        returned_tuple = map_snuba_queries(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc).timestamp(),
            datetime(2022, 1, 2, 0, 0, tzinfo=timezone.utc).timestamp(),
        )
        assert returned_tuple == expected_tuple

    @staticmethod
    def test_map_snuba_queries_2():
        expected_tuple = (datetime(2021, 12, 22, 0, 0), datetime(2022, 1, 5, 0, 0), 600)
        returned_tuple = map_snuba_queries(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc).timestamp(),
            datetime(2022, 1, 5, 0, 0, tzinfo=timezone.utc).timestamp(),
        )
        assert returned_tuple == expected_tuple

    @staticmethod
    def test_map_snuba_queries_3():
        expected_tuple = (datetime(2021, 12, 13, 0, 0), datetime(2022, 1, 10, 0, 0), 1200)
        returned_tuple = map_snuba_queries(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc).timestamp(),
            datetime(2022, 1, 10, 0, 0, tzinfo=timezone.utc).timestamp(),
        )
        assert returned_tuple == expected_tuple

    @staticmethod
    def test_map_snuba_queries_4():
        expected_tuple = (datetime(2021, 10, 18, 0, 0), datetime(2022, 1, 16, 0, 0), 3600)
        returned_tuple = map_snuba_queries(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc).timestamp(),
            datetime(2022, 1, 16, 0, 0, tzinfo=timezone.utc).timestamp(),
        )
        assert returned_tuple == expected_tuple
