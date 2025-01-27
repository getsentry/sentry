import pytest
import responses

from sentry.sentry_apps.external_issues.issue_link_creator import IssueLinkCreator
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.testutils.cases import TestCase
from sentry.users.services.user.serial import serialize_rpc_user


class TestIssueLinkCreator(TestCase):
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

    @responses.activate
    def test_creates_external_issue(self):
        fields = {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"}

        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={
                "project": "Projectname",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        result = IssueLinkCreator(
            install=self.install,
            group=self.group,
            action="create",
            uri="/link-issue",
            fields=fields,
            user=serialize_rpc_user(self.user),
        ).run()

        external_issue = PlatformExternalIssue.objects.all()[0]
        assert result == external_issue
        assert external_issue.group_id == self.group.id
        assert external_issue.project_id == self.group.project.id
        assert external_issue.web_url == "https://example.com/project/issue-id"
        assert external_issue.display_name == "Projectname#issue-1"

    def test_invalid_action(self):
        with pytest.raises(SentryAppSentryError):
            IssueLinkCreator(
                install=self.install,
                group=self.group,
                action="doop",
                uri="/link-issue",
                fields={},
                user=serialize_rpc_user(self.user),
            ).run()
