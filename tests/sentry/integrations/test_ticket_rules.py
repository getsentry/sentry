from collections import namedtuple

from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.integrations.jira import JiraCreateTicketAction
from sentry.models.externalissue import ExternalIssue
from sentry.models.grouplink import GroupLink
from sentry.models.integration import Integration
from sentry.models.rule import Rule
from sentry.testutils import RuleTestCase
from sentry.utils.compat import mock
from tests.fixtures.integrations.jira import MockJira

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


class JiraTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = JiraCreateTicketAction
    mock_jira = None

    def get_client(self):
        if not self.mock_jira:
            self.mock_jira = MockJira()
        return self.mock_jira

    def setUp(self):
        super().setUp()
        self.project_name = "Jira Cloud"
        self.integration = Integration.objects.create(
            provider="jira",
            name=self.project_name,
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(self.organization.id)

        self.login_as(user=self.user)

    def trigger(self, event, rule_object):
        action = rule_object.data.get("actions", ())[0]
        action_inst = self.get_rule(data=action, rule=rule_object)
        results = list(action_inst.after(event=event, state=self.get_state()))
        assert len(results) == 1

        rule_future = RuleFuture(rule=rule_object, kwargs=results[0].kwargs)
        return results[0].callback(event, futures=[rule_future])

    def get_key(self, event):
        return ExternalIssue.objects.filter(
            id__in=GroupLink.objects.filter(
                project_id=self.project.id,
                group_id=event.group.id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list("linked_id", flat=True),
            integration_id=self.integration.id,
        ).values_list("key", flat=True)[0]

    def test_ticket_rules(self):
        with mock.patch(
            "sentry.integrations.jira.integration.JiraIntegration.get_client", self.get_client
        ):
            # Create a new Rule
            response = self.client.post(
                reverse(
                    "sentry-api-0-project-rules",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "project_slug": self.project.slug,
                    },
                ),
                format="json",
                data={
                    "name": "hello world",
                    "owner": self.user.id,
                    "environment": None,
                    "actionMatch": "any",
                    "frequency": 5,
                    "actions": [
                        {
                            "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                            "integration": self.integration.id,
                            "dynamic_form_fields": [{"name": "project"}],
                            "issuetype": "1",
                            "name": "Create a Jira ticket in the Jira Cloud account",
                            "project": "10000",
                        }
                    ],
                    "conditions": [],
                },
            )
            assert response.status_code == 200

            # Get the rule from DB
            rule_object = Rule.objects.get(id=response.data["id"])
            event = self.get_event()

            # Trigger its `after`
            self.trigger(event, rule_object)

            # assert ticket created in DB
            key = self.get_key(event)
            external_issue_count = len(ExternalIssue.objects.filter(key=key))
            assert external_issue_count == 1

            # assert ticket created on jira
            data = self.installation.get_issue(key)
            assert event.message in data["description"]

            # Trigger its `after` _again_
            self.trigger(event, rule_object)

            # assert new ticket NOT created in DB
            assert ExternalIssue.objects.count() == external_issue_count

    def test_fails_validation(self):
        """
        Test that the absence of dynamic_form_fields in the action fails validation
        """
        with mock.patch(
            "sentry.integrations.jira.integration.JiraIntegration.get_client", self.get_client
        ):
            # Create a new Rule
            response = self.client.post(
                reverse(
                    "sentry-api-0-project-rules",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "project_slug": self.project.slug,
                    },
                ),
                format="json",
                data={
                    "name": "hello world",
                    "environment": None,
                    "actionMatch": "any",
                    "frequency": 5,
                    "actions": [
                        {
                            "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                            "integration": self.integration.id,
                            "issuetype": "1",
                            "name": "Create a Jira ticket in the Jira Cloud account",
                            "project": "10000",
                        }
                    ],
                    "conditions": [],
                },
            )
            assert response.status_code == 400
