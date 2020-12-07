from __future__ import absolute_import

import responses

from sentry.integrations.jira.notify_action import JiraCreateTicketAction
from sentry.models import Integration, ExternalIssue, GroupLink, Rule
from sentry.testutils.cases import RuleTestCase
from sentry.utils import json
from tests.fixtures.integrations.mock_service import StubService


class JiraCreateTicketActionTest(RuleTestCase):
    rule_cls = JiraCreateTicketAction

    def setUp(self):
        self.integration = Integration.objects.create(
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(self.organization.id)

    @responses.activate
    def test_creates_issue(self):
        event = self.get_event()
        jira_rule = self.get_rule(
            data={
                "issuetype": "1",
                "labels": "bunnies",
                "customfield_10200": "sad",
                "customfield_10300": ["Feature 1", "Feature 2"],
                "project": "10000",
                "jira_integration": self.integration.id,
                "jira_project": "10000",
                "issue_type": "Bug",
                "fixVersions": "[10000]",
            }
        )
        jira_rule.rule = Rule.objects.create(project=self.project, label="test rule",)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
            match_querystring=False,
        )

        jira_rule.data["key"] = "APP-123"
        responses.add(
            method=responses.POST,
            url="https://example.atlassian.net/rest/api/2/issue",
            json=jira_rule.data,
            status=202,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/APP-123",
            body=StubService.get_stub_json("jira", "get_issue_response.json"),
            content_type="json",
            match_querystring=False,
        )

        results = list(jira_rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        # Trigger rule callback
        results[0].callback(event, futures=[])

        # Make assertions about what would be sent.
        data = json.loads(responses.calls[2].request.body)
        assert data["fields"]["summary"] == event.title
        assert event.message in data["fields"]["description"]
        assert data["fields"]["issuetype"]["id"] == "1"

        external_issue = ExternalIssue.objects.get(key="APP-123")
        assert external_issue

    @responses.activate
    def test_doesnt_create_issue(self):
        """Don't create an issue if one already exists on the event for the given integration"""

        event = self.get_event()
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="APP-123",
            title=event.title,
            description="Fix this.",
        )
        GroupLink.objects.create(
            group_id=event.group.id,
            project_id=self.project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
            data={"provider": self.integration.provider},
        )
        jira_rule = self.get_rule(
            data={
                "title": "example summary",
                "description": "example bug report",
                "issuetype": "1",
                "project": "10000",
                "customfield_10200": "sad",
                "customfield_10300": ["Feature 1", "Feature 2"],
                "labels": "bunnies",
                "jira_integration": self.integration.id,
                "jira_project": "10000",
                "issue_type": "Bug",
                "fixVersions": "[10000]",
            }
        )
        jira_rule.rule = Rule.objects.create(project=self.project, label="test rule",)

        results = list(jira_rule.after(event=event, state=self.get_state()))
        assert len(results) == 1
        results[0].callback(event, futures=[])
        assert len(responses.calls) == 1

    def test_render_label(self):
        rule = self.get_rule(
            data={
                "jira_integration": self.integration.id,
                "issuetype": 1,
                "project": 10000,
                "dynamic_form_fields": {
                    "issuetype": {"type": "choice", "choices": [(1, "Bug")]},
                    "project": {"type": "choice", "choices": [(10000, "Example")]},
                },
            }
        )
        assert rule.render_label() == """Create a Jira issue in Jira Cloud with these """

    def test_render_label_without_integration(self):
        deleted_id = self.integration.id
        self.integration.delete()

        rule = self.get_rule(data={"jira_integration": deleted_id})

        assert rule.render_label() == "Create a Jira issue in [removed] with these "

    @responses.activate
    def test_invalid_integration(self):
        rule = self.get_rule(data={"jira_integration": self.integration.id})

        form = rule.get_form_instance()
        assert form.is_valid()

    @responses.activate
    def test_invalid_project(self):
        rule = self.get_rule(data={"jira_integration": self.integration.id})

        form = rule.get_form_instance()
        assert form.is_valid()
