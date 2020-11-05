from __future__ import absolute_import

import responses

from sentry.utils import json
from sentry.models import Integration
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.jira.notify_action import JiraCreateTicketAction
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
        print("integration id: ", self.integration.id)

    @responses.activate
    def test_creates_issue(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "priority": "1",
                "labels": "fuzzy",
                "description": "here is some stuff",
                "title": "make a different issue",
                "reporter": "5ab0069933719f2a50168cab",
                "fixVersions": "",
                "project": "10000",
                "assignee": "5ab0069933719f2a50168cab",
                "components": "",
                "issuetype": "10002",
                "jira_integration": 1,
                "jira_project": "10000",
                "issue_type": "Bug",
            }
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=SAMPLE_CREATE_META_RESPONSE,
            content_type="json",
            match_querystring=False,
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/APP-123",
            body=SAMPLE_GET_ISSUE_RESPONSE,
            content_type="json",
            match_querystring=False,
        )

        # def responder(request):
        #     body = json.loads(request.body)
        #     return (200, {"content-type": "application/json"}, '{"key":"APP-123"}')

        # responses.add_callback(
        #     responses.POST,
        #     "https://example.atlassian.net/rest/api/2/issue",
        #     callback=responder,
        #     match_querystring=False,
        # )
        responses.add(
            method=responses.POST,
            url="https://example.atlassian.net/rest/api/2/issue",
            json={"key": "APP-123"},
            status=202,
            content_type="application/json",
        )
        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1
        print("results:", results)

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[1].request.body)

        assert data["fields"]["issuetype"]["id"] == "10002"
        assert data["fields"]["labels"] == ["fuzzy"]
        # should there be more fields? this is all that comes back despite all that I put in
        # though I'm not positive those were correct
        assert False

        # assert that external issue entry was created
