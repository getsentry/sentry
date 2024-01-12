from sentry.models.platformexternalissue import PlatformExternalIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SentryAppInstallationExternalIssueDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installation-external-issue-details"
    method = "delete"

    def setUp(self):
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["event:admin"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.external_issue = self.create_platform_external_issue(
            group=self.group,
            service_type=self.sentry_app.slug,
            display_name="App#issue-1",
            web_url=self.sentry_app.webhook_url,
        )
        self.login_as(self.user)

    def test_deletes_external_issue(self):
        assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
        self.get_success_response(self.install.uuid, self.external_issue.id, status_code=204)
        assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_handles_non_existing_external_issue(self):
        self.get_error_response(self.install.uuid, 999999, status_code=404)

    def test_handles_issue_from_wrong_org(self):
        """
        Ensure that an outside organization cannot delete another organization's external issue
        """

        evil_user = self.create_user(email="moop@example.com")
        evil_org = self.create_organization(owner=evil_user)

        evil_sentry_app = self.create_sentry_app(
            name="bad-stuff",
            organization=evil_org,
            webhook_url="https://example.com",
            scopes=["event:admin"],
        )
        evil_install = self.create_sentry_app_installation(
            organization=evil_org, slug=evil_sentry_app.slug, user=evil_user
        )

        self.get_error_response(evil_install.uuid, self.external_issue.id, status_code=404)
        assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
