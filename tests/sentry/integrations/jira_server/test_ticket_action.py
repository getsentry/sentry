import responses
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.eventstore.models import Event
from sentry.integrations.jira_server import JiraServerCreateTicketAction
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.integrations.integration import Integration
from sentry.models.rule import Rule
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.rules import RuleFuture

pytestmark = [requires_snuba]


class JiraServerTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = JiraServerCreateTicketAction

    def setUp(self):
        super().setUp()
        self.integration = Integration.objects.create(
            provider="jira_server",
            name="Jira Server",
            metadata={"base_url": "https://jira.example.com", "verify_ssl": True},
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

    def get_key(self, event: Event):
        return ExternalIssue.objects.get_linked_issues(event, self.integration).values_list(
            "key", flat=True
        )[0]

    @responses.activate()
    def test_ticket_rules(self):
        project = "10000"
        issueType = "1"
        key = "external_issue_key"
        sample_description = "sample bug report"

        responses.add(
            method=responses.GET,
            url=f"https://jira.example.com/rest/api/2/issue/createmeta/{project}/issuetypes/{issueType}",
            json={
                "maxResults": 50,
                "startAt": 0,
                "total": 19,
                "isLast": True,
                "values": [
                    {
                        "required": True,
                        "schema": {"type": "issuetype", "system": "issuetype"},
                        "name": "Issue Type",
                        "fieldId": "issuetype",
                        "hasDefaultValue": False,
                        "operations": [],
                        "allowedValues": [
                            {
                                "self": "https://jira.example.com/rest/api/2/issuetype/10004",
                                "id": "10004",
                                "description": "A problem which impairs or prevents the functions of the product.",
                                "iconUrl": "https://jira.example.com/secure/viewavatar?size=xsmall&avatarId=10303&avatarType=issuetype",
                                "name": "Bug",
                                "subtask": False,
                                "avatarId": 10303,
                            }
                        ],
                    },
                    {
                        "required": True,
                        "schema": {"type": "project", "system": "project"},
                        "name": "Project",
                        "fieldId": "project",
                        "hasDefaultValue": False,
                        "operations": ["set"],
                        "allowedValues": [
                            {
                                "self": "https://jira.example.com/rest/api/2/project/10000",
                                "id": "10000",
                                "key": "IS",
                                "name": "Initech Software",
                                "projectTypeKey": "software",
                                "avatarUrls": {
                                    "48x48": "https://jira.example.com/secure/projectavatar?avatarId=10324",
                                },
                            }
                        ],
                    },
                    {
                        "required": True,
                        "schema": {"type": "user", "system": "reporter"},
                        "name": "Reporter",
                        "fieldId": "reporter",
                        "autoCompleteUrl": "https://jira.example.com/rest/api/latest/user/search?username=",
                        "hasDefaultValue": False,
                        "operations": ["set"],
                    },
                    {
                        "required": True,
                        "schema": {"type": "string", "system": "summary"},
                        "name": "Summary",
                        "fieldId": "summary",
                        "hasDefaultValue": False,
                        "operations": ["set"],
                    },
                ],
            },
            status=200,
        )
        responses.add(
            method=responses.POST,
            url="https://jira.example.com/rest/api/2/issue",
            json={"key": key},
            status=200,
        )
        responses.add(
            method=responses.GET,
            url="https://jira.example.com/rest/api/2/issue/external_issue_key",
            json={
                "key": key,
                "fields": {"summary": "example summary", "description": sample_description},
            },
            status=200,
        )

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
                        "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
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

        # assert ticket created on jira server
        data = self.installation.get_issue(key)
        assert sample_description in data["description"]

        # Trigger its `after` _again_
        self.trigger(event, rule_object)

        # assert new ticket NOT created in DB
        assert ExternalIssue.objects.count() == external_issue_count

    def test_fails_validation(self):
        """
        Test that the absence of dynamic_form_fields in the action fails validation
        """
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
                        "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
                        "integration": self.integration.id,
                        "issuetype": "1",
                        "name": "Create a Jira ticket in the Jira Server account",
                        "project": "10000",
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 400
        assert response.data["actions"][0] == "Must configure issue link settings."
