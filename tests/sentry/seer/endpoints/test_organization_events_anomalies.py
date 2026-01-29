from datetime import timedelta
from unittest.mock import MagicMock, patch

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

    def get_test_data(self, project_id: int) -> dict:
        return {
            "project_id": project_id,
            "config": self.config,
            "historical_data": [
                [self.historical_timestamp_1, {"count": 5}],
                [self.historical_timestamp_2, {"count": 7}],
            ],
            "current_data": [
                [self.current_timestamp_1, {"count": 2}],
                [self.current_timestamp_2, {"count": 3}],
            ],
        }

    def get_context(self) -> DetectHistoricalAnomaliesContext:
        return DetectHistoricalAnomaliesContext(
            history=[
                TimeSeriesPoint(
                    timestamp=self.historical_timestamp_1,
                    value=5,
                ),
                TimeSeriesPoint(
                    timestamp=self.historical_timestamp_2,
                    value=7,
                ),
            ],
            current=[
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_1,
                    value=2,
                ),
                TimeSeriesPoint(
                    timestamp=self.current_timestamp_2,
                    value=3,
                ),
            ],
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_simple(self, mock_seer_request: MagicMock) -> None:
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

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        assert resp.data == seer_return_value["timeseries"]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_member_permission(self, mock_seer_request: MagicMock) -> None:
        """Test that even a member (lowest permissions) can access this endpoint"""
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(user)

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

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        assert resp.data == seer_return_value["timeseries"]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_not_enough_historical_data(self, mock_seer_request: MagicMock) -> None:
        data = {
            "project_id": self.project.id,
            "config": self.config,
            "historical_data": [
                [self.historical_timestamp_1, {"count": 5}],
            ],
            "current_data": [
                [self.current_timestamp_1, {"count": 2}],
                [self.current_timestamp_2, {"count": 3}],
            ],
        }
        self.login_as(self.user)

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(data)
            )

        # we return the empty list early
        assert mock_seer_request.call_count == 0
        assert resp.data == []

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_timeout_error(self, mock_logger: MagicMock, mock_seer_request: MagicMock) -> None:
        mock_seer_request.side_effect = TimeoutError
        self.login_as(self.user)

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.warning.assert_called_with(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "config": self.config,
                "context": self.get_context(),
            },
        )
        assert resp.data == {"detail": "Unable to get historical anomaly data"}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_attribute_error(self, mock_logger: MagicMock, mock_seer_request: MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse(None, status=400)  # type:ignore[arg-type]
        self.login_as(self.user)

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.exception.assert_called_with(
            "Failed to parse Seer anomaly detection response",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "config": self.config,
                "context": self.get_context(),
                "response_data": None,
                "response_code": 400,
            },
        )
        assert resp.data == {"detail": "Unable to get historical anomaly data"}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_error(self, mock_logger: MagicMock, mock_seer_request: MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse("Bad stuff", status=500)
        self.login_as(self.user)

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.error.assert_called_with(
            "Error when hitting Seer detect anomalies endpoint",
            extra={
                "response_data": "Bad stuff",
                "response_code": 500,
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "config": self.config,
                "context": self.get_context(),
            },
        )
        assert resp.data == {"detail": "Unable to get historical anomaly data"}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_fail_response(self, mock_logger: MagicMock, mock_seer_request: MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps(
                {"success": False, "message": "I have revolted against my human overlords"}
            ),
            status=200,
        )
        self.login_as(self.user)

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.error.assert_called_with(
            "Error when hitting Seer detect anomalies endpoint",
            extra={
                "response_data": "I have revolted against my human overlords",
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "config": self.config,
                "context": self.get_context(),
            },
        )
        assert resp.data == {"detail": "Unable to get historical anomaly data"}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_no_anomalies(self, mock_logger: MagicMock, mock_seer_request: MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps({"success": True, "message": "moo deng is cute", "timeseries": []}),
            status=200,
        )
        self.login_as(self.user)

        data = self.get_test_data(self.project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=400, raw_data=orjson.dumps(data)
            )

        assert mock_seer_request.call_count == 1
        mock_logger.warning.assert_called_with(
            "Seer anomaly detection response returned no potential anomalies",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "response_data": "moo deng is cute",
                "config": self.config,
                "context": self.get_context(),
            },
        )
        assert resp.data == {"detail": "Unable to get historical anomaly data"}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    def test_rejects_project_not_in_organization(self) -> None:
        """Test that POST fails when project doesn't belong to the organization"""
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)

        self.login_as(self.user)

        data = self.get_test_data(other_project.id)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=403, raw_data=orjson.dumps(data)
            )

        assert resp.data == {"detail": "You do not have permission to perform this action."}

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    def test_rejects_nonexistent_project(self) -> None:
        """Test that POST fails when project doesn't exist"""
        self.login_as(self.user)

        data = self.get_test_data(999999)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug, status_code=403, raw_data=orjson.dumps(data)
            )

        assert resp.data == {"detail": "You do not have permission to perform this action."}
