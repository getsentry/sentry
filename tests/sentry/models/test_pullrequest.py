from datetime import timedelta
from hashlib import sha1
from uuid import uuid4

from django.utils import timezone

from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import CommentType, PullRequest, PullRequestCommit
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_resolve_in_commit(self) -> None:
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            # It makes reference to the first group
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        # These are created in resolved_in_commit
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
        ).exists()
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
        ).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

    def test_resolve_in_pull_request(self) -> None:
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            # It makes reference to the second group
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        # These are created in resolved_in_pull_request
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
        ).exists()
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
        ).exists()
        # XXX: Oddly,resolved_in_pull_request doesn't update the group status
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED

    def test_resolve_with_sentry_issue_url(self) -> None:
        """Test that pasting a Sentry issue URL in PR body associates the PR"""
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="Fix n+1 query issue",
            message=f"Reduce insert # on /broadcasts/ by bulk inserting\n\n"
            f"Fixes n+1 issue\nhttps://sentry.sentry.io/issues/{group.id}/",
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        # Verify GroupLink was created
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
        ).exists()

    def test_resolve_with_issue_url_and_short_id(self) -> None:
        """Test that issue URL with qualified short ID works"""
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        pr = PullRequest.objects.create(
            key="2",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="Fix the bug",
            message=f"Fixes https://sentry.io/organizations/test-org/issues/{group.qualified_short_id}/",
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups


class PullRequestRetentionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.old_date = self.now - timedelta(days=100)
        self.recent_date = self.now - timedelta(days=10)
        self.cutoff_date = self.now - timedelta(days=90)

        self.repo = self.create_repo(
            project=self.project,
            name="example-repo",
        )
        self.author = self.create_commit_author(
            project=self.project,
            email="test@example.com",
        )

    def create_pr(self, date_added=None, key=None):
        """Helper to create a PR with specified date"""
        if date_added is None:
            date_added = self.old_date

        pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key=key or "123",
            title="Test PR",
            author=self.author,
        )
        PullRequest.objects.filter(id=pr.id).update(date_added=date_added)
        pr.refresh_from_db()
        return pr

    def test_old_pr_with_no_references_is_unused(self):
        """An old PR with no references should be marked as unused"""
        pr = self.create_pr(date_added=self.old_date)
        assert pr.is_unused(self.cutoff_date)

    def test_recent_pr_is_not_unused(self):
        """A PR created after cutoff date should not be unused (though this shouldn't be queried)"""
        pr = self.create_pr(date_added=self.recent_date)
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_recent_comment_is_not_unused(self):
        """PR with a comment created after cutoff should not be unused"""
        pr = self.create_pr(date_added=self.old_date)

        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.recent_date,
            updated_at=self.old_date,
        )

        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_recently_updated_comment_is_not_unused(self):
        """PR with a comment updated after cutoff should not be unused"""
        pr = self.create_pr(date_added=self.old_date)

        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.recent_date,
        )

        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_old_commit_only_is_unused(self):
        """PR with only an old commit (not in release) should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.old_date)
        self.create_pull_request_commit(pr, commit)
        assert pr.is_unused(self.cutoff_date)

    def test_pr_with_recent_commit_is_not_unused(self):
        """PR with a commit created after cutoff should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.recent_date)
        commit.refresh_from_db()

        self.create_pull_request_commit(pr, commit)
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_commit_in_release_is_not_unused(self):
        """PR with a commit that's part of a release should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.old_date)
        self.create_pull_request_commit(pr, commit)
        release = self.create_release(project=self.project)
        ReleaseCommit.objects.create(
            organization_id=self.organization.id,
            release=release,
            commit=commit,
            order=1,
        )
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_commit_as_release_head_is_not_unused(self):
        """PR with a commit that's a release head should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.old_date)
        self.create_pull_request_commit(pr, commit)
        release = self.create_release(project=self.project)
        ReleaseHeadCommit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            release=release,
            commit=commit,
        )
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_linked_to_existing_group_is_not_unused(self):
        """PR linked to an existing group via GroupLink should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group=group,
            project=self.project,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
            relationship=GroupLink.Relationship.resolves,
        )
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_linked_to_deleted_group_is_unused(self):
        """PR linked to a non-existent group should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        GroupLink.objects.create(
            group_id=999999,  # Non-existent group
            project=self.project,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
            relationship=GroupLink.Relationship.resolves,
        )
        assert pr.is_unused(self.cutoff_date)

    def test_pr_comment_with_existing_group_is_not_unused(self):
        """PR with a comment referencing an existing group should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        group = self.create_group(project=self.project)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[group.id],
        )
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_comment_with_deleted_group_is_unused(self):
        """PR with a comment referencing only non-existent groups should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[999999],  # Non-existent group
        )
        assert pr.is_unused(self.cutoff_date)

    def test_pr_comment_with_mixed_groups_is_not_unused(self):
        """PR with comment referencing both existing and non-existent groups should not be unused"""
        pr = self.create_pr(date_added=self.old_date)
        group = self.create_group(project=self.project)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[group.id, 999999],  # One exists, one doesn't
        )
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_comment_with_empty_groups_is_unused(self):
        """PR with comment that has empty group_ids should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[],
        )
        assert pr.is_unused(self.cutoff_date)

    def test_pr_with_deleted_commit_is_unused(self):
        """PR with a PullRequestCommit pointing to non-existent commit should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        # Create PullRequestCommit with non-existent commit_id. This simulates a commit that was deleted
        PullRequestCommit.objects.create(
            pull_request=pr,
            commit_id=999999,
        )
        assert pr.is_unused(self.cutoff_date)

    def test_complex_pr_with_multiple_references(self):
        """Test a complex scenario with multiple types of references"""
        pr = self.create_pr(date_added=self.old_date)
        # Add old comment with deleted group
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[999999],
        )
        # Add old commit that's not in any release
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.old_date)
        self.create_pull_request_commit(pr, commit)
        # PR with old commit (not in release) should be unused
        assert pr.is_unused(self.cutoff_date)
        commit.delete()
        assert pr.is_unused(self.cutoff_date)

        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.recent_date,
            updated_at=self.old_date,
            comment_type=CommentType.OPEN_PR,
        )
        assert not pr.is_unused(self.cutoff_date)
