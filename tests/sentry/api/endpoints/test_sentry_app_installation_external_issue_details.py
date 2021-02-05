from django.core.urlresolvers import reverse
from sentry.models import PlatformExternalIssue
from sentry.testutils import APITestCase


class SentryAppInstallationExternalIssueDetailsEndpointTest(APITestCase):
    def setUp(self):
        # self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["event:write", "event:admin"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.user
        )
        # self.external_issue = self.create_platform_external_issue(
        #     group=self.group,
        #     service_type="sentry-app",
        #     display_name="App#issue-1",
        #     web_url="https://example.com/app/issues/1",
        # )
        self.create_url = reverse(
            "sentry-api-0-sentry-app-installation-external-issues", args=[self.install.uuid]
        )

    def test_deletes_external_issue(self):
        data = {
            "groupId": self.group.id,
            "webUrl": "https://somerandom.io/project/issue-id",
            "project": "ExternalProj",
            "identifier": "issue-1",
        }
        self.client.post(
            self.create_url, data=data, HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        external_issue = PlatformExternalIssue.objects.first()
        self.login_as(self.user)
        delete_url = reverse(
            "sentry-api-0-sentry-app-installation-external-issue-details",
            args=[self.install.uuid, external_issue.id],
        )
        response = self.client.delete(delete_url, format="json")

        assert response.status_code == 204, response.content
        assert not PlatformExternalIssue.objects.filter(id=external_issue.id).exists()

    # def test_handles_non_existing_external_issue(self):
    # url = "/api/0/issues/{}/external-issues/{}/".format(self.group.id, 99999)

    # response = self.client.delete(url, format="json")

    # assert response.status_code == 404, response.content
