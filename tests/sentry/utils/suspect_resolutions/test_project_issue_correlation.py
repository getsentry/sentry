import random
from unittest import mock

from django.utils import timezone

from sentry.models import Commit, CommitFileChange, GroupRelease, GroupStatus, ReleaseCommit
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated
from sentry.utils.suspect_resolutions.project_issue_correlation import (
    get_project_issues_with_correlated_commits_and_error_rate,
)
from tests.sentry.utils.suspect_resolutions.test_metric_correlation import (
    END,
    START,
    WINDOW,
    generate_issue_error_series,
)


class TestProjectIssueCorrelation(TestCase):
    @mock.patch("sentry.tsdb.get_range")
    def test_project_issue_correlation(self, mock_get_range):
        project = self.create_project()
        group1 = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        group2 = self.create_group(project=project)

        gen_random_start = 1656393120
        gen_random_end = 1656393600

        group1_data = [
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, WINDOW)
        ]
        group2_data = [
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, WINDOW)
        ]

        group1_events = generate_issue_error_series(START, END, group1_data)
        group2_events = generate_issue_error_series(START, END, group2_data)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        release = self.create_release()
        release2 = self.create_release()
        repo = self.create_repo()
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="1"
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="2"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release2, commit=commit2, order=1
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit2, filename=".gitignore"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".komal"
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group1.id, release_id=release.id
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group2.id, release_id=release2.id
        )

        assert is_issue_error_rate_correlated(group1, group2)
        assert is_issue_commit_correlated(group1.id, group2.id, project.id)
        assert get_project_issues_with_correlated_commits_and_error_rate(project.id, group1) == {
            group2.id
        }
