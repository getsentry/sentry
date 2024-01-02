from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation


class SentryAppDetailsDocs(APIDocsTestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.sentry_app = self.create_sentry_app(
            name="Hellboy App", published=True, organization_id=self.org.id
        )
        self.install = SentryAppInstallation(
            sentry_app=self.sentry_app, organization_id=self.org.id
        )
        self.install.save()
        self.external_issue = self.create_platform_external_issue(
            group=self.group,
            service_type=self.sentry_app.slug,
            display_name="App#issue-1",
            web_url=self.sentry_app.webhook_url,
        )
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-issue-details",
            kwargs={"uuid": self.install.uuid, "external_issue_id": self.external_issue.id},
        )

        self.login_as(user=self.user)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)

        self.validate_schema(request, response)
