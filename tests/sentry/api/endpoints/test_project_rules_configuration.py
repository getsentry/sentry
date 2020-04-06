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
        self.create_project(teams=[team], name="bar")

        url = reverse(
            "sentry-api-0-project-rules-configuration",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["actions"]) == 4
        assert len(response.data["conditions"]) == 9

    @property
    def rules(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = "sentry.rules.actions.notify_email.NotifyEmailAction"
        rule.rule_type = "action/lol"
        node = rule.return_value
        node.id = "sentry.rules.actions.notify_email.NotifyEmailAction"
        node.label = "hello"
        node.is_enabled.return_value = True
        node.form_fields = {}
        rules.add(rule)
        return rules

    def run_mock_rules_test(self, expected_actions, querystring_params):
        self.login_as(user=self.user)
        with patch("sentry.api.endpoints.project_rules_configuration.rules", self.rules):
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

    def test_filter_out_notify_email_action(self):
        self.run_mock_rules_test(0, {})

    def test_filter_show_notify_email_action_migrated_project(self):
        self.project.flags.has_issue_alerts_targeting = True
        self.project.save()
        self.run_mock_rules_test(1, {})

    def test_filter_show_notify_email_action_override(self):
        self.run_mock_rules_test(0, {"issue_alerts_targeting": "0"})
        self.run_mock_rules_test(1, {"issue_alerts_targeting": "1"})
