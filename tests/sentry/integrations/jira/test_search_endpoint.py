from __future__ import absolute_import

import responses

from exam import fixture
from six.moves.urllib.parse import urlparse, parse_qs

from django.core.urlresolvers import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase


SAMPLE_SEARCH_RESPONSE = """
{
  "expand": "names,schema",
  "startAt": 0,
  "maxResults": 50,
  "total": 1,
  "issues": [
    {
      "expand": "",
      "id": "10001",
      "self": "http://www.example.com/jira/rest/api/2/issue/10001",
      "key": "HSP-1",
      "fields": {
        "summary": "this is a test issue summary"
      }
    }
  ],
  "warningMessages": [
    "The value 'splat' does not exist for the field 'Foo'."
  ]
}
"""

SAMPLE_USER_SEARCH_RESPONSE = """
[
    {
        "accountId": "deadbeef123",
        "displayName": "Bobby",
        "emailAddress": "bob@example.org"
    }
]
"""


class JiraSearchEndpointTest(APITestCase):
    @fixture
    def integration(self):
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
        return integration

    @responses.activate
    def test_issue_search_text(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/",
            body=SAMPLE_SEARCH_RESPONSE,
            content_type="json",
            match_querystring=False,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get("%s?field=externalIssue&query=test" % (path,))
        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]

    @responses.activate
    def test_issue_search_id(self):
        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert 'id="hsp-1"' == query["jql"][0]
            return (200, {}, SAMPLE_SEARCH_RESPONSE)

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/",
            callback=responder,
            match_querystring=False,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        # queries come through from the front end lowercased, so HSP-1 -> hsp-1
        resp = self.client.get("%s?field=externalIssue&query=hsp-1" % (path,))
        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]

    @responses.activate
    def test_issue_search_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/",
            status=500,
            body="Totally broken",
            match_querystring=False,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get("%s?field=externalIssue&query=test" % (path,))
        assert resp.status_code == 400
        assert resp.data == {"detail": "Error Communicating with Jira (HTTP 500): unknown error"}

    @responses.activate
    def test_assignee_search(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
            match_querystring=False,
        )

        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "HSP" == query["project"][0]
            assert "bob" == query["query"][0]
            return (200, {}, SAMPLE_USER_SEARCH_RESPONSE)

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            callback=responder,
            content_type="json",
            match_querystring=False,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get("%s?project=10000&field=assignee&query=bob" % (path,))
        assert resp.status_code == 200
        assert resp.data == [{"value": "deadbeef123", "label": "Bobby - bob@example.org"}]

    @responses.activate
    def test_assignee_search_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
            match_querystring=False,
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            status=500,
            body="Bad things",
            match_querystring=False,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get("%s?project=10000&field=assignee&query=bob" % (path,))
        assert resp.status_code == 400
