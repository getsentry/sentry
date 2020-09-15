from __future__ import absolute_import

import responses
import six
import time

from django.core import mail
from django.core.urlresolvers import reverse
from django.utils import timezone
from exam import fixture
from freezegun import freeze_time
from six.moves.urllib.parse import parse_qs

from sentry.incidents.action_handlers import (
    EmailActionHandler,
    generate_incident_trigger_email_context,
    MsTeamsActionHandler,
    PagerDutyActionHandler,
    SentryAppActionHandler,
    SlackActionHandler,
)
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models import (
    AlertRuleTriggerAction,
    IncidentStatus,
    IncidentStatusMethod,
    TriggerStatus,
    INCIDENT_STATUS,
)
from sentry.models import Integration, PagerDutyService, UserOption
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.http import absolute_uri


class EmailActionHandlerGetTargetsTest(TestCase):
    @fixture
    def incident(self):
        return self.create_incident()

    def test_user(self):
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, self.user.email)]

    def test_user_alerts_disabled(self):
        UserOption.objects.set_value(
            user=self.user, key="mail:alert", value=0, project=self.project
        )
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert handler.get_targets() == [(self.user.id, self.user.email)]

    def test_team(self):
        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=six.text_type(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert set(handler.get_targets()) == set(
            [(self.user.id, self.user.email), (new_user.id, new_user.email)]
        )

    def test_team_alert_disabled(self):
        UserOption.objects.set_value(
            user=self.user, key="mail:alert", value=0, project=self.project
        )
        disabled_user = self.create_user()
        UserOption.objects.set_value(user=disabled_user, key="subscribe_by_default", value="0")

        new_user = self.create_user()
        self.create_team_membership(team=self.team, user=new_user)
        action = self.create_alert_rule_trigger_action(
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=six.text_type(self.team.id),
        )
        handler = EmailActionHandler(action, self.incident, self.project)
        assert set(handler.get_targets()) == set([(new_user.id, new_user.email)])


@freeze_time()
class EmailActionHandlerGenerateEmailContextTest(TestCase):
    def test(self):
        status = TriggerStatus.ACTIVE
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
            self.project, incident, action.alert_rule_trigger, status
        )

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
            self.project, incident, action.alert_rule_trigger, status
        ).get("environment")


class FireTest(object):
    def run_test(self, incident, method):
        raise NotImplementedError

    def run_fire_test(self, method="fire"):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
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
            target_identifier=six.text_type(self.user.id), triggered_for_incident=incident,
        )
        handler = EmailActionHandler(action, incident, self.project)
        with self.tasks():
            handler.fire(1000)
        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == u"[{}] {} - {}".format(
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
        from sentry.integrations.slack.utils import build_incident_attachment

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        integration = Integration.objects.create(
            external_id="1", provider="slack", metadata={"access_token": token}
        )
        integration.add_organization(self.organization, self.user)
        channel_id = "some_id"
        channel_name = "#hello"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/channels.list",
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
            getattr(handler, method)(metric_value)
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
            getattr(handler, method)(metric_value)
        data = json.loads(responses.calls[1].request.body)

        assert data["attachments"][0]["content"] == build_incident_attachment(
            incident, metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()


@freeze_time()
class PagerDutyActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        service = [
            {
                "type": "service",
                "integration_key": "pfc73e8cb4s44d519f3d63d45b5q77g9",
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
        integration_key = "pfc73e8cb4s44d519f3d63d45b5q77g9"
        metric_value = 1000
        data = build_incident_attachment(incident, integration_key, metric_value)

        assert data["routing_key"] == "pfc73e8cb4s44d519f3d63d45b5q77g9"
        assert data["event_action"] == "trigger"
        assert data["dedup_key"] == "incident_{}_{}".format(
            incident.organization_id, incident.identifier
        )
        assert data["payload"]["summary"] == alert_rule.name
        assert data["payload"]["severity"] == "critical"
        assert data["payload"]["source"] == six.text_type(incident.identifier)
        assert data["payload"]["custom_details"] == {
            "details": "1000 events in the last 10 minutes\nFilter: level:error"
        }
        assert data["links"][0]["text"] == "Critical: {}".format(alert_rule.name)
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
            getattr(handler, method)(metric_value)
        data = responses.calls[0].request.body

        assert json.loads(data) == build_incident_attachment(
            incident, self.service.integration_key, metric_value
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
            name="foo", organization=self.organization, is_alertable=True, verify_install=False,
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
            getattr(handler, method)(metric_value)
        data = responses.calls[0].request.body

        assert json.dumps(build_incident_attachment(incident, metric_value)) in data

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")
