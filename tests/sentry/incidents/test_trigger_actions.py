from __future__ import absolute_import


import six
from exam import fixture
from django.core import mail

from sentry.incidents.logic import (
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    update_alert_rule,
)
from sentry.incidents.models import (
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentTrigger,
    TriggerStatus,
)
from sentry.testutils import TestCase


class TriggerActionTest(TestCase):
    @fixture
    def team(self):
        team = self.create_team()
        self.create_team_membership(team, user=self.user)
        return team

    @fixture
    def project(self):
        return self.create_project(teams=[self.team], name="foo")

    @fixture
    def other_project(self):
        return self.create_project(teams=[self.team], name="other")

    @fixture
    def email_rule(self):
        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        # Make sure the trigger exists
        trigger = create_alert_rule_trigger(rule, "hi", AlertRuleThresholdType.ABOVE, 100)
        create_alert_rule_trigger_action(
            trigger=trigger,
            type=AlertRuleTriggerAction.Type.EMAIL,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
        )
        return rule

    @fixture
    def email_trigger(self):
        return self.email_rule.alertruletrigger_set.get()

    def test_email(self):
        incident = self.create_incident(alert_rule=self.email_rule)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=self.email_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        with self.tasks():
            update_alert_rule(self.email_rule, name="some rule updated")

        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == u"[Resolved] {} - {}".format(incident.title, self.project.slug)
