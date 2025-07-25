import datetime
from unittest.mock import patch

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.api.serializers import serialize
from sentry.incidents.charts import build_metric_alert_chart, incident_date_range
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializer,
    AlertRuleSerializerResponse,
)
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializer,
    DetailedIncidentSerializerResponse,
)
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.incident import Incident
from sentry.incidents.typings.metric_detector import AlertContext, OpenPeriodContext
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

now = "2022-05-16T20:00:00"
frozen_time = f"{now}Z"


def must_parse_datetime(s: str) -> datetime.datetime:
    ret = parse_datetime(s)
    assert ret is not None
    return ret


class IncidentDateRangeTest(TestCase):
    @freeze_time(frozen_time)
    def test_use_current_date_for_active_incident(self) -> None:
        incident = Incident(
            date_started=must_parse_datetime("2022-05-16T18:55:00Z"), date_closed=None
        )
        assert incident_date_range(60, incident.date_started, incident.date_closed) == {
            "start": "2022-05-16T17:40:00",
            "end": now,
        }

    @freeze_time(frozen_time)
    def test_use_current_date_for_recently_closed_alert(self) -> None:
        incident = Incident(
            date_started=must_parse_datetime("2022-05-16T18:55:00Z"),
            date_closed=must_parse_datetime("2022-05-16T18:57:00Z"),
        )
        assert incident_date_range(60, incident.date_started, incident.date_closed) == {
            "start": "2022-05-16T17:40:00",
            "end": now,
        }

    @freeze_time(frozen_time)
    def test_use_a_past_date_for_an_older_alert(self) -> None:
        #  Incident is from over a week ago
        incident = Incident(
            date_started=must_parse_datetime("2022-05-04T18:55:00Z"),
            date_closed=must_parse_datetime("2022-05-04T18:57:00Z"),
        )
        assert incident_date_range(60, incident.date_started, incident.date_closed) == {
            "start": "2022-05-04T17:40:00",
            "end": "2022-05-04T20:12:00",
        }

    @freeze_time(frozen_time)
    def test_large_time_windows(self) -> None:
        incident = Incident(
            date_started=must_parse_datetime("2022-04-20T20:28:00Z"),
            date_closed=None,
        )
        one_day = 1440 * 60
        assert incident_date_range(one_day, incident.date_started, incident.date_closed) == {
            "start": "2022-02-04T20:28:00",
            "end": now,
        }


class BuildMetricAlertChartTest(TestCase):
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    @patch("sentry.incidents.charts.client.get")
    def test_eap_alert(self, mock_client_get, mock_generate_chart):
        mock_client_get.return_value.data = {"data": []}
        alert_rule = self.create_alert_rule(
            query="span.op:pageload", dataset=Dataset.EventsAnalyticsPlatform
        )
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - datetime.timedelta(minutes=2),
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        alert_rule_serialized_response: AlertRuleSerializerResponse = serialize(
            alert_rule, None, AlertRuleSerializer()
        )
        incident_serialized_response: DetailedIncidentSerializerResponse = serialize(
            incident, None, DetailedIncidentSerializer()
        )

        url = build_metric_alert_chart(
            self.organization,
            alert_rule_serialized_response=alert_rule_serialized_response,
            alert_context=AlertContext.from_alert_rule_incident(alert_rule),
            snuba_query=alert_rule.snuba_query,
            open_period_context=OpenPeriodContext.from_incident(incident),
            selected_incident_serialized=incident_serialized_response,
        )

        assert url == "chart-url"
        mock_client_get.assert_called()
        mock_generate_chart.assert_called()
        assert mock_client_get.call_args[1]["params"]["dataset"] == "spans"
        assert mock_client_get.call_args[1]["params"]["query"] == "span.op:pageload"
