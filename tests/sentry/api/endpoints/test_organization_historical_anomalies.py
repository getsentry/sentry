import orjson

from sentry.incidents.models.alert_rule import (
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
)
from sentry.seer.anomaly_detection.types import AnomalyDetectionConfig
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner


class OrganizationEventsAnomaliesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-events-anomalies"

    method = "post"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        config = AnomalyDetectionConfig(
            time_period=60,
            sensitivity=AlertRuleSensitivity.LOW,
            direction=translate_direction(AlertRuleThresholdType.ABOVE.value),
            expected_seasonality=AlertRuleSeasonality.AUTO,
        )
        data = {
            "project_id": 1,
            "config": config,
            "current_data": [[1, {"count": 0.077881957}], [2, {"count": 0.075652768}]],
            "historical_data": [[169, {"count": 0.048480431}], [170, {"count": 0.047910238}]],
        }

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, status_code=200, raw_data=orjson.dumps(data)
            )

        assert resp.data == [
            {
                "anomaly": {"anomaly_score": -0.38810767243044786, "anomaly_type": "none"},
                "timestamp": 169,
                "value": 0.048480431,
            },
            {
                "anomaly": {"anomaly_score": -0.3890542800124323, "anomaly_type": "none"},
                "timestamp": 170,
                "value": 0.047910238,
            },
        ]
