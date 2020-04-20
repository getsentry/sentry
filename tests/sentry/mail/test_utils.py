# -*- coding: utf-8 -*-

from __future__ import absolute_import

from uuid import uuid4

from sentry.mail.utils import mail_action, migrate_project_to_issue_alert_targeting
from sentry.models import Rule, UserOption
from sentry.testutils import TestCase
from sentry.plugins.base import plugins


class MigrateProjectToIssueAlertTargetingTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user()
        self.user_2 = self.create_user()
        self.team = self.create_team(self.organization, members=[self.user, self.user_2])
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.project.flags.has_issue_alerts_targeting = False
        self.project.save()
        self.mail = plugins.get("mail")

    def create_rule(self, actions):
        data = {
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
            "actions": actions,
        }
        return Rule.objects.create(project=self.project, label=uuid4().hex, data=data)

    def assert_rule_actions_equal(self, rule, expected_actions):
        rule_actions = rule.data.get("actions")
        key = lambda action: action["id"]
        assert sorted(rule_actions, key=key) == sorted(expected_actions, key=key)

    def test_mail_enabled_no_rules(self):
        self.mail.enable(self.project)
        assert not self.project.flags.has_issue_alerts_targeting
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        assert not Rule.objects.filter(project=self.project).exists()
        migrate_project_to_issue_alert_targeting(self.project)
        assert not Rule.objects.filter(project=self.project).exists()
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        assert self.project.flags.has_issue_alerts_targeting

    def test_mail_enabled_has_rules(self):
        self.mail.enable(self.project)
        assert not self.project.flags.has_issue_alerts_targeting
        rule = self.create_rule(
            [
                # Just adding duplicate rules here because who knows what data people
                # have.
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {
                    u"id": u"sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    u"service": u"mail",
                },
                {
                    u"id": u"sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    u"service": u"mail",
                },
            ]
        )
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        migrate_project_to_issue_alert_targeting(self.project)
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        rule.refresh_from_db()
        self.assert_rule_actions_equal(
            rule,
            [
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                mail_action,
            ],
        )
        assert self.project.flags.has_issue_alerts_targeting

    def test_mail_disabled_no_rules(self):
        self.mail.disable(self.project)
        assert not self.project.flags.has_issue_alerts_targeting
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        assert not Rule.objects.filter(project=self.project).exists()
        migrate_project_to_issue_alert_targeting(self.project)
        assert not Rule.objects.filter(project=self.project).exists()
        for user in (self.user, self.user_2):
            assert UserOption.objects.get_value(user, "mail:alert", project=self.project) == 0
            assert (
                UserOption.objects.get_value(user, "workflow:notifications", project=self.project)
                == "0"
            )
        assert self.project.flags.has_issue_alerts_targeting

    def test_mail_disabled_has_rules(self):
        self.mail.disable(self.project)
        assert not self.project.flags.has_issue_alerts_targeting
        rule = self.create_rule(
            [
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {
                    u"id": u"sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    u"service": u"mail",
                },
                {
                    u"id": u"sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    u"service": u"mail",
                },
            ]
        )
        assert not UserOption.objects.filter(user__in=(self.user, self.user_2))
        migrate_project_to_issue_alert_targeting(self.project)
        rule.refresh_from_db()
        self.assert_rule_actions_equal(
            rule,
            [
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
                {u"id": u"sentry.rules.actions.notify_event.NotifyEventAction"},
            ],
        )
        for user in (self.user, self.user_2):
            assert UserOption.objects.get_value(user, "mail:alert", project=self.project) == 0
            assert (
                UserOption.objects.get_value(user, "workflow:notifications", project=self.project)
                == "0"
            )
        assert self.project.flags.has_issue_alerts_targeting
