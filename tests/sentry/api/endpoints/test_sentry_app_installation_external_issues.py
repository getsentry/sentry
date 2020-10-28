from __future__ import absolute_import

import six
import responses

from django.core.urlresolvers import reverse
from sentry.models import PlatformExternalIssue
from sentry.testutils import APITestCase


class SentryAppInstallationExternalIssuesEndpointTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="Testin", organization=self.org, webhook_url="https://example.com"
        )

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-issues", args=[self.install.uuid]
        )

    @responses.activate
    def test_creates_external_issue(self):
        self.login_as(user=self.superuser, superuser=True)
        data = {
            "groupId": self.group.id,
            "action": "create",
            "fields": {"title": "Hello"},
            "uri": "/create-issues",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        response = self.client.post(self.url, data=data, format="json")
        external_issue = PlatformExternalIssue.objects.first()

        assert response.status_code == 200
        assert response.data == {
            "id": six.text_type(external_issue.id),
            "groupId": six.text_type(self.group.id),
            "serviceType": self.sentry_app.slug,
            "displayName": "ProjectName#issue-1",
            "webUrl": "https://example.com/project/issue-id",
        }

    @responses.activate
    def test_external_issue_doesnt_get_created(self):
        self.login_as(user=self.superuser, superuser=True)
        data = {
            "groupId": self.group.id,
            "action": "create",
            "fields": {"title": "Hello"},
            "uri": "/create-issues",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            status=500,
            content_type="application/json",
        )

        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 400
        assert not PlatformExternalIssue.objects.all()
