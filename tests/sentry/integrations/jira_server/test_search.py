from functools import cached_property
from urllib.parse import parse_qs, urlparse

import responses
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test

from . import EXAMPLE_ISSUE_SEARCH, EXAMPLE_USER_SEARCH_RESPONSE, get_integration


@control_silo_test
class JiraServerSearchEndpointTest(APITestCase):
    @cached_property
    def integration(self):
        return get_integration(self.organization, self.user)

    @responses.activate
    def test_get_success_text_search(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=text ~ "test"',
            body=EXAMPLE_ISSUE_SEARCH,
            content_type="json",
        )

        self.login_as(self.user)
        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, integration.id])
        resp = self.client.get(f"{path}?field=externalIssue&query=test")

        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]

    @responses.activate
    def test_get_success_id_search(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=id="HSP-1"',
            body=EXAMPLE_ISSUE_SEARCH,
            content_type="json",
        )

        self.login_as(self.user)
        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, integration.id])
        resp = self.client.get(f"{path}?field=externalIssue&query=HSP-1")

        assert resp.status_code == 200
        assert resp.data == [{"label": "(HSP-1) this is a test issue summary", "value": "HSP-1"}]

    @responses.activate
    def test_get_network_error(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=id="HSP-1"',
            status=502,
            body="<p>We are down</p>",
        )

        self.login_as(self.user)
        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, integration.id])
        resp = self.client.get(f"{path}?field=externalIssue&query=HSP-1")

        assert resp.status_code == 400

    def test_get_missing_integration(self):
        self.login_as(self.user)
        org = self.organization

        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, 99])
        resp = self.client.get(f"{path}?field=externalIssue&query=HSP-1")

        assert resp.status_code == 404

    @responses.activate
    def test_assignee_search(self):
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )

        def responder(request):
            query = parse_qs(urlparse(request.url).query)
            assert "HSP" == query["project"][0]
            assert "bob" == query["username"][0]
            return (200, {}, EXAMPLE_USER_SEARCH_RESPONSE)

        responses.add_callback(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            callback=responder,
            content_type="json",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 200
        assert resp.data == [{"value": "bob", "label": "Bobby - bob@example.org (bob)"}]

    @responses.activate
    def test_assignee_search_error(self):
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/project",
            json=[{"key": "HSP", "id": "10000"}],
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            status=500,
            body="Bad things",
        )
        org = self.organization
        self.login_as(self.user)

        path = reverse("sentry-extensions-jiraserver-search", args=[org.slug, self.integration.id])

        resp = self.client.get(f"{path}?project=10000&field=assignee&query=bob")
        assert resp.status_code == 400
