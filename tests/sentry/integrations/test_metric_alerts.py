import uuid

import pytest

from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.metric_alerts import (
    format_aggregate,
    get_incident_status_text,
    incident_attachment_info,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQueryEventType
from sentry.testutils.cases import BaseIncidentsTest, TestCase

pytestmark = pytest.mark.sentry_metrics


class GetIncidentStatusTextTest(TestCase, BaseIncidentsTest):
    def test_formats_failure_rate_as_percentage_with_two_decimal_places(self) -> None:
        alert_rule = self.create_alert_rule(
            dataset=Dataset.Transactions,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            aggregate="failure_rate()",
        )

        assert (
            get_incident_status_text(
                alert_rule.snuba_query,
                None,
                "0.123456",
            )
            == "failure_rate() of transactions was 12.35% in the last 10 minutes"
        )

    def test_formats_failure_rate_as_percentage_for_comparison_alert(self) -> None:
        alert_rule = self.create_alert_rule(
            dataset=Dataset.Transactions,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            aggregate="failure_rate()",
            detection_type=AlertRuleDetectionType.PERCENT,
            comparison_delta=60,
        )

        assert (
            get_incident_status_text(
                alert_rule.snuba_query,
                alert_rule.comparison_delta,
                "112.3456",
            )
            == "failure_rate() of transactions was 12.35% higher in the last 10 minutes compared to the same time one hour ago"
        )

    def test_comparison_alert_states_change_from_comparison_value(self) -> None:
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.PERCENT, comparison_delta=60
        )
        for value, expected in (("150", "50% higher"), ("60", "40% lower"), ("100", "0% higher")):
            assert (
                get_incident_status_text(alert_rule.snuba_query, alert_rule.comparison_delta, value)
                == f"count() of errors was {expected} in the last 10 minutes compared to the same time one hour ago"
            )

    def test_comparison_alert_skips_mri_unit_formatting(self) -> None:
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.PERCENT, comparison_delta=60
        )
        snuba_query = alert_rule.snuba_query
        snuba_query.aggregate = "sum(d:spans/exclusive_time@millisecond)"

        text = get_incident_status_text(snuba_query, alert_rule.comparison_delta, "200")
        assert text.endswith(
            " of spans was 100% higher in the last 10 minutes compared to the same time one hour ago"
        )

    def test_names_aggregate_and_telemetry(self) -> None:
        for dataset, event_types, aggregate, expected in (
            (
                Dataset.Events,
                [SnubaQueryEventType.EventType.ERROR],
                "count()",
                "count() of errors was 14",
            ),
            (
                Dataset.Events,
                [SnubaQueryEventType.EventType.ERROR],
                "count_unique(tags[sentry:user])",
                "count_unique(user) of errors was 14",
            ),
            (
                Dataset.Transactions,
                [SnubaQueryEventType.EventType.TRANSACTION],
                "count()",
                "count() of transactions was 14",
            ),
            (
                Dataset.EventsAnalyticsPlatform,
                [SnubaQueryEventType.EventType.TRACE_ITEM_LOG],
                "count(message)",
                "count(message) of logs was 14",
            ),
            (
                Dataset.EventsAnalyticsPlatform,
                [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN],
                "count(span.duration)",
                "count(span.duration) of spans was 14",
            ),
            (
                Dataset.EventsAnalyticsPlatform,
                [SnubaQueryEventType.EventType.TRACE_ITEM_METRIC],
                "p95(value,request.latency,distribution,millisecond)",
                "p95(request.latency) of application metrics was 14",
            ),
            (
                Dataset.EventsAnalyticsPlatform,
                [SnubaQueryEventType.EventType.TRACE_ITEM_METRIC],
                "equation|sum(value,request.errors,counter,-) / count(value,request.count,counter,-)",
                "sum(request.errors) / count(request.count) of application metrics was 14",
            ),
            (
                Dataset.Metrics,
                [],
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                "crash_free_rate(session) of sessions was 14%",
            ),
        ):
            alert_rule = self.create_alert_rule(
                dataset=dataset, event_types=event_types, aggregate=aggregate
            )
            assert (
                get_incident_status_text(alert_rule.snuba_query, None, "14")
                == f"{expected} in the last 10 minutes"
            )


