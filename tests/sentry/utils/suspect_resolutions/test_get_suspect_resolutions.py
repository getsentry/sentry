from unittest import mock

from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.get_suspect_resolutions import get_suspect_resolutions


class TestProjectIssueCorrelation(TestCase):
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=True),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=True),
    )
    def test_get_suspect_resolutions(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        issue = self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(resolved_issue) == {issue.id}

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=False),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=True),
    )
    def test_get_suspect_resolutions_uncorrelated_commit_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(resolved_issue) == set()

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=True),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=False),
    )
    def test_get_suspect_resolutions_uncorrelated_metric_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(resolved_issue) == set()

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=False),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=False),
    )
    def test_get_suspect_resolutions_uncorrelated_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(resolved_issue) == set()

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=False),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=False),
    )
    def test_get_suspect_resolutions_issue_unresolved(self):
        project = self.create_project()
        unresolved_issue = self.create_group(project=project, status=GroupStatus.UNRESOLVED)
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(unresolved_issue) == set()

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=False),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=False),
    )
    def test_get_suspect_resolutions_issue_ignored(self):
        project = self.create_project()
        unresolved_issue = self.create_group(project=project, status=GroupStatus.IGNORED)
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(unresolved_issue) == set()

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=False),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=False),
    )
    def test_get_suspect_resolutions_no_other_issues_in_project(self):
        project = self.create_project()
        unresolved_issue = self.create_group(project=project, status=GroupStatus.IGNORED)

        assert get_suspect_resolutions(unresolved_issue) == set()
