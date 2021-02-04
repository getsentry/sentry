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

    def test_creates_external_issue(self):
        self.login_as(user=self.superuser, superuser=True)
        data = {
            "groupId": self.group.id,
            "webUrl": "https://somerandom.io",
            "project": "ExternalProj",
            "identifier": "issue-1",
        }

        response = self.client.post(self.url, data=data, format="json")
        external_issue = PlatformExternalIssue.objects.first()

        assert response.status_code == 200
        assert response.data == {
            "id": str(external_issue.id),
            "groupId": str(self.group.id),
            "serviceType": self.sentry_app.slug,
            "displayName": "ExternalProj#issue-1",
            "webUrl": "https://somerandom.io/project/issue-id",
        }
