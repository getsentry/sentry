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

    @responses.activate
    def test_creates_issue(self):
        event = self.get_event()
        rule = self.get_rule(data={"account": self.integration.id})
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

        def responder(request):
            body = json.loads(request.body)
            assert body["fields"]["labels"] == [
                "fuzzy"
            ]  # this is based on MOCK_DATA and will likely change

            return (200, {"content-type": "application/json"}, '{"key":"APP-123"}')

        responses.add_callback(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            callback=responder,
            match_querystring=False,
        )
        results = rule.after(event=event, state=self.get_state())

        assert results["key"]  # existence of a key means the issue was created
