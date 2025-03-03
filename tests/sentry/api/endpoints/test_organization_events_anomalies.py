from datetime import timedelta
from unittest.mock import patch

import orjson
from urllib3 import HTTPResponse
from urllib3.exceptions import TimeoutError

from sentry.incidents.models.alert_rule import (
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
)
from sentry.seer.anomaly_detection.types import (
    Anomaly,
    AnomalyDetectionConfig,
    DetectAnomaliesResponse,
    DetectHistoricalAnomaliesContext,
    TimeSeriesPoint,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner


@freeze_time()
class OrganizationEventsAnomaliesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-events-anomalies"

    method = "post"

    four_weeks_ago = before_now(days=28).replace(hour=10, minute=0, second=0, microsecond=0)
    one_week_ago = before_now(days=7)

    config = AnomalyDetectionConfig(
        time_period=60,
        sensitivity=AlertRuleSensitivity.LOW.value,
        direction=translate_direction(AlertRuleThresholdType.ABOVE.value),
        expected_seasonality=AlertRuleSeasonality.AUTO.value,
    )
    historical_timestamp_1 = four_weeks_ago.timestamp()
    historical_timestamp_2 = (four_weeks_ago + timedelta(days=10)).timestamp()
    current_timestamp_1 = one_week_ago.timestamp()
    current_timestamp_2 = (one_week_ago + timedelta(minutes=10)).timestamp()
    data = {
        "project_id": 1,
        "config": config,
        "historical_data": [
            [historical_timestamp_1, {"count": 5}],
            [historical_timestamp_2, {"count": 7}],
        ],
        "current_data": [
            [current_timestamp_1, {"count": 2}],
            [current_timestamp_2, {"count": 3}],
        ],
    }

    # for logging
    context = DetectHistoricalAnomaliesContext(
        history=[
            TimeSeriesPoint(
                timestamp=historical_timestamp_1,
                value=5,
            ),
            TimeSeriesPoint(
                timestamp=historical_timestamp_2,
                value=7,
            ),
        ],
        current=[
            TimeSeriesPoint(
                timestamp=current_timestamp_1,
                value=2,
            ),
            TimeSeriesPoint(
                timestamp=current_timestamp_2,
                value=3,
            ),
        ],
    )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_simple(self, mock_seer_request):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        seer_return_value = DetectAnomaliesResponse(
            success=True,
            message="",
            timeseries=[
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_1,
                    value=2,
                    anomaly=Anomaly(anomaly_score=-0.1, anomaly_type="none"),
                ),
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_2,
                    value=3,
                    anomaly=Anomaly(anomaly_score=-0.2, anomaly_type="none"),
                ),
            ],
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        assert resp.data == seer_return_value["timeseries"]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_member_permission(self, mock_seer_request):
        """Test that even a member (lowest permissions) can access this endpoint"""
        user = self.create_user(is_superuser=False)
        member = self.create_member(
            user=user, organization=self.organization, role="member", teams=[]
        )
        self.create_team(organization=self.organization, members=[member])
        self.login_as(member)

        seer_return_value = DetectAnomaliesResponse(
            success=True,
            message="",
            timeseries=[
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_1,
                    value=2,
                    anomaly=Anomaly(anomaly_score=-0.1, anomaly_type="none"),
                ),
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_2,
                    value=3,
                    anomaly=Anomaly(anomaly_score=-0.2, anomaly_type="none"),
                ),
            ],
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        assert resp.data == seer_return_value["timeseries"]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_not_enough_historical_data(self, mock_seer_request):
        data = {
            "project_id": 1,
            "config": self.config,
            "historical_data": [
                [self.historical_timestamp_1, {"count": 5}],
            ],
            "current_data": [
                [self.current_timestamp_1, {"count": 2}],
                [self.current_timestamp_2, {"count": 3}],
            ],
        }
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(data)
            )

        # we return the empty list early
        assert mock_seer_request.call_count == 0
        assert resp.data == []

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_timeout_error(self, mock_logger, mock_seer_request):
        mock_seer_request.side_effect = TimeoutError
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.warning.assert_called_with(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "organization_id": self.organization.id,
                "project_id": 1,
                "config": self.config,
                "context": self.context,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_attribute_error(self, mock_logger, mock_seer_request):
        mock_seer_request.return_value = HTTPResponse(None, status=400)  # type:ignore[arg-type]
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.exception.assert_called_with(
            "Failed to parse Seer anomaly detection response",
            extra={
                "organization_id": self.organization.id,
                "project_id": 1,
                "config": self.config,
                "context": self.context,
                "response_data": None,
                "response_code": 400,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_error(self, mock_logger, mock_seer_request):
        mock_seer_request.return_value = HTTPResponse("Bad stuff", status=500)
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.error.assert_called_with(
            "Error when hitting Seer detect anomalies endpoint",
            extra={
                "response_data": "Bad stuff",
                "response_code": 500,
                "organization_id": self.organization.id,
                "project_id": 1,
                "config": self.config,
                "context": self.context,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_fail_response(self, mock_logger, mock_seer_request):
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps(
                {"success": False, "message": "I have revolted against my human overlords"}
            ),
            status=200,
        )
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.error.assert_called_with(
            "Error when hitting Seer detect anomalies endpoint",
            extra={
                "response_data": "I have revolted against my human overlords",
                "organization_id": self.organization.id,
                "project_id": 1,
                "config": self.config,
                "context": self.context,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_no_anomalies(self, mock_logger, mock_seer_request):
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps({"success": True, "message": "moo deng is cute", "timeseries": []}),
            status=200,
        )
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(self.data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.warning.assert_called_with(
            "Seer anomaly detection response returned no potential anomalies",
            extra={
                "organization_id": self.organization.id,
                "project_id": 1,
                "response_data": "moo deng is cute",
                "config": self.config,
                "context": self.context,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"
