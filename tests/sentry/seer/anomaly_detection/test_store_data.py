from datetime import datetime

from sentry.seer.anomaly_detection.store_data import fetch_historical_data, format_historical_data
from sentry.seer.anomaly_detection.types import SnubaQueryData
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.snuba import SnubaTSResult
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase


class AnomalyDetectionStoreDataTest(AlertRuleBase, SnubaTestCase):
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
        result = format_historical_data(data)
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
        snuba_query_data = SnubaQueryData(
            query=snuba_query.query,
            time_window=snuba_query.time_window,
            dataset=snuba_query.dataset,
            aggregate=snuba_query.aggregate,
        )
        result = fetch_historical_data(snuba_query_data, self.project.id, self.organization.id)
        assert result
        assert {"time": int(datetime.timestamp(time_1)), "count": 1} in result.data.get("data")
        assert {"time": int(datetime.timestamp(time_2)), "count": 1} in result.data.get("data")
