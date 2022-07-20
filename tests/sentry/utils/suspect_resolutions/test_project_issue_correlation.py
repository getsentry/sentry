import random
from unittest import mock

from django.utils import timezone

from sentry.models import Commit, CommitFileChange, GroupRelease, GroupStatus, ReleaseCommit
from sentry.testutils import TestCase
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
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

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

        project = self.create_project()
        release = self.create_release(project=project, version="1")
        release2 = self.create_release(project=project, version="2")
        repo = self.create_repo(project=project, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
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
            project_id=self.project.id,
            group_id=1,
            release_id=release.id,
            environment=self.environment.name,
            first_seen="2021-02-27 12:00:00",
            last_seen="2022-02-27 12:00:00",
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=2,
            release_id=release2.id,
            environment=self.environment.name,
            first_seen="2021-03-20 12:00:00",
            last_seen="2022-03-27 12:00:00",
        )

        assert get_project_issues_with_correlated_commits_and_error_rate(
            self.project.id, group1
        ) == {group2.id}