@pytest.mark.parametrize(
    ("aggregate", "expected"),
    [
        ("per_second(value,my.metric,counter,-)", "per_second(my.metric)"),
        ("avg(value,request.latency,distribution,millisecond)", "avg(request.latency)"),
        (
            'count_if(`agent_name:"Agent Run"`,value,agent.runs,distribution,none)',
            'count_if(`agent_name:"Agent Run"`,agent.runs)',
        ),
        (
            "equation|per_second(value,my.metric,counter,-) * 2 + avg(value,request.latency,distribution,millisecond)",
            "per_second(my.metric) * 2 + avg(request.latency)",
        ),
        ("count()", "count()"),
    ],
)
def test_format_aggregate_names_trace_metrics(aggregate: str, expected: str) -> None:
    assert format_aggregate(aggregate, trace_metric=True) == expected


def test_format_aggregate_keeps_other_aggregates_raw() -> None:
    assert format_aggregate("p95(span.duration)") == "p95(span.duration)"
    assert format_aggregate("count_if(span.op,equals,db)") == "count_if(span.op,equals,db)"


class IncidentAttachmentInfoTest(TestCase, BaseIncidentsTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(type=MetricIssue.type_id)

    def test_returns_correct_info_with_workflow_engine_dual_write(self) -> None:
        """
        This tests that we look up the correct incident and alert rule during dual write ACI migration.
        """
        alert_rule = self.create_alert_rule()
        metric_value = 123
        referrer = "metric_alert_custom"
        notification_uuid = str(uuid.uuid4())

        detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=alert_rule.id, detector=detector)

        open_period = (
            GroupOpenPeriod.objects.filter(group=self.group).order_by("-date_started").first()
        )
        assert open_period is not None
        mapping = self.create_incident_group_open_period(
            group_open_period=open_period, incident_id=123, incident_identifier=42
        )

        metric_issue_context = MetricIssueContext(
            id=self.group.id,
            open_period_identifier=open_period.id,
            snuba_query=alert_rule.snuba_query,
            subscription=None,
            new_status=IncidentStatus.CLOSED,
            metric_value=metric_value,
            group=self.group,
            title=self.group.title,
        )

        data = incident_attachment_info(
            organization=self.organization,
            alert_context=AlertContext(
                name=alert_rule.name,
                # Setting the action identifier id to the detector id since that's what the NOA does
                action_identifier_id=detector.id,
                threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
                detection_type=AlertRuleDetectionType(alert_rule.detection_type),
                comparison_delta=alert_rule.comparison_delta,
                sensitivity=alert_rule.sensitivity,
                resolve_threshold=alert_rule.resolve_threshold,
                alert_threshold=None,
            ),
            metric_issue_context=metric_issue_context,
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "count() of errors was 123 in the last 10 minutes"
        # We still build the link using the alert_rule_id and the incident identifier
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={mapping.incident_identifier}&referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_returns_correct_info_placeholder_incident(self) -> None:
        """
        Test that we use the fake incident ID to build the title link if no IGOP entry exists (if the detector was not dual written).
        """
        alert_rule = self.create_alert_rule()
        metric_value = 123
        referrer = "metric_alert_custom"
        notification_uuid = str(uuid.uuid4())

        detector = self.create_detector(project=self.project)

        open_period = (
            GroupOpenPeriod.objects.filter(group=self.group).order_by("-date_started").first()
        )
        assert open_period is not None

        metric_issue_context = MetricIssueContext(
            id=self.group.id,
            open_period_identifier=open_period.id,
            snuba_query=alert_rule.snuba_query,
            subscription=None,
            new_status=IncidentStatus.CLOSED,
            metric_value=metric_value,
            group=self.group,
            title=self.group.title,
        )

        # XXX: for convenience, we populate the AlertContext with alert rule/incident information. In this test,
        # we're just interested in how the method handles missing AlertRuleDetectors/IGOPs.
        data = incident_attachment_info(
            organization=self.organization,
            alert_context=AlertContext(
                name=alert_rule.name,
                # Setting the action identifier id to the detector id since that's what the NOA does
                action_identifier_id=detector.id,
                threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
                detection_type=AlertRuleDetectionType(alert_rule.detection_type),
                comparison_delta=alert_rule.comparison_delta,
                sensitivity=alert_rule.sensitivity,
                resolve_threshold=alert_rule.resolve_threshold,
                alert_threshold=None,
            ),
            metric_issue_context=metric_issue_context,
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        fake_alert_rule_id = get_fake_id_from_object_id(detector.id)
        fake_incident_identifier = get_fake_id_from_object_id(open_period.id)

        # Build the link using the fake alert_rule_id and the fake incident identifier
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{fake_alert_rule_id}/?alert={fake_incident_identifier}&referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
