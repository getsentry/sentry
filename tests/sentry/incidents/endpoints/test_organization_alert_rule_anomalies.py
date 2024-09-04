from datetime import timedelta
from unittest.mock import patch

import pytest
from urllib3.response import HTTPResponse

from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
)
from sentry.seer.anomaly_detection.types import AnomalyType
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
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
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_simple(self, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        with self.options({"issues.group_attributes.send_kafka": True}):
            self.store_event(
                data={
                    "event_id": "a" * 32,
                    "message": "super duper bad",
                    "timestamp": iso_format(two_weeks_ago + timedelta(minutes=1)),
                    "fingerprint": ["group1"],
                    "tags": {"sentry:user": self.user.email},
                },
                event_type=EventType.ERROR,
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "event_id": "b" * 32,
                    "message": "super bad",
                    "timestamp": iso_format(two_weeks_ago + timedelta(days=10)),
                    "fingerprint": ["group2"],
                    "tags": {"sentry:user": self.user.email},
                },
                event_type=EventType.ERROR,
                project_id=self.project.id,
            )

        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        self.login_as(self.user)

        mock_seer_store_request.return_value = HTTPResponse(status=200)
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
        assert resp.data == [
            {
                "timestamp": 0.1,
                "value": 100.0,
                "anomaly": {
                    "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
                    "anomaly_value": 100,
                },
            }
        ]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_alert_not_enough_data(self, mock_seer_store_request):
        self.create_team(organization=self.organization, members=[self.user])
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        alert_rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.MEDIUM,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        self.login_as(self.user)
        mock_seer_store_request.return_value = HTTPResponse(status=200)
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
