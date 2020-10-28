from __future__ import absolute_import

from django.core.urlresolvers import reverse
from mock import Mock, patch

from sentry.rules.registry import RuleRegistry
from sentry.testutils import APITestCase


class ProjectRuleConfigurationTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="baz")

        url = reverse(
            "sentry-api-0-project-rules-configuration",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["actions"]) == 5
        assert len(response.data["conditions"]) == 9

    @property
    def rules(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = "sentry.mail.actions.NotifyEmailAction"
        rule.rule_type = "action/lol"
        node = rule.return_value
        node.id = "sentry.mail.actions.NotifyEmailAction"
        node.label = "hello"
        node.prompt = "hello"
        node.is_enabled.return_value = True
        node.form_fields = {}
        rules.add(rule)
        return rules

    def run_mock_rules_test(self, expected_actions, querystring_params, rules=None):
        if not rules:
            rules = self.rules
        self.login_as(user=self.user)
        with patch("sentry.api.endpoints.project_rules_configuration.rules", rules):
            url = reverse(
                "sentry-api-0-project-rules-configuration",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "project_slug": self.project.slug,
                },
            )
            response = self.client.get(url, querystring_params, format="json")

            assert response.status_code == 200, response.content
            assert len(response.data["actions"]) == expected_actions
            assert len(response.data["conditions"]) == 0

    def test_filter_show_notify_email_action(self):
        self.run_mock_rules_test(1, {})

    def test_show_notify_event_service_action(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
        rule.rule_type = "action/lol"
        node = rule.return_value
        node.id = rule.id
        node.label = "hello"
        node.prompt = "hello"
        node.is_enabled.return_value = True
        node.form_fields = {}
        node.get_services.return_value = [Mock()]
        rules.add(rule)
        self.run_mock_rules_test(1, {}, rules=rules)

    def test_hide_empty_notify_event_service_action(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
        rule.rule_type = "action/lol"
        node = rule.return_value
        node.id = rule.id
        node.label = "hello"
        node.prompt = "hello"
        node.is_enabled.return_value = True
        node.form_fields = {}
        node.get_services.return_value = []
        rules.add(rule)
        self.run_mock_rules_test(0, {}, rules=rules)
