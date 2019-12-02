from __future__ import absolute_import

import responses

from sentry.coreapi import APIUnauthorized
from sentry.mediators.external_issues import IssueLinkCreator
from sentry.models import PlatformExternalIssue
from sentry.testutils import TestCase


class TestIssueLinkCreator(TestCase):
    def setUp(self):
        super(TestIssueLinkCreator, self).setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )

    @responses.activate
    def test_creates_external_issue(self):
        fields = {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"}

        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        result = IssueLinkCreator.run(
            install=self.install,
            group=self.group,
            action="create",
            uri="/link-issue",
            fields=fields,
            user=self.user,
        )

        external_issue = PlatformExternalIssue.objects.all()[0]
        assert result == external_issue
        assert external_issue.web_url == "https://example.com/project/issue-id"
        assert external_issue.display_name == "ProjectName#issue-1"

    def test_invalid_action(self):
        with self.assertRaises(APIUnauthorized):
            IssueLinkCreator.run(
                install=self.install,
                group=self.group,
                action="doop",
                uri="/link-issue",
                fields={},
                user=self.user,
            )
