from functools import cached_property
from unittest.mock import patch

import orjson
import pytest
import responses
from django.conf import settings
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from urllib3.response import HTTPResponse

from sentry.incidents.action_handlers import (
    EmailActionHandler,
    generate_incident_trigger_email_context,
)
from sentry.incidents.charts import fetch_metric_alert_events_timeseries
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleMonitorTypeInt,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus, TriggerStatus
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail

from . import FireTest

pytestmark = pytest.mark.sentry_metrics


@freeze_time()
class EmailActionHandlerTest(FireTest):
    @responses.activate
    def run_test(self, incident, method):
        action = self.create_alert_rule_trigger_action(
            target_identifier=str(self.user.id),
            triggered_for_incident=incident,
        )
        handler = EmailActionHandler(action, incident, self.project)
        with self.tasks():
            handler.fire(1000, IncidentStatus(incident.status))
        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == "[{}] {} - {}".format(
            INCIDENT_STATUS[IncidentStatus(incident.status)], incident.title, self.project.slug
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

    @patch("sentry.analytics.record")
    def test_alert_sent_recorded(self, mock_record):
        self.run_fire_test()
        mock_record.assert_called_with(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider="email",
            alert_id=self.alert_rule.id,
            alert_type="metric_alert",
            external_id=str(self.user.id),
            notification_uuid="",
        )


class EmailActionHandlerGetTargetsTest(TestCase):
    @cached_property
    def incident(self):
        return self.create_incident()

    def test_user(self):
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, self.user.email)]

    def test_rule_snoozed_by_user(self):
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )

        handler = EmailActionHandler(action, self.incident, self.project)
        self.snooze_rule(user_id=self.user.id, alert_rule=self.incident.alert_rule)
        assert handler.get_targets() == []

    def test_user_rule_snoozed(self):
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        self.snooze_rule(alert_rule=self.incident.alert_rule)
        assert handler.get_targets() == []

    def test_user_alerts_disabled(self):
        with assume_test_silo_mode_of(NotificationSettingOption):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="project",
                scope_identifier=self.project.id,
                type="alerts",
                value="never",
            )
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, self.user.email)]

    def test_team(self):
        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert set(handler.get_targets()) == {
            (self.user.id, self.user.email),
            (new_user.id, new_user.email),
        }

    def test_rule_snoozed_by_one_user_in_team(self):
        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        self.snooze_rule(user_id=new_user.id, alert_rule=self.incident.alert_rule)
        assert set(handler.get_targets()) == {
            (self.user.id, self.user.email),
        }

    def test_team_rule_snoozed(self):
        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        self.snooze_rule(alert_rule=self.incident.alert_rule)
        assert handler.get_targets() == []

    def test_team_alert_disabled(self):
        with assume_test_silo_mode_of(NotificationSettingOption):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="project",
                scope_identifier=self.project.id,
                type="alerts",
                value="never",
            )
            disabled_user = self.create_user()
            NotificationSettingOption.objects.create(
                user_id=disabled_user.id,
                scope_type="user",
                scope_identifier=disabled_user.id,
                type="alerts",
                value="never",
            )

        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert set(handler.get_targets()) == {(new_user.id, new_user.email)}

    def test_user_email_routing(self):
        new_email = "marcos@sentry.io"
        with assume_test_silo_mode_of(UserOption):
            UserOption.objects.create(
                user=self.user, project_id=self.project.id, key="mail:email", value=new_email
            )

            useremail = UserEmail.objects.get(email=self.user.email)
            useremail.email = new_email
            useremail.save()

        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, new_email)]

    def test_team_email_routing(self):
        new_email = "marcos@sentry.io"

        new_user = self.create_user(new_email)

        with assume_test_silo_mode_of(UserEmail):
            useremail = UserEmail.objects.get(email=self.user.email)
            useremail.email = new_email
            useremail.save()

            UserOption.objects.create(
                user=self.user, project_id=self.project.id, key="mail:email", value=new_email
            )
            UserOption.objects.create(
                user=new_user, project_id=self.project.id, key="mail:email", value=new_email
            )

        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert set(handler.get_targets()) == {
            (self.user.id, new_email),
            (new_user.id, new_email),
        }


