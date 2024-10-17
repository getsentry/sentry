from unittest.mock import patch

from rest_framework import status

from sentry.models.group import Group
from sentry.testutils.cases import APITestCase
from tests.sentry.tasks.integrations.github.test_open_pr_comment import CreateEventTestCase


@patch(
    "sentry.api.endpoints.organization_pull_request_file_issues.get_projects_and_filenames_from_source_file"
)
class OrganizationPullRequestFileIssuesTest(APITestCase, CreateEventTestCase):
    endpoint = "sentry-api-0-organization-pr-file-issues"
    method = "post"

    def setUp(self):
        super().setUp()
        self.user_id = "user_1"
        self.app_id = "app_1"

        self.group_id_1 = [
            self._create_event(
                culprit="issue1",
                user_id=str(i),
                filenames=["bar.py", "foo.py"],
                function_names=["planet", "blue"],
            )
            for i in range(5)
        ][0].group.id
        self.group_id_2 = [
            self._create_event(
                culprit="issue2",
                filenames=["foo.py", "bar.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id

        self.gh_repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )
        self.groups = [
            {
                "group_id": g.id,
                "event_count": 1000 * (i + 1),
                "function_name": "function_" + str(i),
            }
            for i, g in enumerate(Group.objects.all())
        ]
        self.groups.reverse()

        self.login_as(self.user)

    def test_simple(self, mock_reverse_codemappings):
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        patch = """@@ -36,6 +36,7 @@\n def blue(self):"""
        response = self.get_success_response(
            self.organization.slug,
            **{"filename": "foo.py", "repo": self.gh_repo.name, "patch": patch},
        )
        group_urls = [g["url"] for g in response.data]
        assert group_urls == [
            f"http://testserver/organizations/{self.organization.slug}/issues/{self.group_id_2}/",
            f"http://testserver/organizations/{self.organization.slug}/issues/{self.group_id_1}/",
        ]

    def test_limit_validation(self, mock_reverse_codemappings):
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        patch = """@@ -36,6 +36,7 @@\n def blue(self):"""
        self.get_error_response(
            self.organization.slug,
            **{
                "filename": "foo.py",
                "repo": self.gh_repo.name,
                "patch": patch,
                "limit": -1,
            },
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        self.get_error_response(
            self.organization.slug,
            **{
                "filename": "foo.py",
                "repo": self.gh_repo.name,
                "patch": patch,
                "limit": 101,
            },
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        self.get_success_response(
            self.organization.slug,
            **{
                "filename": "foo.py",
                "repo": self.gh_repo.name,
                "patch": patch,
                "limit": 100,
            },
        )

    def test_no_codemappings(self, mock_reverse_codemappings):
        mock_reverse_codemappings.return_value = ([], [])

        patch = """@@ -36,6 +36,7 @@\n def blue(self):"""
        response = self.get_success_response(
            self.organization.slug,
            **{"filename": "foo.py", "repo": self.gh_repo.name, "patch": patch},
        )
        assert response.data == []

    def test_no_functions(self, mock_reverse_codemappings):
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        patch = """@@ -36,6 +36,7 @@\n import pytest"""
        response = self.get_success_response(
            self.organization.slug,
            **{"filename": "foo.py", "repo": self.gh_repo.name, "patch": patch},
        )
        assert response.data == []

    def test_no_issues(self, mock_reverse_codemappings):
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        patch = """@@ -36,6 +36,7 @@\n def purple(self):"""
        response = self.get_success_response(
            self.organization.slug,
            **{"filename": "bar.py", "repo": self.gh_repo.name, "patch": patch},
        )
        assert response.data == []
