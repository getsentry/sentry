from unittest import mock

import responses
from responses.matchers import query_string_matcher

from sentry.integrations.jira.client import JiraCloudClient
from sentry.models import Integration
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


class StubJiraCloud(JiraCloudClient):
    def request_hook(self, *args, **kwargs):
        r = super().request_hook(*args, **kwargs)
        r["params"]["jwt"] = "my-jwt-token"
        return r


@control_silo_test(stable=True)
class JiraClientTest(TestCase):
    @mock.patch("sentry.integrations.jira.integration.JiraCloudClient", new=StubJiraCloud)
    def setUp(self):
        integration = Integration.objects.create(
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)
        install = integration.get_installation(self.organization.id)
        self.client = install.get_client()

    @responses.activate
    def test_get_field_autocomplete_for_non_customfield(self):
        body = {"results": [{"value": "ISSUE-1", "displayName": "My Issue (ISSUE-1)"}]}
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            match=[query_string_matcher("fieldName=my_field&fieldValue=abc&jwt=my-jwt-token")],
            body=json.dumps(body),
            status=200,
            content_type="application/json",
        )
        res = self.client.get_field_autocomplete("my_field", "abc")
        assert res == body

    @responses.activate
    def test_get_field_autocomplete_for_customfield(self):
        body = {"results": [{"value": "ISSUE-1", "displayName": "My Issue (ISSUE-1)"}]}
        responses.add(
            method=responses.GET,
            url="https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            match=[query_string_matcher("fieldName=cf[0123]&fieldValue=abc&jwt=my-jwt-token")],
            body=json.dumps(body),
            status=200,
            content_type="application/json",
        )
        res = self.client.get_field_autocomplete("customfield_0123", "abc")
        assert res == body