@freeze_time()
class EmailActionHandlerGenerateEmailContextTest(TestCase):
    def test_simple(self):
        trigger_status = TriggerStatus.ACTIVE
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)
        aggregate = action.alert_rule_trigger.alert_rule.snuba_query.aggregate
        alert_link = self.organization.absolute_url(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            ),
            query="referrer=metric_alert_email",
        )
        expected = {
            "link": alert_link,
            "incident_name": incident.title,
            "aggregate": aggregate,
            "query": action.alert_rule_trigger.alert_rule.snuba_query.query,
            "threshold": action.alert_rule_trigger.alert_threshold,
            "status": INCIDENT_STATUS[IncidentStatus(incident.status)],
            "status_key": INCIDENT_STATUS[IncidentStatus(incident.status)].lower(),
            "environment": "All",
            "is_critical": False,
            "is_warning": False,
            "threshold_prefix_string": ">",
            "time_window": "10 minutes",
            "triggered_at": timezone.now(),
            "project_slug": self.project.slug,
            "unsubscribe_link": None,
            "chart_url": None,
            "timezone": settings.SENTRY_DEFAULT_TIME_ZONE,
            "snooze_alert": True,
            "snooze_alert_url": alert_link + "&mute=1",
            "monitor_type": 0,
            "activator": "",
            "condition_type": None,
        }
        assert expected == generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
        )

    def test_with_activated_alert(self):
        trigger_status = TriggerStatus.ACTIVE
        alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.ACTIVATED)
        alert_rule.subscribe_projects(
            projects=[self.project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
            activator="testing",
        )
        activations = alert_rule.activations.all()
        incident = self.create_incident(alert_rule=alert_rule, activation=activations[0])
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger, triggered_for_incident=incident
        )
        aggregate = action.alert_rule_trigger.alert_rule.snuba_query.aggregate
        alert_link = self.organization.absolute_url(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            ),
            query="referrer=metric_alert_email",
        )
        expected = {
            "link": alert_link,
            "incident_name": incident.title,
            "aggregate": aggregate,
            "query": action.alert_rule_trigger.alert_rule.snuba_query.query,
            "threshold": action.alert_rule_trigger.alert_threshold,
            "status": INCIDENT_STATUS[IncidentStatus(incident.status)],
            "status_key": INCIDENT_STATUS[IncidentStatus(incident.status)].lower(),
            "environment": "All",
            "is_critical": False,
            "is_warning": False,
            "threshold_prefix_string": ">",
            "time_window": "10 minutes",
            "triggered_at": timezone.now(),
            "project_slug": self.project.slug,
            "unsubscribe_link": None,
            "chart_url": None,
            "timezone": settings.SENTRY_DEFAULT_TIME_ZONE,
            "snooze_alert": True,
            "snooze_alert_url": alert_link + "&mute=1",
            "monitor_type": AlertRuleMonitorTypeInt.ACTIVATED,
            "activator": "testing",
            "condition_type": AlertRuleActivationConditionType.DEPLOY_CREATION.value,
        }
        assert expected == generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_dynamic_alert(self, mock_seer_request):

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        trigger_status = TriggerStatus.ACTIVE
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
        )
        incident = self.create_incident(alert_rule=alert_rule)
        alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, alert_threshold=0
        )
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger, triggered_for_incident=incident
        )
        aggregate = action.alert_rule_trigger.alert_rule.snuba_query.aggregate
        alert_link = self.organization.absolute_url(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            ),
            query="?referrer=metric_alert_email&type=anomaly_detection",
        )
        expected = {
            "link": alert_link,
            "incident_name": incident.title,
            "aggregate": aggregate,
            "query": action.alert_rule_trigger.alert_rule.snuba_query.query,
            "threshold": f"({alert_rule.sensitivity} responsiveness)",
            "status": INCIDENT_STATUS[IncidentStatus(incident.status)],
            "status_key": INCIDENT_STATUS[IncidentStatus(incident.status)].lower(),
            "environment": "All",
            "is_critical": False,
            "is_warning": False,
            "threshold_prefix_string": "Dynamic",
            "time_window": "30 minutes",
            "triggered_at": timezone.now(),
            "project_slug": self.project.slug,
            "unsubscribe_link": None,
            "chart_url": None,
            "timezone": settings.SENTRY_DEFAULT_TIME_ZONE,
            "snooze_alert": True,
            "snooze_alert_url": alert_link + "&mute=1",
            "monitor_type": 0,
            "activator": "",
            "condition_type": None,
        }
        assert expected == generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
        )

    @with_feature("system:multi-region")
    def test_links_customer_domains(self):
        trigger_status = TriggerStatus.ACTIVE
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)
        result = generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
        )
        path = reverse(
            "sentry-metric-alert",
            kwargs={
                "organization_slug": self.organization.slug,
                "incident_id": incident.identifier,
            },
        )
        assert self.organization.absolute_url(path) in result["link"]

    def test_resolve(self):
        status = TriggerStatus.RESOLVED
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)
        generated_email_context = generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            status,
            IncidentStatus.CLOSED,
        )
        assert generated_email_context["threshold"] == 100
        assert generated_email_context["threshold_prefix_string"] == "<"

    def test_resolve_critical_trigger_with_warning(self):
        status = TriggerStatus.RESOLVED
        rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=rule)
        crit_trigger = self.create_alert_rule_trigger(rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(crit_trigger, triggered_for_incident=incident)
        self.create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 50)
        generated_email_context = generate_incident_trigger_email_context(
            self.project,
            incident,
            crit_trigger,
            status,
            IncidentStatus.WARNING,
        )
        assert generated_email_context["threshold"] == 100
        assert generated_email_context["threshold_prefix_string"] == "<"
        assert not generated_email_context["is_critical"]
        assert generated_email_context["is_warning"]
        assert generated_email_context["status"] == "Warning"
        assert generated_email_context["status_key"] == "warning"

    def test_context_for_crash_rate_alert(self):
        """
        Test that ensures the metric name for Crash rate alerts excludes the alias
        """
        status = TriggerStatus.ACTIVE
        incident = self.create_incident()
        alert_rule = self.create_alert_rule(
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        )
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger, triggered_for_incident=incident
        )
        assert (
            generate_incident_trigger_email_context(
                self.project, incident, action.alert_rule_trigger, status, IncidentStatus.CRITICAL
            )["aggregate"]
            == "percentage(sessions_crashed, sessions)"
        )

    def test_context_for_resolved_crash_rate_alert(self):
        """
        Test that ensures the resolved notification contains the correct threshold string
        """
        status = TriggerStatus.RESOLVED
        incident = self.create_incident()
        alert_rule = self.create_alert_rule(
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            threshold_type=AlertRuleThresholdType.BELOW,
            query="",
        )
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger, triggered_for_incident=incident
        )
        generated_email_context = generate_incident_trigger_email_context(
            self.project, incident, action.alert_rule_trigger, status, IncidentStatus.CLOSED
        )
        assert generated_email_context["aggregate"] == "percentage(sessions_crashed, sessions)"
        assert generated_email_context["threshold"] == 100
        assert generated_email_context["threshold_prefix_string"] == ">"

    def test_environment(self):
        status = TriggerStatus.ACTIVE
        environments = [
            self.create_environment(project=self.project, name="prod"),
            self.create_environment(project=self.project, name="dev"),
        ]
        alert_rule = self.create_alert_rule(environment=environments[0])
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger, triggered_for_incident=incident
        )
        assert "prod" == generate_incident_trigger_email_context(
            self.project, incident, action.alert_rule_trigger, status, IncidentStatus.CRITICAL
        ).get("environment")

    @patch(
        "sentry.incidents.charts.fetch_metric_alert_events_timeseries",
        side_effect=fetch_metric_alert_events_timeseries,
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_metric_chart(self, mock_generate_chart, mock_fetch_metric_alert_events_timeseries):
        trigger_status = TriggerStatus.ACTIVE
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:discover-basic",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            result = generate_incident_trigger_email_context(
                self.project,
                incident,
                action.alert_rule_trigger,
                trigger_status,
                IncidentStatus(incident.status),
            )
        assert result["chart_url"] == "chart-url"
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(incident.alert_rule.id)
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        assert mock_fetch_metric_alert_events_timeseries.call_args[0][2]["dataset"] == "errors"
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        assert mock_generate_chart.call_args[1]["size"] == {"width": 600, "height": 200}

    @patch(
        "sentry.incidents.charts.fetch_metric_alert_events_timeseries",
        side_effect=fetch_metric_alert_events_timeseries,
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_metric_chart_mep(self, mock_generate_chart, mock_fetch_metric_alert_events_timeseries):
        indexer.record(
            use_case_id=UseCaseID.TRANSACTIONS, org_id=self.organization.id, string="level"
        )
        trigger_status = TriggerStatus.ACTIVE
        alert_rule = self.create_alert_rule(
            query_type=SnubaQuery.Type.PERFORMANCE, dataset=Dataset.PerformanceMetrics
        )
        incident = self.create_incident(alert_rule=alert_rule)
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:discover-basic",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            result = generate_incident_trigger_email_context(
                self.project,
                incident,
                action.alert_rule_trigger,
                trigger_status,
                IncidentStatus(incident.status),
            )
        assert result["chart_url"] == "chart-url"
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(incident.alert_rule.id)
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        assert mock_fetch_metric_alert_events_timeseries.call_args[0][2]["dataset"] == "metrics"
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        assert mock_generate_chart.call_args[1]["size"] == {"width": 600, "height": 200}

    def test_timezones(self):
        trigger_status = TriggerStatus.ACTIVE
        alert_rule = self.create_alert_rule(
            query_type=SnubaQuery.Type.PERFORMANCE, dataset=Dataset.PerformanceMetrics
        )
        incident = self.create_incident(alert_rule=alert_rule)
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)

        est = "America/New_York"
        pst = "US/Pacific"
        with assume_test_silo_mode_of(UserOption):
            UserOption.objects.set_value(user=self.user, key="timezone", value=est)
        result = generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
            self.user,
        )
        assert result["timezone"] == est

        with assume_test_silo_mode_of(UserOption):
            UserOption.objects.set_value(user=self.user, key="timezone", value=pst)
        result = generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
            self.user,
        )
        assert result["timezone"] == pst
