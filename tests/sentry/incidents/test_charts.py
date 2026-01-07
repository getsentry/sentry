import datetime
from unittest.mock import MagicMock, patch

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.api.serializers import serialize
from sentry.incidents.charts import (
    build_metric_alert_chart,
    fetch_metric_issue_open_periods,
    incident_date_range,
)
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializer,
    AlertRuleSerializerResponse,
)
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializer,
    DetailedIncidentSerializerResponse,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.incident import Incident, IncidentActivityType, IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, OpenPeriodContext
from sentry.incidents.utils.process_update_helpers import calculate_event_date_from_update_date
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import DetectorGroup
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest

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
    def test_eap_alert(self, mock_client_get: MagicMock, mock_generate_chart: MagicMock) -> None:
        mock_client_get.return_value.data = {"data": []}
        alert_rule = self.create_alert_rule(
            query="span.op:pageload",
            dataset=Dataset.EventsAnalyticsPlatform,
            aggregate="apdex(span.duration, 8000)",
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


class FetchOpenPeriodsTest(BaseMetricIssueTest):
    @freeze_time(frozen_time)
    @with_feature("organizations:incidents")
    def test_get_incidents_from_detector(self) -> None:
        self.create_detector()  # dummy so detector ID != alert rule ID
        detector = self.create_detector(project=self.project)
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        self.create_alert_rule_detector(detector=detector, alert_rule_id=alert_rule.id)
        incident = self.create_incident(
            date_started=must_parse_datetime("2022-05-16T18:55:00Z"),
            status=IncidentStatus.CRITICAL.value,
            alert_rule=alert_rule,
        )
        # create incident activity the same way we do in logic.py create_incident
        detected_activity = self.create_incident_activity(
            incident,
            IncidentActivityType.DETECTED.value,
            date_added=incident.date_started,
        )
        created_activity = self.create_incident_activity(
            incident,
            IncidentActivityType.CREATED.value,
        )

        time_period = incident_date_range(60, incident.date_started, incident.date_closed)

        chart_data = fetch_metric_issue_open_periods(self.organization, detector.id, time_period)
        assert chart_data[0]["alertRule"]["id"] == str(alert_rule.id)
        assert chart_data[0]["projects"] == [self.project.slug]
        assert chart_data[0]["dateStarted"] == incident.date_started

        assert len(chart_data[0]["activities"]) == 2
        detected_activity_resp = chart_data[0]["activities"][0]
        created_activity_resp = chart_data[0]["activities"][1]

        assert detected_activity_resp["incidentIdentifier"] == str(incident.identifier)
        assert detected_activity_resp["type"] == IncidentActivityType.DETECTED.value
        assert detected_activity_resp["dateCreated"] == detected_activity.date_added

        assert created_activity_resp["incidentIdentifier"] == str(incident.identifier)
        assert created_activity_resp["type"] == IncidentActivityType.CREATED.value
        assert created_activity_resp["dateCreated"] == created_activity.date_added

    @freeze_time(frozen_time)
    @with_feature("organizations:incidents")
    @with_feature("organizations:workflow-engine-ui")
    def test_use_open_period_serializer(self) -> None:
        detector = self.create_detector(project=self.project)
        group = self.create_group(type=MetricIssue.type_id, priority=PriorityLevel.HIGH)

        # Link detector to group
        DetectorGroup.objects.create(detector=detector, group=group)

        group_open_period = GroupOpenPeriod.objects.get(group=group)

        opened_gopa = GroupOpenPeriodActivity.objects.create(
            date_added=group_open_period.date_added,
            group_open_period=group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=group.priority,
        )

        time_period = incident_date_range(
            60, group_open_period.date_started, group_open_period.date_ended
        )

        chart_data = fetch_metric_issue_open_periods(self.organization, detector.id, time_period)

        assert chart_data[0]["id"] == str(group_open_period.id)
        assert chart_data[0]["start"] == group_open_period.date_started

        activities = chart_data[0]["activities"]
        assert activities[0]["id"] == str(opened_gopa.id)
        assert activities[0]["type"] == OpenPeriodActivityType(opened_gopa.type).to_str()
        assert activities[0]["value"] == PriorityLevel(group.priority).to_str()

    @freeze_time(frozen_time)
    @with_feature("organizations:incidents")
    @with_feature("organizations:workflow-engine-ui")
    def test_use_open_period_serializer_with_offset(self) -> None:
        group = self.create_group(type=MetricIssue.type_id, priority=PriorityLevel.HIGH)

        # Link detector to group
        DetectorGroup.objects.create(detector=self.detector, group=group)

        group_open_period = GroupOpenPeriod.objects.get(group=group)

        opened_gopa = GroupOpenPeriodActivity.objects.create(
            date_added=group_open_period.date_added,
            group_open_period=group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=group.priority,
        )

        time_period = incident_date_range(
            60, group_open_period.date_started, group_open_period.date_ended
        )

        chart_data = fetch_metric_issue_open_periods(
            self.organization,
            self.detector.id,
            time_period,
            time_window=self.snuba_query.time_window,
        )

        assert chart_data[0]["id"] == str(group_open_period.id)
        assert chart_data[0]["start"] == calculate_event_date_from_update_date(
            group_open_period.date_started, self.snuba_query.time_window
        )

        activities = chart_data[0]["activities"]
        assert activities[0]["id"] == str(opened_gopa.id)
        assert activities[0]["type"] == OpenPeriodActivityType(opened_gopa.type).to_str()
        assert activities[0]["value"] == PriorityLevel(group.priority).to_str()
