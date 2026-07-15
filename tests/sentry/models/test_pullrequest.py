from datetime import timedelta
from hashlib import sha1
from uuid import uuid4

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestCommit,
    parse_pull_request_number,
)
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class FindReferencedGroupsTest(TestCase):
    def test_resolve_in_commit(self) -> None:
        """
        Commits create GroupLinks and referenced activity, but do NOT immediately
        resolve issues. Resolution happens when a release is created that includes
        these commits, via update_group_resolutions().
        """
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
        ).exists()
        activity = Activity.objects.get(
            group=group,
            type=ActivityType.REFERENCED_IN_COMMIT.value,
        )
        assert activity.data == {"commit": commit.id}
        assert not Activity.objects.filter(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
        ).exists()
        assert not GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
        ).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED

    def test_resolve_in_commit_resolved_via_release(self) -> None:
        """
        A commit referencing a group on a feature branch leaves the group unresolved.
        Once that commit lands in a release (i.e. is merged to the default branch
        and shipped), the release creation flow resolves the group via
        update_group_resolutions().
        """
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        # Feature-branch commit: GroupLink exists but group is still unresolved.
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
        ).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED

        # Commit lands in a release; resolution should now fire.
        release = self.create_release(project=group.project, version="1.0.0")
        release.set_commits([{"id": commit.key, "repository": repo.name}])

        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        activity = Activity.objects.get(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
        )
        assert activity.data == {"version": release.version, "commit": commit.id}
        assert activity.ident == str(resolution.id)

        serialized_data = serialize(activity)["data"]
        assert serialized_data["version"] == release.version
        assert serialized_data["commit"]["id"] == commit.key

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

        pr.message = "no groups here"
        pr.save()

        assert not GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
        ).exists()

    def test_resolve_in_pull_request_resolved_via_release(self) -> None:
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=group.organization.id)
        merge_commit_sha = sha1(uuid4().hex.encode("utf-8")).hexdigest()

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            merge_commit_sha=merge_commit_sha,
        )

        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
        ).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED

        release = self.create_release(project=group.project, version="1.0.0")
        release.set_commits([{"id": merge_commit_sha, "repository": repo.name}])

        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        activity = Activity.objects.get(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
        )
        commit = Commit.objects.get(key=merge_commit_sha)
        assert activity.data == {"version": release.version, "commit": commit.id}
        assert activity.ident == str(resolution.id)

        serialized_data = serialize(activity)["data"]
        assert serialized_data["version"] == release.version
        assert serialized_data["commit"]["id"] == commit.key
        assert serialized_data["commit"]["pullRequest"]["id"] == pr.key


class PullRequestRetentionTest(TestCase):
    def setUp(self) -> None:
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

    def test_old_pr_with_no_references_is_unused(self) -> None:
        """An old PR with no references should be marked as unused"""
        pr = self.create_pr(date_added=self.old_date)
        assert pr.is_unused(self.cutoff_date)

    def test_recent_pr_is_not_unused(self) -> None:
        """A PR created after cutoff date should not be unused (though this shouldn't be queried)"""
        pr = self.create_pr(date_added=self.recent_date)
        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_recent_comment_is_not_unused(self) -> None:
        """PR with a comment created after cutoff should not be unused"""
        pr = self.create_pr(date_added=self.old_date)

        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.recent_date,
            updated_at=self.old_date,
        )

        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_recently_updated_comment_is_not_unused(self) -> None:
        """PR with a comment updated after cutoff should not be unused"""
        pr = self.create_pr(date_added=self.old_date)

        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.recent_date,
        )

        assert not pr.is_unused(self.cutoff_date)

    def test_pr_with_old_commit_only_is_unused(self) -> None:
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

    def test_pr_with_recent_commit_is_not_unused(self) -> None:
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

    def test_pr_with_commit_in_release_is_not_unused(self) -> None:
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

    def test_pr_with_commit_as_release_head_is_not_unused(self) -> None:
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

    def test_pr_linked_to_existing_group_is_not_unused(self) -> None:
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

    def test_pr_linked_to_deleted_group_is_unused(self) -> None:
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

    def test_pr_comment_with_existing_group_is_not_unused(self) -> None:
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

    def test_pr_comment_with_deleted_group_is_unused(self) -> None:
        """PR with a comment referencing only non-existent groups should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[999999],  # Non-existent group
        )
        assert pr.is_unused(self.cutoff_date)

    def test_pr_comment_with_mixed_groups_is_not_unused(self) -> None:
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

    def test_pr_comment_with_empty_groups_is_unused(self) -> None:
        """PR with comment that has empty group_ids should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        self.create_pull_request_comment(
            pull_request=pr,
            created_at=self.old_date,
            updated_at=self.old_date,
            group_ids=[],
        )
        assert pr.is_unused(self.cutoff_date)

    def test_pr_with_deleted_commit_is_unused(self) -> None:
        """PR with a PullRequestCommit pointing to non-existent commit should be unused"""
        pr = self.create_pr(date_added=self.old_date)
        # Create PullRequestCommit with non-existent commit_id. This simulates a commit that was deleted
        PullRequestCommit.objects.create(
            pull_request=pr,
            commit_id=999999,
        )
        assert pr.is_unused(self.cutoff_date)

    def test_complex_pr_with_multiple_references(self) -> None:
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


class GetOrCreateFromReferenceTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )

    def _resolve(
        self,
        *,
        repo_name: str = "getsentry/sentry",
        provider: str | None = "github",
        key: int | str = 42,
    ):
        return PullRequest.objects.get_or_create_from_reference(
            organization_id=self.organization.id,
            repo_name=repo_name,
            provider=provider,
            key=key,
        )

    def test_resolves_and_creates_pull_request(self) -> None:
        resolved = self._resolve()

        assert resolved.repo_resolution == "resolved"
        assert resolved.provider_unmappable is False
        assert resolved.pull_request is not None
        assert resolved.pull_request.repository_id == self.repo.id
        assert resolved.pull_request.key == "42"

    def test_coerces_integer_key_to_string(self) -> None:
        resolved = self._resolve(key=7)

        assert resolved.pull_request is not None
        assert resolved.pull_request.key == "7"

    def test_reuses_existing_pull_request_without_overwriting(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Real title",
        )

        resolved = self._resolve()

        assert resolved.pull_request is not None
        assert resolved.pull_request.id == existing.id
        # The shell find-or-create must not clobber a title a webhook already filled in.
        resolved.pull_request.refresh_from_db()
        assert resolved.pull_request.title == "Real title"
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1

    def test_resolves_by_provider_when_name_collides(self) -> None:
        gitlab_repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:gitlab"
        )

        resolved = self._resolve(provider="github")

        assert resolved.pull_request is not None
        assert resolved.pull_request.repository_id == self.repo.id
        assert not PullRequest.objects.filter(repository_id=gitlab_repo.id).exists()

    def test_not_found_when_no_repository_matches(self) -> None:
        resolved = self._resolve(repo_name="getsentry/does-not-exist")

        assert resolved.pull_request is None
        assert resolved.repo_resolution == "not_found"
        assert resolved.provider_unmappable is False

    def test_ambiguous_when_unknown_provider_matches_many(self) -> None:
        self.create_repo(self.project, name="getsentry/sentry", provider="integrations:gitlab")

        # Two same-named repos under different providers and no provider to disambiguate —
        # refuse to guess rather than risk mis-resolution.
        resolved = self._resolve(provider="unknown")

        assert resolved.pull_request is None
        assert resolved.repo_resolution == "ambiguous"
        assert not PullRequest.objects.exists()

    def test_resolves_unknown_provider_when_unambiguous(self) -> None:
        resolved = self._resolve(provider="unknown")

        assert resolved.pull_request is not None
        # The "unknown" sentinel is treated as absent, not unmappable.
        assert resolved.provider_unmappable is False

    def test_flags_unmappable_provider(self) -> None:
        # An unmapped provider is surfaced via provider_unmappable=True. Resolution still
        # filters by it, so a repo stored under a recognized provider won't match.
        resolved = self._resolve(provider="subversion")

        assert resolved.provider_unmappable is True
        assert resolved.pull_request is None
        assert resolved.repo_resolution == "not_found"

    def test_unmappable_provider_resolves_against_a_matching_repo(self) -> None:
        svn_repo = self.create_repo(self.project, name="svn/project", provider="subversion")

        resolved = self._resolve(repo_name="svn/project", provider="subversion")

        # Still flagged, but resolution is attempted and succeeds when a repo actually
        # carries that provider.
        assert resolved.provider_unmappable is True
        assert resolved.pull_request is not None
        assert resolved.pull_request.repository_id == svn_repo.id

    def test_scopes_resolution_to_the_given_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(
            other_project, name="getsentry/sentry", provider="integrations:github"
        )

        resolved = PullRequest.objects.get_or_create_from_reference(
            organization_id=other_org.id,
            repo_name="getsentry/sentry",
            provider="github",
            key=42,
        )

        assert resolved.pull_request is not None
        assert resolved.pull_request.repository_id == other_repo.id
        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()


class ParsePullRequestNumberTest(TestCase):
    def test_extracts_number_from_supported_url_shapes(self) -> None:
        # Each provider segment the regex recognizes must yield the trailing number.
        cases = [
            ("https://github.com/getsentry/sentry/pull/42", 42),
            ("https://github.com/getsentry/sentry/pulls/7", 7),
            ("https://gitlab.com/getsentry/sentry/merge_requests/13", 13),
        ]
        for url, expected in cases:
            assert parse_pull_request_number(url) == expected

    def test_returns_none_when_no_pr_segment(self) -> None:
        # A branch/tree URL or a number-less path must not be mistaken for a PR.
        cases = [
            "https://github.com/getsentry/sentry/tree/123",
            "https://github.com/getsentry/sentry/pulls",
            "https://github.com/getsentry/sentry",
        ]
        for url in cases:
            assert parse_pull_request_number(url) is None
