import responses
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.sentry_app = self.create_sentry_app(
            name="Hellboy App",
            published=True,
            organization=self.org,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug
        )
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-issues",
            kwargs={"uuid": self.install.uuid},
        )

        self.login_as(user=self.user)

    def test_post(self) -> None:
        data = {
            "issueId": self.group.id,
            "webUrl": "https://somerandom.io/project/issue-id",
            "project": "ExternalProj",
            "identifier": "issue-1",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)

    @responses.activate
    def test_issue_link_action(self) -> None:
        responses.post(
            "https://example.com/sentry/issues/link",
            json={
                "project": "Example",
                "identifier": "APP-123",
                "webUrl": "https://example.com/issues/APP-123",
            },
        )
        url = reverse(
            "sentry-api-0-sentry-app-installation-external-issue-actions",
            args=[self.install.uuid],
        )
        data = {
            "groupId": str(self.group.id),
            "action": "link",
            "uri": "/sentry/issues/link",
            "assignee": "1234",
        }
        response = self.client.post(url, data, content_type="application/json")

        self.validate_schema(RequestFactory().post(url, data), response)

        request_body = self.cached_schema.content()["paths"][
            "/api/0/sentry-app-installations/{uuid}/external-issue-actions/"
        ]["post"]["requestBody"]
        assert request_body["required"] is True
        schema = request_body["content"]["application/json"]["schema"]
        assert schema["additionalProperties"] is True
        assert schema["properties"]["action"]["enum"] == ["link", "create"]

    @responses.activate
    def test_select_options(self) -> None:
        responses.get(
            "https://example.com/sentry/members",
            json=[{"label": "Example Member", "value": "1234", "default": True}],
        )
        url = reverse(
            "sentry-api-0-sentry-app-installation-external-requests", args=[self.install.uuid]
        )
        params = {"uri": "/sentry/members", "query": "example"}
        response = self.client.get(url, params)

        self.validate_schema(RequestFactory().get(url, params), response)

    @responses.activate
    def test_installed_components(self) -> None:
        responses.get(
            "https://example.com/sentry/members",
            json=[{"label": "Example Member", "value": "1234"}],
        )
        url = reverse("sentry-api-0-organization-sentry-app-components", args=[self.org.slug])
        params = {"filter": "issue-link"}
        response = self.client.get(url, params)

        self.validate_schema(RequestFactory().get(url, params), response)
