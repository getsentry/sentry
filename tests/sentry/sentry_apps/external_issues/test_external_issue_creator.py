from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import app_service
from sentry.testutils.cases import TestCase


class TextExternalIssueCreator(TestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.orm_install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )
        self.install = app_service.get_many(filter=dict(installation_ids=[self.orm_install.id]))[0]

    def test_creates_platform_external_issue(self):
        result = ExternalIssueCreator(
            install=self.install,
            group=self.group,
            web_url="https://example.com/project/issue-id",
            project="Projectname",
            identifier="issue-1",
        ).run()

        external_issue = PlatformExternalIssue.objects.all()[0]
        assert result == external_issue
        assert external_issue.group_id == self.group.id
        assert external_issue.project_id == self.group.project.id
        assert external_issue.web_url == "https://example.com/project/issue-id"
        assert external_issue.display_name == "Projectname#issue-1"
        assert external_issue.service_type == self.sentry_app.slug
