from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse
from django.utils.http import urlencode
from sentry.testutils import APITestCase
from sentry.utils import json


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
            url=u"https://example.com/get-projects?projectSlug={}&installationId={}&query=proj".format(
                self.project.slug, self.install.uuid
            ),
            json=options,
            status=200,
            content_type="application/json",
            match_querystring=True,
        )
        url = self.url + u"?projectId={}&uri={}&query={}".format(
            self.project.id, "/get-projects", "proj"
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data == {"choices": [["1234", "Project Name"]]}

    @responses.activate
    def test_makes_external_request_with_dependent_data(self):
        self.login_as(user=self.user)
        options = [{"label": "Project Name", "value": "1234"}]
        query = {
            "projectSlug": self.project.slug,
            "installationId": self.install.uuid,
            "query": "proj",
            "dependentData": json.dumps({"org_id": "A"}),
        }
        responses.add(
            method=responses.GET,
            url=u"https://example.com/get-projects?%s" % urlencode(query),
            json=options,
            status=200,
            content_type="application/json",
            match_querystring=True,
        )
        query = {
            "projectId": self.project.id,
            "uri": "/get-projects",
            "query": "proj",
            "dependentData": json.dumps({"org_id": "A"}),
        }
        url = u"%s?%s" % (self.url, urlencode(query))
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data == {"choices": [["1234", "Project Name"]]}

    @responses.activate
    def test_external_request_fails(self):
        self.login_as(user=self.user)
        responses.add(
            method=responses.GET,
            url=u"https://example.com/get-projects?installationId={}".format(
                self.project.slug, self.install.uuid
            ),
            status=500,
            content_type="application/json",
        )
        url = self.url + u"?uri={}".format(self.project.id, "/get-projects")
        response = self.client.get(url, format="json")
        assert response.status_code == 400
