import orjson
import responses
from django.urls import reverse
from django.utils.http import urlencode
from responses.matchers import query_string_matcher

from sentry.testutils.cases import APITestCase


class SentryAppInstallationExternalRequestsEndpointTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="Testin", organization=self.org, webhook_url="https://example.com"
        )

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-requests", args=[self.install.uuid]
        )

    @responses.activate
    def test_makes_external_request(self):
        self.login_as(user=self.user)
        options = [{"label": "Project Name", "value": "1234"}]
        responses.add(
            method=responses.GET,
            url="https://example.com/get-projects",
            match=[
                query_string_matcher(
                    f"projectSlug={self.project.slug}&installationId={self.install.uuid}&query=proj"
                )
            ],
            json=options,
            status=200,
            content_type="application/json",
        )
        url = self.url + f"?projectId={self.project.id}&uri=/get-projects&query=proj"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data == {"choices": [["1234", "Project Name"]]}

    @responses.activate
    def test_makes_external_request_with_dependent_data(self):
        self.login_as(user=self.user)
        options = [{"label": "Project Name", "value": "1234"}]
        qs = urlencode(
            {
                "projectSlug": self.project.slug,
                "installationId": self.install.uuid,
                "query": "proj",
                "dependentData": orjson.dumps({"org_id": "A"}).decode(),
            }
        )
        responses.add(
            method=responses.GET,
            url="https://example.com/get-projects",
            match=[query_string_matcher(qs)],
            json=options,
            status=200,
            content_type="application/json",
        )
        qs = urlencode(
            {
                "projectId": self.project.id,
                "uri": "/get-projects",
                "query": "proj",
                "dependentData": orjson.dumps({"org_id": "A"}).decode(),
            }
        )
        url = f"{self.url}?{qs}"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data == {"choices": [["1234", "Project Name"]]}

    @responses.activate
    def test_external_request_fails(self):
        self.login_as(user=self.user)
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-projects?installationId={self.project.slug}",
            status=500,
            content_type="application/json",
        )
        url = self.url + f"?uri={self.project.id}"
        response = self.client.get(url, format="json")
        assert response.status_code == 500
