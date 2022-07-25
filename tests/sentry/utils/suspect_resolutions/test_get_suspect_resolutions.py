from unittest import mock

from django.utils import timezone

from sentry.models import Commit, CommitFileChange, GroupRelease, GroupStatus, ReleaseCommit
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.get_suspect_resolutions import get_suspect_resolutions
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated
from tests.sentry.utils.suspect_resolutions.test_metric_correlation import (
    END,
    START,
    WINDOW,
    generate_empty_issue_events,
    generate_random_issue_events,
)


class TestProjectIssueCorrelation(TestCase):
    @mock.patch("sentry.tsdb.get_range")
    def test_get_suspect_resolutions(self, mock_get_range):
        project = self.create_project()
        group1 = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        group2 = self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        group1_data = generate_random_issue_events(START, END, WINDOW)
        group2_data = generate_random_issue_events(START, END, WINDOW)

        group1_events = generate_empty_issue_events(START, END, group1_data)
        group2_events = generate_empty_issue_events(START, END, group2_data)

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
        assert get_suspect_resolutions(group1) == {group2.id}

    @mock.patch("sentry.tsdb.get_range")
    def test_get_suspect_resolutions_issue_not_resolved(self, mock_get_range):
        """
        The issue that we are getting suspect resolutions for is not resolved. This should return an empty set even
        if there are issues with correlated commit data and/or error-rates.
        """
        project = self.create_project()
        group1 = self.create_group(
            status=GroupStatus.UNRESOLVED, resolved_at=timezone.now(), project=project
        )
        group2 = self.create_group(project=project, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(project=project, status=GroupStatus.IGNORED)

        group1_events = generate_random_issue_events(START, END, WINDOW)
        group2_events = generate_random_issue_events(START, END, WINDOW)
        group3_events = generate_random_issue_events(START, END, WINDOW)

        mock_get_range.return_value = {
            group1.id: group1_events,
            group2.id: group2_events,
            group3.id: group3_events,
        }

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
        GroupRelease.objects.create(
            project_id=project.id, group_id=group1.id, release_id=release.id
        )
        GroupRelease.objects.create(
            project_id=project.id, group_id=group2.id, release_id=release2.id
        )

        assert get_suspect_resolutions(group1) == set()
        assert get_suspect_resolutions(group2) == set()
        assert get_suspect_resolutions(group3) == set()
