import time
from datetime import datetime

import pytest

from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.seer.anomaly_detection.store_data import fetch_historical_data, format_historical_data
from sentry.snuba import errors, metrics_performance
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import BaseMetricsTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.snuba import SnubaTSResult
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase

pytestmark = pytest.mark.sentry_metrics


class AnomalyDetectionStoreDataTest(AlertRuleBase, BaseMetricsTestCase):
    def setUp(self):
        super().setUp()
        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_1 = "5d52fd05-fcc9-4bf3-9dc9-267783670341"
        self.user_1 = "39887d89-13b2-4c84-8c23-5d13d2102666"

    def test_anomaly_detection_format_historical_data(self):
        time_1 = datetime.timestamp(
            before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        )
        time_2 = datetime.timestamp(
            before_now(days=1).replace(hour=11, minute=0, second=0, microsecond=0)
        )
        expected_return_value = [
            {"timestamp": time_1, "value": 0},
            {"timestamp": time_2, "value": 1},
        ]
        snuba_raw_data = [{"time": time_1}, {"time": time_2, "count": 1}]
        data = SnubaTSResult({"data": snuba_raw_data}, time_1, time_2, 3600)
        result = format_historical_data(data, errors)
        assert result == expected_return_value

    def test_anomaly_detection_fetch_historical_data(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)

        time_1 = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        time_2 = before_now(days=1).replace(hour=11, minute=0, second=0, microsecond=0)

        with self.options({"issues.group_attributes.send_kafka": True}):
            self.store_event(
                data={
                    "event_id": "a" * 32,
                    "message": "super duper bad",
                    "timestamp": iso_format(time_1),
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
                    "timestamp": iso_format(time_2),
                    "fingerprint": ["group2"],
                    "tags": {"sentry:user": self.user.email},
                },
                event_type=EventType.ERROR,
                project_id=self.project.id,
            )
        result = fetch_historical_data(alert_rule, snuba_query, self.project)
        assert result
        assert {"time": int(datetime.timestamp(time_1)), "count": 1} in result.data.get("data")
        assert {"time": int(datetime.timestamp(time_2)), "count": 1} in result.data.get("data")

    def test_anomaly_detection_format_historical_data_crash_rate_alert(self):
        time_1 = "2024-08-29T00:00:00Z"
        time_2 = "2024-08-29T02:00:00Z"
        time_1_ts = datetime(2024, 8, 29, 0, 0).timestamp()
        time_2_ts = datetime(2024, 8, 29, 2, 0).timestamp()
        expected_return_value = [
            {"timestamp": time_1_ts, "value": 0},
            {"timestamp": time_2_ts, "value": 1},
        ]
        snuba_raw_data = {
            "groups": [
                {
                    "by": {"release": self.session_release},
                    "totals": {"sum(session)": 1},
                    "series": {"sum(session)": [0, 1]},
                }
            ],
            "start": time_1,
            "end": time_2,
            "intervals": [time_1, time_2],
        }
        # data = SnubaTSResult({"data": snuba_raw_data}, time_1, time_2, 3600)
        result = format_historical_data(snuba_raw_data, metrics_performance)
        assert result == expected_return_value

    def test_anomaly_detection_fetch_historical_data_crash_rate_alert(self):
        self.store_session(
            self.build_session(
                distinct_id=self.user_1,
                session_id=self.session_1,
                status="exited",
                release=self.session_release,
                environment="prod",
                started=self.session_started,
                received=self.received,
            )
        )

        alert_rule = self.create_alert_rule(
            projects=[self.project],
            dataset=Dataset.Metrics,
            name="JustAValidRule",
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            time_window=1,
            threshold_type=AlertRuleThresholdType.BELOW,
            threshold_period=1,
        )
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
        result = fetch_historical_data(alert_rule, snuba_query, self.project)
        assert result
        assert "2024-08-02T01:00:00Z" in result.get("intervals")  # this might be flaky
        assert 1 in result.get("groups")[0].get("series").get("sum(session)")
