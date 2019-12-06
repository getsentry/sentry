from __future__ import absolute_import

import json

import responses
import six
from django.core import mail
from django.core.urlresolvers import reverse
from exam import fixture
from freezegun import freeze_time
from six.moves.urllib.parse import parse_qs

from sentry.incidents.action_handlers import EmailActionHandler, SlackActionHandler
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models import (
    AlertRuleTriggerAction,
    IncidentStatus,
    QueryAggregations,
    TriggerStatus,
)
from sentry.integrations.slack.utils import build_incident_attachment
from sentry.models import Integration, UserOption
from sentry.testutils import TestCase
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
        assert handler.get_targets() == []

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
        action = self.create_alert_rule_trigger_action()
        incident = self.create_incident()
        handler = EmailActionHandler(action, incident, self.project)
        expected = {
            "link": absolute_uri(
                reverse(
                    "sentry-incident",
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
                        "alert_rule_id": action.alert_rule_trigger.alert_rule_id,
                    },
                )
            ),
            "incident_name": incident.title,
            "aggregate": handler.query_aggregations_display[
                QueryAggregations(action.alert_rule_trigger.alert_rule.aggregation)
            ],
            "query": action.alert_rule_trigger.alert_rule.query,
            "threshold": action.alert_rule_trigger.alert_threshold,
            "status": handler.status_display[status],
        }
        assert expected == handler.generate_email_context(status)


@freeze_time()
class EmailActionHandlerFireTest(TestCase):
    def test_user(self):
        action = self.create_alert_rule_trigger_action(
            target_identifier=six.text_type(self.user.id)
        )
        incident = self.create_incident()
        handler = EmailActionHandler(action, incident, self.project)
        with self.tasks():
            handler.fire()
        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject.startswith("Incident Alert Rule Fired")


@freeze_time()
class EmailActionHandlerResolveTest(TestCase):
    def test_user(self):
        action = self.create_alert_rule_trigger_action(
            target_identifier=six.text_type(self.user.id)
        )
        incident = self.create_incident()
        handler = EmailActionHandler(action, incident, self.project)
        with self.tasks():
            handler.resolve()
        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject.startswith("Incident Alert Rule Resolved")


@freeze_time()
class SlackActionHandlerBaseTest(object):
    @responses.activate
    def run_test(self, incident, method):
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
        with self.tasks():
            getattr(handler, method)()
        data = parse_qs(responses.calls[1].request.body)
        assert data["channel"] == [channel_id]
        assert data["token"] == [token]
        assert json.loads(data["attachments"][0])[0] == build_incident_attachment(incident)


class SlackActionHandlerFireTest(SlackActionHandlerBaseTest, TestCase):
    def test(self):
        self.run_test(self.create_incident(), "fire")


class SlackActionHandlerResolveTest(SlackActionHandlerBaseTest, TestCase):
    def test(self):
        incident = self.create_incident()
        update_incident_status(incident, IncidentStatus.CLOSED)
        self.run_test(incident, "resolve")
