from unittest.mock import patch

import responses
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from exam import fixture
from freezegun import freeze_time

from sentry.incidents.action_handlers import (
    EmailActionHandler,
    generate_incident_trigger_email_context,
)
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentStatus,
    TriggerStatus,
)
from sentry.models import NotificationSetting, UserEmail, UserOption
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

from . import FireTest


@freeze_time()
class EmailActionHandlerTest(FireTest, TestCase):
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


class EmailActionHandlerGetTargetsTest(TestCase):
    @fixture
    def incident(self):
        return self.create_incident()

    def test_user(self):
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, self.user.email)]

    def test_user_alerts_disabled(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
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

    def test_team_alert_disabled(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )
        disabled_user = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=disabled_user,
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
        UserOption.objects.create(
            user=self.user, project=self.project, key="mail:email", value=new_email
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

        useremail = UserEmail.objects.get(email=self.user.email)
        useremail.email = new_email
        useremail.save()

        UserOption.objects.create(
            user=self.user, project=self.project, key="mail:email", value=new_email
        )
        UserOption.objects.create(
            user=new_user, project=self.project, key="mail:email", value=new_email
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
    def test(self):
        trigger_status = TriggerStatus.ACTIVE
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action(triggered_for_incident=incident)
        aggregate = action.alert_rule_trigger.alert_rule.snuba_query.aggregate
        expected = {
            "link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "rule_link": absolute_uri(
                reverse(
                    "sentry-alert-rule",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "project_slug": self.project.slug,
                        "alert_rule_id": action.alert_rule_trigger.alert_rule_id,
                    },
                )
            ),
            "incident_name": incident.title,
            "aggregate": aggregate,
            "query": action.alert_rule_trigger.alert_rule.snuba_query.query,
            "threshold": action.alert_rule_trigger.alert_threshold,
            "status": INCIDENT_STATUS[IncidentStatus(incident.status)],
            "status_key": INCIDENT_STATUS[IncidentStatus(incident.status)].lower(),
            "environment": "All",
            "is_critical": False,
            "is_warning": False,
            "threshold_direction_string": ">",
            "time_window": "10 minutes",
            "triggered_at": timezone.now(),
            "project_slug": self.project.slug,
            "unsubscribe_link": None,
            "chart_url": None,
        }
        assert expected == generate_incident_trigger_email_context(
            self.project,
            incident,
            action.alert_rule_trigger,
            trigger_status,
            IncidentStatus(incident.status),
        )

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
        assert generated_email_context["threshold_direction_string"] == "<"

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
        assert generated_email_context["threshold_direction_string"] == "<"
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
        assert generated_email_context["threshold_direction_string"] == ">"

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

    @patch("sentry.incidents.charts.generate_chart", return_value="chart-url")
    def test_metric_chart(self, mock_generate_chart):
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
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        assert mock_generate_chart.call_args[1]["size"] == {"width": 600, "height": 200}
