from collections import namedtuple
from datetime import datetime, timezone
from unittest import mock

from django.http import HttpResponse
from django.urls import reverse
from freezegun import freeze_time

from sentry.api.endpoints.organization_transaction_anomaly_detection import get_time_params
from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationTransactionAnomalyDetectionEndpoint(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-transaction-anomaly-detection"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)
        self.features = {}
        self.snuba_raw_data = [(0, 0), (3, 0), (0, 0)]

    def do_request(self, data, url=None, features=None):
        self.url = reverse(
            "sentry-api-0-organization-transaction-anomaly-detection",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        if features is None:
            features = {
                "organizations:discover-basic": True,
                "organizations:performance-anomaly-detection-ui": True,
            }
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_without_feature(self):
        self.url = reverse(
            "sentry-api-0-organization-transaction-anomaly-detection",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        response = self.client.get(self.url, data={}, format="json")
        self.assertEqual(response.status_code, 404)

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
            "query": "transaction.duration:>5s",
            "start": "2022-02-01",
            "end": "2022-02-02",
        }

        expected_snuba_io = {
            "query": "transaction.duration:>5s event.type:transaction",
            "data": self.snuba_raw_data,
            "granularity": 600,
            "params": {
                "start": datetime(2022, 1, 25, 12, 0, tzinfo=timezone.utc),
                "end": datetime(2022, 2, 8, 12, 0, tzinfo=timezone.utc),
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
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
            "query": "transaction.duration:>5s",
            "statsPeriod": "13h",
        }

        expected_snuba_io = {
            "query": "transaction.duration:>5s event.type:transaction",
            "data": self.snuba_raw_data,
            "granularity": 600,
            "params": {
                "start": datetime(2022, 1, 28, 3, 21, 34, tzinfo=timezone.utc),
                "end": datetime(2022, 2, 11, 3, 21, 34, tzinfo=timezone.utc),
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
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
            "granularity": 1200,
            "params": {
                "start": datetime(2021, 12, 20, 0, 0, tzinfo=timezone.utc),
                "end": datetime(2022, 1, 17, 0, 0, tzinfo=timezone.utc),
                "project_id": [self.project.id],
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "team_id": [self.team.id],
            },
            "start": "2022-01-01 00:00:00",
            "end": "2022-01-05 00:00:00",
        }
        self.do_request(data=request)

        mock_get_anomalies.assert_called_once_with(expected_snuba_io)

    @staticmethod
    def test_get_time_params_600_granularity():
        expected_tuple = (
            datetime(2021, 12, 25, 12, 0, tzinfo=timezone.utc),
            datetime(2022, 1, 8, 12, 0, tzinfo=timezone.utc),
            600,
        )
        returned_tuple = get_time_params(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc),
            datetime(2022, 1, 2, 0, 0, tzinfo=timezone.utc),
        )
        assert returned_tuple == expected_tuple

    @staticmethod
    def test_get_time_params_1200_granularity():
        expected_tuple = (
            datetime(2021, 12, 20, 0, 0, tzinfo=timezone.utc),
            datetime(2022, 1, 17, 0, 0, tzinfo=timezone.utc),
            1200,
        )
        returned_tuple = get_time_params(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc),
            datetime(2022, 1, 5, 0, 0, tzinfo=timezone.utc),
        )
        assert returned_tuple == expected_tuple

    @staticmethod
    @freeze_time("2022-02-11 00:00:00")
    def test_get_time_params_3600_granularity():
        expected_tuple = (
            datetime(2021, 11, 13, 0, 0, tzinfo=timezone.utc),
            datetime(2022, 2, 11, 0, 0, tzinfo=timezone.utc),
            3600,
        )
        returned_tuple = get_time_params(
            datetime(2022, 1, 1, 0, 0, tzinfo=timezone.utc),
            datetime(2022, 2, 5, 0, 0, tzinfo=timezone.utc),
        )
        assert returned_tuple == expected_tuple
