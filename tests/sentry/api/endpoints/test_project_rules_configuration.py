from unittest.mock import Mock, patch

from sentry.constants import TICKET_ACTIONS
from sentry.integrations.github_enterprise.actions import GitHubEnterpriseCreateTicketAction
from sentry.rules import MatchType
from sentry.rules import rules as default_rules
from sentry.rules.registry import RuleRegistry
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

EMAIL_ACTION = "sentry.mail.actions.NotifyEmailAction"
APP_ACTION = "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
SENTRY_APP_ALERT_ACTION = "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction"

# Adding GitHub Enterprise ticket action is protected by an option, and we
# cannot override the option before importing it in the test so we need to
# manually add it here.
if GitHubEnterpriseCreateTicketAction.id not in default_rules:
    default_rules.add(GitHubEnterpriseCreateTicketAction)


class ProjectRuleConfigurationTest(APITestCase):
    endpoint = "sentry-api-0-project-rules-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="baz")

        response = self.get_success_response(self.organization.slug, project1.slug)
        assert len(response.data["actions"]) == 12
        assert len(response.data["conditions"]) == 9
        assert len(response.data["filters"]) == 9

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
            response = self.get_success_response(
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
        response = self.get_success_response(self.organization.slug, self.project.slug)

        action_ids = [action["id"] for action in response.data["actions"]]
        assert EMAIL_ACTION in action_ids
        for action in TICKET_ACTIONS:
            assert action in action_ids

    def test_ticket_rules_not_in_available_actions(self):
        with self.feature({"organizations:integrations-ticket-rules": False}):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, includeAllTickets=True
            )

            action_ids = [action["id"] for action in response.data["actions"]]
            assert EMAIL_ACTION in action_ids
            for action in TICKET_ACTIONS:
                assert action not in action_ids
            assert "disabledTicketActions" not in response.data

    @patch("sentry.api.endpoints.project_rules_configuration.rules", new=[])
    def test_show_disabled_ticket_actions(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, includeAllTickets=True
        )
        disabled_ticket_actions = response.data["disabledTicketActions"]
        assert set(disabled_ticket_actions) == TICKET_ACTIONS

    def test_sentry_app_alertable_webhook(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="baz")

        sentry_app = self.create_sentry_app(
            organization=self.organization,
            is_alertable=True,
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        response = self.get_success_response(self.organization.slug, project1.slug)

        assert len(response.data["actions"]) == 13
        assert {
            "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
            "label": "Send a notification via {service}",
            "enabled": True,
            "prompt": "Send a notification via an integration",
            "formFields": {
                "service": {"type": "choice", "choices": [[sentry_app.slug, sentry_app.name]]}
            },
        } in response.data["actions"]
        assert len(response.data["conditions"]) == 9
        assert len(response.data["filters"]) == 9

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_sentry_app_alert_rules(self, mock_sentry_app_components_preparer):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="baz")
        settings_schema = self.create_alert_rule_action_schema()

        sentry_app = self.create_sentry_app(
            organization=self.organization,
            schema={"elements": [settings_schema]},
            is_alertable=True,
        )
        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        response = self.get_success_response(self.organization.slug, project1.slug)

        assert len(response.data["actions"]) == 13
        assert {
            "id": SENTRY_APP_ALERT_ACTION,
            "service": sentry_app.slug,
            "actionType": "sentryapp",
            "prompt": sentry_app.name,
            "enabled": True,
            "label": "Create Task with App with these ",
            "formFields": settings_schema["settings"],
            "sentryAppInstallationUuid": str(install.uuid),
        } in response.data["actions"]
        assert len(response.data["conditions"]) == 9
        assert len(response.data["filters"]) == 9

    def test_issue_type_and_category_filter_feature(self):
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert len(response.data["actions"]) == 12
        assert len(response.data["conditions"]) == 9
        assert len(response.data["filters"]) == 9

        response = self.get_success_response(self.organization.slug, self.project.slug)
        tagged_event_filter = next(
            (
                filter
                for filter in response.data["filters"]
                if filter["id"] == "sentry.rules.filters.tagged_event.TaggedEventFilter"
            ),
            None,
        )
        assert tagged_event_filter
        filter_list = [
            choice[0] for choice in tagged_event_filter["formFields"]["match"]["choices"]
        ]
        assert MatchType.IS_IN in filter_list
        assert MatchType.NOT_IN in filter_list

    @with_feature("organizations:event-unique-user-frequency-condition-with-conditions")
    def test_issue_type_and_category_filter_feature_with_conditions(self):
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert len(response.data["actions"]) == 12

        assert len(response.data["conditions"]) == 10
        assert len(response.data["filters"]) == 9
        assert len(response.data["conditions"]) == 10

        response = self.get_success_response(self.organization.slug, self.project.slug)
        tagged_event_filter = next(
            (
                filter
                for filter in response.data["filters"]
                if filter["id"] == "sentry.rules.filters.tagged_event.TaggedEventFilter"
            ),
            None,
        )
        assert tagged_event_filter
        filter_list = [
            choice[0] for choice in tagged_event_filter["formFields"]["match"]["choices"]
        ]
        assert MatchType.IS_IN in filter_list
        assert MatchType.NOT_IN in filter_list
