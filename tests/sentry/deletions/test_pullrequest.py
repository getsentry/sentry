from typing import int
from datetime import datetime, timedelta

from django.utils import timezone

from sentry.deletions import get_manager
from sentry.deletions.defaults.pullrequest import PullRequestDeletionTask
from sentry.models.commit import Commit
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestComment, PullRequestCommit
from sentry.testutils.cases import TestCase


class PullRequestDeletionTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="test-repo")
        self.author = self.create_commit_author(project=self.project, email="test@example.com")
        self.now = timezone.now()
        self.old_date = self.now - timedelta(days=100)
        self.recent_date = self.now - timedelta(days=10)
        self.task = PullRequestDeletionTask(manager=get_manager(), model=PullRequest, query={})

    def create_pr(self, key: str, date_added: datetime | None = None) -> PullRequest:
        if date_added is None:
            date_added = self.old_date
        pr = PullRequest.objects.create(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key=key,
            title="Test PR",
            author=self.author,
        )
        PullRequest.objects.filter(id=pr.id).update(date_added=date_added)
        pr.refresh_from_db()
        return pr

    def create_old_commit(self) -> Commit:
        commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.author,
        )
        Commit.objects.filter(id=commit.id).update(date_added=self.old_date)
        return commit

    def create_pull_request_comment(
        self,
        pull_request: PullRequest,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        group_ids: list[int] | None = None,
        external_id: int | None = None,
    ) -> PullRequestComment:
        if external_id is None:
            external_id = PullRequestComment.objects.filter(pull_request=pull_request).count() + 1
        return PullRequestComment.objects.create(
            pull_request=pull_request,
            external_id=external_id,
            created_at=created_at or self.old_date,
            updated_at=updated_at or self.old_date,
            group_ids=group_ids or [],
        )

    def test_query_filter_removes_unused_prs(self) -> None:
        pr_old_unused = self.create_pr("pr1", self.old_date)
        self.create_pr("pr2", self.recent_date)
        pr_with_recent_comment = self.create_pr("pr3", self.old_date)

        self.create_pull_request_comment(
            pull_request=pr_with_recent_comment,
            created_at=self.recent_date,
            updated_at=self.old_date,
        )

        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 1
        assert filtered[0].id == pr_old_unused.id

    def test_query_filter_keeps_pr_with_release_commit(self) -> None:
        pr = self.create_pr("pr_release", self.old_date)
        commit = self.create_old_commit()
        self.create_pull_request_commit(pr, commit)

        release = self.create_release(project=self.project)
        self.create_release_commit(release, commit)

        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 0

    def test_query_filter_keeps_pr_with_valid_group_link(self) -> None:
        pr = self.create_pr("pr_group", self.old_date)
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group=group,
            project=self.project,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
            relationship=GroupLink.Relationship.resolves,
        )

        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 0

    def test_query_filter_deletes_pr_with_invalid_group_link(self) -> None:
        pr = self.create_pr("pr_invalid_group", self.old_date)
        GroupLink.objects.create(
            group_id=999999,  # Non-existent group
            project=self.project,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
            relationship=GroupLink.Relationship.resolves,
        )

        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 1
        assert filtered[0].id == pr.id

    def test_query_filter_with_comment_group_ids(self) -> None:
        pr_valid_group = self.create_pr("pr_valid", self.old_date)
        group = self.create_group(project=self.project)
        self.create_pull_request_comment(
            pull_request=pr_valid_group,
            group_ids=[group.id],
        )

        pr_invalid_group = self.create_pr("pr_invalid", self.old_date)
        self.create_pull_request_comment(
            pull_request=pr_invalid_group,
            group_ids=[999999],  # Non-existent
        )

        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 1
        assert filtered[0].id == pr_invalid_group.id

    def test_get_child_relations_includes_comments_and_commits(self) -> None:
        pr = self.create_pr("pr_children", self.old_date)
        self.create_pull_request_comment(pr)
        commit = self.create_old_commit()
        self.create_pull_request_commit(pr, commit)

        relations = self.task.get_child_relations(pr)

        assert len(relations) == 2
        relation_models = {r.params["model"] for r in relations}
        assert PullRequestComment in relation_models
        assert PullRequestCommit in relation_models

        for relation in relations:
            assert relation.params["query"] == {"pull_request_id": pr.id}

    def test_deletion_cascades_to_children(self) -> None:
        pr = self.create_pr("pr_cascade", self.old_date)
        comment = self.create_pull_request_comment(pr)
        commit = self.create_old_commit()
        pr_commit = self.create_pull_request_commit(pr, commit)

        pr.delete()

        assert not PullRequestComment.objects.filter(id=comment.id).exists()
        assert not PullRequestCommit.objects.filter(id=pr_commit.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()

    def test_query_filter_with_no_prs(self) -> None:
        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert filtered == []

    def test_cutoff_date_is_90_days(self) -> None:
        self.create_pr("pr_89", self.now - timedelta(days=89))
        pr_91_days = self.create_pr("pr_91", self.now - timedelta(days=91))
        filtered = list(PullRequest.objects.filter(self.task.get_query_filter()))
        assert len(filtered) == 1
        assert filtered[0].id == pr_91_days.id

    def test_actual_deletion_execution(self) -> None:
        # Create a mix of PRs that should and shouldn't be deleted
        pr_old_unused = self.create_pr("old_unused", self.old_date)
        pr_recent = self.create_pr("recent", self.recent_date)
        pr_with_release = self.create_pr("with_release", self.old_date)
        comment = self.create_pull_request_comment(pr_old_unused)
        commit = self.create_old_commit()
        pr_commit = self.create_pull_request_commit(pr_old_unused, commit)
        release_commit = self.create_old_commit()
        self.create_pull_request_commit(pr_with_release, release_commit)
        release = self.create_release(project=self.project)
        self.create_release_commit(release, release_commit)
        self.task.chunk(apply_filter=True)

        assert not PullRequest.objects.filter(id=pr_old_unused.id).exists()
        assert not PullRequestComment.objects.filter(id=comment.id).exists()
        assert not PullRequestCommit.objects.filter(id=pr_commit.id).exists()

        assert PullRequest.objects.filter(id=pr_recent.id).exists()
        assert PullRequest.objects.filter(id=pr_with_release.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()
        assert Commit.objects.filter(id=release_commit.id).exists()
