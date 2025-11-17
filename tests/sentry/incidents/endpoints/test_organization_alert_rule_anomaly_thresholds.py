from unittest.mock import patch

import orjson
from urllib3.response import HTTPResponse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@requires_snuba
class OrganizationAlertRuleAnomalyThresholdsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rule-anomaly-thresholds"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.get_alert_threshold_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_get_thresholds_success(self, mock_seer_request):
        """Test successfully fetching threshold data from Seer"""
        alert_rule = self.create_alert_rule()

        # Mock Seer response
        seer_response = {
            "success": True,
            "data": [
                {
                    "external_alert_id": 2,
                    "timestamp": 1729178100.0,
                    "value": 59.602427900000016,
                    "yhat_lower": None,
                    "yhat_upper": None,
                },
                {
                    "external_alert_id": 2,
                    "timestamp": 1729178400.0,
                    "value": 59.72163670000002,
                    "yhat_lower": 33.5407748538539,
                    "yhat_upper": 112.01988018329682,
                },
                {
                    "external_alert_id": 2,
                    "timestamp": 1729178700.0,
                    "value": 54.662632900000006,
                    "yhat_lower": 30.123456789,
                    "yhat_upper": 110.987654321,
                },
            ],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_response), status=200)

        response = self.get_success_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            end=1729179000.0,
        )

        # Response includes Seer's full response with success and data fields
        assert response.data["success"] is True
        assert isinstance(response.data["data"], list)
        assert len(response.data["data"]) == 3
        assert response.data["data"][0]["timestamp"] == 1729178100.0
        assert response.data["data"][0]["yhat_lower"] is None
        assert response.data["data"][0]["yhat_upper"] is None
        assert response.data["data"][1]["timestamp"] == 1729178400.0
        assert response.data["data"][1]["yhat_lower"] == 33.5407748538539
        assert response.data["data"][1]["yhat_upper"] == 112.01988018329682

    @with_feature("organizations:anomaly-detection-alerts")
    def test_missing_start_param(self):
        """Test that start parameter is required"""
        alert_rule = self.create_alert_rule()

        response = self.get_error_response(
            self.organization.slug,
            alert_rule.id,
            end=1729179000.0,
            status_code=400,
        )

        assert "start" in response.data

    @with_feature("organizations:anomaly-detection-alerts")
    def test_missing_end_param(self):
        """Test that end parameter is required"""
        alert_rule = self.create_alert_rule()

        response = self.get_error_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            status_code=400,
        )

        assert "end" in response.data

    def test_feature_flag_required(self):
        """Test that the feature flag is required"""
        alert_rule = self.create_alert_rule()

        response = self.get_error_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            end=1729179000.0,
            status_code=404,
        )

        assert response.data["detail"] == "Your organization does not have access to this feature."

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.get_alert_threshold_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_seer_returns_error(self, mock_seer_request):
        """Test handling when Seer returns an error"""
        alert_rule = self.create_alert_rule()

        # Mock Seer error response
        seer_response = {
            "success": False,
            "message": "Internal server error",
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_response), status=200)

        response = self.get_error_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            end=1729179000.0,
            status_code=400,
        )

        assert response.data["detail"] == "Unable to fetch threshold data from Seer"

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.get_alert_threshold_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_seer_timeout(self, mock_seer_request):
        """Test handling when Seer request times out"""
        from urllib3.exceptions import TimeoutError

        alert_rule = self.create_alert_rule()
        mock_seer_request.side_effect = TimeoutError()

        response = self.get_error_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            end=1729179000.0,
            status_code=400,
        )

        assert response.data["detail"] == "Unable to fetch threshold data from Seer"

    @with_feature("organizations:anomaly-detection-alerts")
    def test_alert_rule_not_found(self):
        """Test 404 when alert rule doesn't exist"""
        self.get_error_response(
            self.organization.slug,
            99999,
            start=1729178100.0,
            end=1729179000.0,
            status_code=404,
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.get_alert_threshold_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_empty_data_response(self, mock_seer_request):
        """Test handling when Seer returns empty data"""
        alert_rule = self.create_alert_rule()

        # Mock Seer response with empty data
        seer_response = {
            "success": True,
            "data": [],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_response), status=200)

        response = self.get_success_response(
            self.organization.slug,
            alert_rule.id,
            start=1729178100.0,
            end=1729179000.0,
        )

        # Response includes success flag and empty data array
        assert response.data["success"] is True
        assert isinstance(response.data["data"], list)
        assert len(response.data["data"]) == 0
