from __future__ import absolute_import

import responses

from sentry.utils import json
from sentry.models import Integration
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.jira.notify_action import JiraCreateTicketAction
from sentry.models import ExternalIssue, Rule

from test_integration import SAMPLE_CREATE_META_RESPONSE, SAMPLE_GET_ISSUE_RESPONSE


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
            }
        )
        jira_rule.rule = Rule.objects.create(project=self.project, label="test rule",)
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=SAMPLE_CREATE_META_RESPONSE,
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
            body=SAMPLE_GET_ISSUE_RESPONSE,
            content_type="json",
            match_querystring=False,
        )

        results = list(jira_rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[2].response.text)
        assert data["fields"]["summary"] == "example summary"
        assert data["fields"]["description"] == "example bug report"

        external_issue = ExternalIssue.objects.get(key="APP-123")
        assert external_issue
