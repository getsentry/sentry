from datetime import timedelta
from unittest.mock import patch

import orjson
import pytest
from urllib3.exceptions import TimeoutError
from urllib3.response import HTTPResponse

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
)
from sentry.seer.anomaly_detection.types import AnomalyType, StoreDataResponse
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.skips import requires_snuba
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


@freeze_time()
class AlertRuleAnomalyEndpointTest(AlertRuleBase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-alert-rule-anomalies"

    method = "get"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_simple(self, mock_seer_request, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": (two_weeks_ago + timedelta(minutes=1)).isoformat(),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "super bad",
                "timestamp": (two_weeks_ago + timedelta(days=10)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        seer_store_data_return_value: StoreDataResponse = {"success": True}
        mock_seer_store_request.return_value = HTTPResponse(
            orjson.dumps(seer_store_data_return_value), status=200
        )

        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        self.login_as(self.user)
        seer_return_value = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.0,
                        "anomaly_type": AnomalyType.NONE.value,
                    },
                    "timestamp": 1,
                    "value": 1,
                },
                {
                    "anomaly": {
                        "anomaly_score": 0.0,
                        "anomaly_type": AnomalyType.NONE.value,
                    },
                    "timestamp": 2,
                    "value": 1,
                },
            ],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug,
                alert_rule.id,
                qs_params={
                    "start": str(two_weeks_ago),
                    "end": str(two_weeks_ago + timedelta(days=12)),
                },
                status_code=200,
            )

        assert mock_seer_store_request.call_count == 1
        assert mock_seer_request.call_count == 1
        assert mock_seer_request.call_args.args[0] == "POST"
        assert mock_seer_request.call_args.args[1] == SEER_ANOMALY_DETECTION_ENDPOINT_URL
        assert resp.data == seer_return_value["timeseries"]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_alert_not_enough_data(self, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_store_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        self.login_as(self.user)
        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug,
                alert_rule.id,
                qs_params={
                    "start": str(two_weeks_ago),
                    "end": str(two_weeks_ago + timedelta(days=12)),
                },
                status_code=200,
            )

        assert resp.data == []

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_timeout(self, mock_logger, mock_seer_request, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": (two_weeks_ago + timedelta(minutes=1)).isoformat(),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "super bad",
                "timestamp": (two_weeks_ago + timedelta(days=10)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_store_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        self.login_as(self.user)
        mock_seer_request.side_effect = TimeoutError
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                alert_rule.id,
                qs_params={
                    "start": str(two_weeks_ago),
                    "end": str(two_weeks_ago + timedelta(days=12)),
                },
                status_code=400,
            )
        assert mock_seer_request.call_count == 1
        assert alert_rule.snuba_query is not None
        assert alert_rule.organization is not None
        mock_logger.exception.assert_called_with(
            "Timeout error when hitting anomaly detection endpoint",
            extra={
                "subscription_id": alert_rule.snuba_query.subscriptions.get().id,
                "dataset": alert_rule.snuba_query.dataset,
                "organization_id": alert_rule.organization.id,
                "project_id": self.project.id,
                "alert_rule_id": alert_rule.id,
            },
        )
        assert resp.data == "Unable to get historical anomaly data"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.get_historical_anomalies.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.get_historical_anomalies.logger")
    def test_seer_error(self, mock_logger, mock_seer_request, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": (two_weeks_ago + timedelta(minutes=1)).isoformat(),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "super bad",
                "timestamp": (two_weeks_ago + timedelta(days=10)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_store_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        self.login_as(self.user)
        mock_seer_request.return_value = HTTPResponse("Bad stuff", status=500)
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                alert_rule.id,
                qs_params={
                    "start": str(two_weeks_ago),
                    "end": str(two_weeks_ago + timedelta(days=12)),
                },
                status_code=400,
            )
        assert mock_seer_request.call_count == 1
        mock_logger.error.assert_called_with(
            f"Received 500 when calling Seer endpoint {SEER_ANOMALY_DETECTION_ENDPOINT_URL}.",
            extra={"response_data": "Bad stuff"},
        )
        assert resp.data == "Unable to get historical anomaly data"
