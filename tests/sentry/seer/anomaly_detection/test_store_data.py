import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.seer.anomaly_detection.utils import fetch_historical_data, format_historical_data
from sentry.snuba import errors, metrics_performance
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import BaseMetricsTestCase, PerformanceIssueTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.utils.snuba import SnubaTSResult
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase

pytestmark = pytest.mark.sentry_metrics


def make_event(**kwargs: Any) -> dict[str, Any]:
    result = {
        "event_id": "a" * 32,
        "message": "foo",
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


@freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
class AnomalyDetectionStoreDataTest(AlertRuleBase, BaseMetricsTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()

        self.now = datetime.now(UTC)
        self.time_1_dt = self.now - timedelta(days=2)
        self.time_1 = self.time_1_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        self.time_1_ts = self.time_1_dt.timestamp()

        self.time_2_dt = self.now - timedelta(days=3)
        self.time_2 = self.time_2_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        self.time_2_ts = self.time_2_dt.timestamp()

        self.received = self.time_1_ts
        self.session_started = self.time_1_ts // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_1 = "5d52fd05-fcc9-4bf3-9dc9-267783670341"
        self.user_1 = "39887d89-13b2-4c84-8c23-5d13d2102666"

    def test_anomaly_detection_format_historical_data(self):
        expected_return_value = [
            {"timestamp": self.time_1_ts, "value": 0},
            {"timestamp": self.time_2_ts, "value": 1},
        ]
        snuba_raw_data = [{"time": self.time_1_ts}, {"time": self.time_2_ts, "count": 1}]
        data = SnubaTSResult(
            data={"data": snuba_raw_data}, start=self.time_1_dt, end=self.time_2_dt, rollup=3600
        )
        result = format_historical_data(
            data=data, query_columns=["count()"], dataset=errors, organization=self.organization
        )
        assert result == expected_return_value

    def test_anomaly_detection_format_historical_data_two(self):
        """
        Test a different aggregation key.
        """
        expected_return_value = [
            {"timestamp": self.time_1_ts, "value": 0},
            {"timestamp": self.time_2_ts, "value": 1},
        ]
        snuba_raw_data = [
            {"time": self.time_1_ts},
            {"count_unique_tags_sentry_user": 1, "time": self.time_2_ts},
        ]
        data = SnubaTSResult(
            data={"data": snuba_raw_data}, start=self.time_1_dt, end=self.time_2_dt, rollup=3600
        )
        result = format_historical_data(
            data=data,
            query_columns=["count_unique_tags_sentry_user"],
            dataset=errors,
            organization=self.organization,
        )
        assert result == expected_return_value

    def test_anomaly_detection_format_historical_data_none_value(self):
        """
        Test that we don't end up with a None value, but rather 0.
        """
        expected_return_value = [
            {"timestamp": self.time_1_ts, "value": 1},
            {"timestamp": self.time_2_ts, "value": 0},
        ]
        snuba_raw_data = [
            {"p95_measurements_fid": 1, "time": self.time_1_ts},
            {"p95_measurements_fid": None, "time": self.time_2_ts},
        ]
        data = SnubaTSResult(
            data={"data": snuba_raw_data}, start=self.time_1_dt, end=self.time_2_dt, rollup=3600
        )
        result = format_historical_data(
            data=data,
            query_columns=["p95_measurements_fid"],
            dataset=errors,
            organization=self.organization,
        )
        assert result == expected_return_value

    def test_anomaly_detection_fetch_historical_data(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": self.time_1_dt.isoformat(),
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
                "timestamp": self.time_2_dt.isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        result = fetch_historical_data(self.organization, snuba_query, ["count()"], self.project)
        assert result
        assert {"time": int(self.time_1_ts), "count": 1} in result.data.get("data")
        assert {"time": int(self.time_2_ts), "count": 1} in result.data.get("data")

    def test_anomaly_detection_fetch_historical_data_is_unresolved_query(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
        snuba_query.query = "is:unresolved"
        snuba_query.save()

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": self.time_1_dt.isoformat(),
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
                "timestamp": self.time_2_dt.isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
                "exception": [{"value": "BadError"}],
            },
            project_id=self.project.id,
        )
        result = fetch_historical_data(self.organization, snuba_query, ["count()"], self.project)
        assert result
        assert {"time": int(self.time_1_ts), "count": 1} in result.data.get("data")
        assert {"time": int(self.time_2_ts), "count": 1} in result.data.get("data")

    def test_anomaly_detection_fetch_historical_data_performance_alert(self):
        alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project], dataset=Dataset.Transactions
        )
        snuba_query = SnubaQuery.objects.get(id=alert_rule.snuba_query_id)
        event_data = get_event("n-plus-one-in-django-index-view")
        event_data["timestamp"] = self.time_1_ts
        event1 = self.create_performance_issue(event_data=make_event(**event_data))
        event_data["timestamp"] = self.time_2_ts

        event2 = self.create_performance_issue(event_data=make_event(**event_data))

        result = fetch_historical_data(self.organization, snuba_query, ["count()"], self.project)
        assert result
        assert {"time": int(event1.datetime.timestamp()), "count": 1} in result.data.get("data")
        assert {"time": int(event2.datetime.timestamp()), "count": 1} in result.data.get("data")

    def test_anomaly_detection_format_historical_data_crash_rate_alert(self):
        expected_return_value = [
            {"timestamp": self.time_1_ts, "value": 0},
            {"timestamp": self.time_2_ts, "value": 1},
        ]
        snuba_raw_data = {
            "groups": [
                {
                    "by": {"release": self.session_release},
                    "totals": {"sum(session)": 1},
                    "series": {"sum(session)": [0, 1]},
                }
            ],
            "start": self.time_1,
            "end": self.time_2,
            "intervals": [self.time_1, self.time_2],
        }
        data = SnubaTSResult({"data": snuba_raw_data}, self.time_1, self.time_2, 3600)
        result = format_historical_data(data, ["count()"], metrics_performance, self.organization)
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
        result = fetch_historical_data(self.organization, snuba_query, ["count()"], self.project)
        assert result
        assert self.time_1 in result.data.get("data").get("intervals")
        assert 1 in result.data.get("data").get("groups")[0].get("series").get("sum(session)")
