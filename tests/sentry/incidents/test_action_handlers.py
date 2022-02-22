import time
from urllib.parse import parse_qs

import responses
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from exam import fixture
from freezegun import freeze_time

from sentry.incidents.action_handlers import (
    EmailActionHandler,
    MsTeamsActionHandler,
    PagerDutyActionHandler,
    SentryAppActionHandler,
    SlackActionHandler,
    generate_incident_trigger_email_context,
)
from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    WARNING_TRIGGER_LABEL,
    update_incident_status,
)
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentStatus,
    IncidentStatusMethod,
    TriggerStatus,
)
from sentry.models import Integration, NotificationSetting, PagerDutyService, UserEmail, UserOption
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.http import absolute_uri


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


class FireTest:
    def run_test(self, incident, method):
        raise NotImplementedError

    def run_fire_test(self, method="fire"):
        self.alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        if method == "resolve":
            update_incident_status(
                incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
            )
        self.run_test(incident, method)


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


@freeze_time()
class SlackActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.slack.message_builder.incidents import build_incident_attachment

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )
        integration.add_organization(self.organization, self.user)
        channel_id = "some_id"
        channel_name = "#hello"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = parse_qs(responses.calls[1].request.body)
        assert data["channel"] == [channel_id]
        assert data["token"] == [token]
        assert json.loads(data["attachments"][0])[0] == build_incident_attachment(
            incident, metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")


@freeze_time()
class SlackWorkspaceActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.slack.message_builder.incidents import build_incident_attachment

        token = "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )
        integration.add_organization(self.organization, self.user)
        channel_id = "some_id"
        channel_name = "#hello"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = parse_qs(responses.calls[1].request.body)
        assert data["channel"] == [channel_id]
        assert data["token"] == [token]
        assert json.loads(data["attachments"][0])[0] == build_incident_attachment(
            incident, metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_fire_metric_alert_with_missing_integration(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        action = AlertRuleTriggerAction.objects.create(
            alert_rule_trigger=self.create_alert_rule_trigger(),
            type=AlertRuleTriggerAction.Type.SLACK.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="some_id",
            target_display="#hello",
            integration=integration,
            sentry_app=None,
        )
        integration.delete()
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")


@freeze_time()
class MsTeamsActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.msteams.card_builder import build_incident_attachment

        integration = Integration.objects.create(
            provider="msteams",
            name="Galactic Empire",
            external_id="D4r7h_Pl4gu315_th3_w153",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "d4rk51d3",
                "expires_at": int(time.time()) + 86400,
            },
        )
        integration.add_organization(self.organization, self.user)

        channel_id = "d_s"
        channel_name = "Death Star"
        channels = [{"id": channel_id, "name": channel_name}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/teams/D4r7h_Pl4gu315_th3_w153/conversations",
            json={"conversations": channels},
        )

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.MSTEAMS,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/d_s/activities",
            status=200,
            json={},
        )

        handler = MsTeamsActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = json.loads(responses.calls[1].request.body)

        assert data["attachments"][0]["content"] == build_incident_attachment(
            incident, IncidentStatus(incident.status), metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()


@freeze_time()
class PagerDutyActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.integration_key = "pfc73e8cb4s44d519f3d63d45b5q77g9"
        service = [
            {
                "type": "service",
                "integration_key": self.integration_key,
                "service_id": "123",
                "service_name": "hellboi",
            }
        ]
        self.integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"service": service},
        )
        self.integration.add_organization(self.organization, self.user)

        self.service = PagerDutyService.objects.create(
            service_name=service[0]["service_name"],
            integration_key=service[0]["integration_key"],
            organization_integration=self.integration.organizationintegration_set.first(),
        )

    def test_build_incident_attachment(self):
        from sentry.integrations.pagerduty.utils import build_incident_attachment

        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule)
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        self.create_alert_rule_trigger_action(
            target_identifier=self.service.id,
            type=AlertRuleTriggerAction.Type.PAGERDUTY,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )
        metric_value = 1000
        data = build_incident_attachment(
            incident, self.integration_key, IncidentStatus(incident.status), metric_value
        )

        assert data["routing_key"] == self.integration_key
        assert data["event_action"] == "trigger"
        assert data["dedup_key"] == f"incident_{incident.organization_id}_{incident.identifier}"
        assert data["payload"]["summary"] == alert_rule.name
        assert data["payload"]["severity"] == "critical"
        assert data["payload"]["source"] == str(incident.identifier)
        assert data["payload"]["custom_details"] == {
            "details": "1000 events in the last 10 minutes\nFilter: level:error"
        }
        assert data["links"][0]["text"] == f"Critical: {alert_rule.name}"
        assert data["links"][0]["href"] == "http://testserver/organizations/baz/alerts/1/"

    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.pagerduty.utils import build_incident_attachment

        action = self.create_alert_rule_trigger_action(
            target_identifier=self.service.id,
            type=AlertRuleTriggerAction.Type.PAGERDUTY,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )

        responses.add(
            method=responses.POST,
            url="https://events.pagerduty.com/v2/enqueue/",
            json={},
            status=202,
            content_type="application/json",
        )
        handler = PagerDutyActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body

        assert json.loads(data) == build_incident_attachment(
            incident, self.service.integration_key, IncidentStatus(incident.status), metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_fire_metric_alert_multiple_services(self):
        service = [
            {
                "type": "service",
                "integration_key": "afc73e8cb4s44d519f3d63d45b5q77g9",
                "service_id": "456",
                "service_name": "meowmeowfuntime",
            },
        ]
        PagerDutyService.objects.create(
            service_name=service[0]["service_name"],
            integration_key=service[0]["integration_key"],
            organization_integration=self.integration.organizationintegration_set.first(),
        )
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")


@freeze_time()
class SentryAppActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        action = self.create_alert_rule_trigger_action(
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
        )

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        handler = SentryAppActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(incident, IncidentStatus(incident.status), metric_value)
            )
            in data
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")


@freeze_time()
class SentryAppAlerRuleUIComponentActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        trigger = self.create_alert_rule_trigger(self.alert_rule, "hi", 1000)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            sentry_app_config=[
                {"name": "channel", "value": "#santry"},
                {"name": "workspace_name", "value": "santrysantrysantry"},
                {"name": "tag", "value": "triage"},
                {"name": "assignee", "value": "Nisanthan Nanthakumar"},
                {"name": "teamId", "value": 1},
            ],
        )

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        handler = SentryAppActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(incident, IncidentStatus(incident.status), metric_value)
            )
            in data
        )
        # Check that the Alert Rule UI Component settings are returned
        assert json.loads(data)["data"]["metric_alert"]["alert_rule"]["triggers"][0]["actions"][0][
            "settings"
        ] == [
            {"name": "channel", "value": "#santry"},
            {"name": "workspace_name", "value": "santrysantrysantry"},
            {"name": "tag", "value": "triage"},
            {"name": "assignee", "value": "Nisanthan Nanthakumar"},
            {"name": "teamId", "value": 1},
        ]

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")
