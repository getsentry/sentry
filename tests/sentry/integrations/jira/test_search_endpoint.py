from functools import cached_property
from urllib.parse import parse_qs, urlparse

import responses
from django.urls import reverse

from fixtures.integrations.stub_service import StubService
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class JiraSearchEndpointTest(APITestCase):
    @cached_property
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
            body=StubService.get_stub_json("jira", "search_response.json"),
            content_type="json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=externalIssue&query=test")
        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]

    @responses.activate
    def test_issue_search_id(self):
        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert 'id="hsp-1"' == query["jql"][0]
            data = StubService.get_stub_json("jira", "search_response.json")
            return 200, {}, data

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/",
            callback=responder,
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        # queries come through from the front end lowercased, so HSP-1 -> hsp-1
        for field in ("externalIssue", "parent"):
            resp = self.client.get(f"{path}?field={field}&query=hsp-1")
            assert resp.status_code == 200
            assert resp.data == [
                {"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}
            ]

    @responses.activate
    def test_issue_search_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/search/",
            status=500,
            body="Totally broken",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        for field in ("externalIssue", "parent"):
            resp = self.client.get(f"{path}?field={field}&query=test")
            assert resp.status_code == 400
            assert resp.data == {
                "detail": "Error Communicating with Jira (HTTP 500): unknown error"
            }

    @responses.activate
    def test_assignee_search(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )

        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "HSP" == query["project"][0]
            assert "bob" == query["query"][0]
            data = StubService.get_stub_json("jira", "user_search_response.json")
            return 200, {}, data

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            callback=responder,
            content_type="json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 200
        assert resp.data == [{"value": "deadbeef123", "label": "Bobby - bob@example.org"}]

    @responses.activate
    def test_assignee_search_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            status=500,
            body="Bad things",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 400

    @responses.activate
    def test_customfield_search(self):
        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "cf[0123]" == query["fieldName"][0]
            assert "sp" == query["fieldValue"][0]
            return 200, {}, '{"results": [{"displayName": "<b>Sp</b>rint 1 (1)", "value": "1"}]}'

        responses.add_callback(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            callback=responder,
            content_type="application/json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=customfield_0123&query=sp")
        assert resp.status_code == 200
        assert resp.data == [{"label": "Sprint 1 (1)", "value": "1"}]

    @responses.activate
    def test_customfield_search_error(self):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/jql/autocompletedata/suggestions",
            status=500,
            body="Totally broken",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jira-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?field=customfield_0123&query=sp")
        assert resp.status_code == 400
        assert resp.data == {
            "detail": "Unable to fetch autocomplete for customfield_0123 from Jira"
        }
