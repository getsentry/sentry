from typing import int
from datetime import timedelta

from django.utils import timezone

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.deletions.defaults.commit import CommitDeletionTask
from sentry.models.commit import Commit
from sentry.models.commitcomparison import CommitComparison
from sentry.models.groupcommitresolution import GroupCommitResolution
from sentry.models.grouplink import GroupLink
from sentry.models.groupreaction import GroupReaction, GroupReactionType
from sentry.models.latestreporeleaseenvironment import LatestRepoReleaseEnvironment
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.testutils.cases import TestCase


class CommitDeletionTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project)
        self.old_date = timezone.now() - timedelta(days=91)

    def _create_old_commit(self, key: str = "abc123") -> Commit:
        return Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=key,
            date_added=self.old_date,
        )

    def _get_filtered_commits(self) -> BaseQuerySet[Commit, Commit]:
        task = CommitDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=Commit,
            query={},
        )
        query_filter = task.get_query_filter()
        return Commit.objects.filter(query_filter)

    def test_get_query_filter_orphaned_commit(self) -> None:
        """Test that orphaned commits are selected for deletion"""
        orphaned_commit = self._create_old_commit()
        commits_to_delete = self._get_filtered_commits()
        assert orphaned_commit in commits_to_delete

    def test_get_query_filter_does_not_select_commit_in_release(self) -> None:
        """Test that commits referenced by ReleaseCommit are NOT selected"""
        commit = self._create_old_commit()
        release = self.create_release(project=self.project)
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=release,
            commit=commit,
            order=0,
        )
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_head_commit(self) -> None:
        """Test that commits referenced by ReleaseHeadCommit are NOT selected"""
        commit = self._create_old_commit()
        release = self.create_release(project=self.project)
        ReleaseHeadCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            release=release,
            commit=commit,
        )
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_commit_with_group_reaction(self) -> None:
        """Test that commits with GroupReaction are NOT selected"""
        commit = self._create_old_commit()
        group = self.create_group(project=self.project)
        GroupReaction.objects.create(
            group=group,
            commit=commit,
            reaction=True,
            project=self.project,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_commit_in_comparison(self) -> None:
        """Test that commits in CommitComparison are NOT selected"""
        head_commit = self._create_old_commit(key="head123")
        base_commit = self._create_old_commit(key="base123")
        CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha=head_commit.key,
            head_repo_name="owner/repo",
            head_commit=head_commit,
            base_commit=base_commit,
        )
        commits_to_delete = self._get_filtered_commits()
        assert head_commit not in commits_to_delete
        assert base_commit not in commits_to_delete

    def test_get_query_filter_does_not_select_commit_resolving_group(self) -> None:
        """Test that commits in GroupCommitResolution are NOT selected"""
        commit = self._create_old_commit()
        group = self.create_group(project=self.project)
        GroupCommitResolution.objects.create(group_id=group.id, commit_id=commit.id)
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_latest_repo_commit(self) -> None:
        """Test that commits in LatestRepoReleaseEnvironment are NOT selected"""
        commit = self._create_old_commit()
        release = self.create_release(project=self.project)
        environment = self.create_environment(project=self.project)
        LatestRepoReleaseEnvironment.objects.create(
            repository_id=self.repo.id,
            environment_id=environment.id,
            release_id=release.id,
            commit_id=commit.id,
        )
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_commit_with_grouplink(self) -> None:
        """Test that commits linked to a group via GroupLink are NOT selected"""
        commit = self._create_old_commit()
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group=group,
            project=self.project,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
            relationship=GroupLink.Relationship.resolves,
        )
        commits_to_delete = self._get_filtered_commits()
        assert commit not in commits_to_delete

    def test_get_query_filter_does_not_select_recent_commits(self) -> None:
        """Test that recent commits are NOT selected even if orphaned"""
        recent_commit = Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="recent123",
            date_added=timezone.now() - timedelta(days=30),
        )
        commits_to_delete = self._get_filtered_commits()
        assert recent_commit not in commits_to_delete
