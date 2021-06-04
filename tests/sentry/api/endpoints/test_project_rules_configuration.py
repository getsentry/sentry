from sentry.rules.registry import RuleRegistry
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import Mock, patch

EMAIL_ACTION = "sentry.mail.actions.NotifyEmailAction"
APP_ACTION = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
JIRA_ACTION = "sentry.integrations.jira.notify_action.JiraCreateTicketAction"


class ProjectRuleConfigurationTest(APITestCase):
    endpoint = "sentry-api-0-project-rules-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="baz")

        response = self.get_valid_response(self.organization.slug, project1.slug)
        assert len(response.data["actions"]) == 7
        assert len(response.data["conditions"]) == 6
        assert len(response.data["filters"]) == 7

    @property
    def rules(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = EMAIL_ACTION
        rule.rule_type = "action/lol"
        node = rule.return_value
        node.id = EMAIL_ACTION
        node.label = "hello"
        node.prompt = "hello"
        node.is_enabled.return_value = True
        node.form_fields = {}
        rules.add(rule)
        return rules

    def run_mock_rules_test(self, expected_actions, querystring_params, rules=None):
        if not rules:
            rules = self.rules
        with patch("sentry.api.endpoints.project_rules_configuration.rules", rules):
            response = self.get_valid_response(
                self.organization.slug, self.project.slug, qs_params=querystring_params
            )

            assert len(response.data["actions"]) == expected_actions
            assert len(response.data["conditions"]) == 0

    def test_filter_show_notify_email_action(self):
        self.run_mock_rules_test(1, {})

    def test_show_notify_event_service_action(self):
        rules = RuleRegistry()
        rule = Mock()
        rule.id = APP_ACTION
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
        rule.id = APP_ACTION
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

    def test_available_actions(self):
        response = self.get_valid_response(self.organization.slug, self.project.slug)

        action_ids = [action["id"] for action in response.data["actions"]]
        assert EMAIL_ACTION in action_ids
        assert JIRA_ACTION in action_ids

    def test_ticket_rules_not_in_available_actions(self):
        with self.feature({"organizations:integrations-ticket-rules": False}):
            response = self.get_valid_response(self.organization.slug, self.project.slug)
            action_ids = [action["id"] for action in response.data["actions"]]
            assert EMAIL_ACTION in action_ids
            assert JIRA_ACTION not in action_ids

    def test_percent_condition_flag(self):
        with self.feature({"organizations:issue-percent-filters": False}):
            # We should not get back the condition.
            response = self.get_valid_response(self.organization.slug, self.project.slug)
            assert len(response.data["conditions"]) == 9
            for condition in response.data["conditions"]:
                assert (
                    condition["id"]
                    != "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
                )

        with self.feature({"organizations:issue-percent-filters": True}):
            # We should get back the condition.
            response = self.get_valid_response(self.organization.slug, self.project.slug)
            assert len(response.data["conditions"]) == 10
            found = False
            for condition in response.data["conditions"]:
                if (
                    condition["id"]
                    != "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
                ):
                    found = True
            assert found is True
