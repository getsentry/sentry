from hashlib import sha1
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.buffer.base import Buffer
from sentry.integrations.types import ExternalProviders
from sentry.issues.action_log.types import (
    PullRequestClosedAction,
    PullRequestMergedAction,
    PullRequestReopenedAction,
    PullRequestUnlinkedAction,
)
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.signals import buffer_incr_complete, receivers_raise_on_send
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import capture_action_log
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail


class ResolveGroupResolutionsTest(TestCase):
    @patch("sentry.tasks.clear_expired_resolutions.clear_expired_resolutions.delay")
    def test_simple(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            release = Release.objects.create(
                version="a", organization_id=self.project.organization_id
            )
            release.add_project(self.project)

        mock_delay.assert_called_once_with(release_id=release.id)


class ResolvedInCommitTest(TestCase):
    """
    Tests for resolved_in_commit signal handler.

    Commits with "Fixes ISSUE-123" create GroupLinks and REFERENCED_IN_COMMIT
    Activity entries, but do NOT immediately resolve issues. Resolution happens
    when a release is created that includes these commits, via update_group_resolutions().
    """

    def assertLinkedFromCommitDeferred(self, group, commit):
        """Assert that a GroupLink and Activity were created, but issue is NOT resolved."""
        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        activity = Activity.objects.get(
            group=group,
            type=ActivityType.REFERENCED_IN_COMMIT.value,
        )
        assert activity.data == {"commit": commit.id}
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        ).exists()
        assert not GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT
        ).exists()
        # Issue should NOT be resolved immediately - resolution happens via releases
        assert not Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        # Inbox should NOT be modified
        assert GroupInbox.objects.filter(group=group).exists()

    def assertNotLinkedFromCommit(self, group, commit):
        """Assert that no GroupLink exists for this commit."""
        assert not GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert not Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        assert GroupInbox.objects.filter(group=group).exists()

    @receivers_raise_on_send()
    def test_simple_no_author(self) -> None:
        """Commits create links but don't resolve issues."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertLinkedFromCommitDeferred(group, commit)

    @receivers_raise_on_send()
    def test_updating_commit(self) -> None:
        """Updating a commit message creates links but doesn't resolve."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
        )

        self.assertNotLinkedFromCommit(group, commit)

        commit.message = f"Foo Biz\n\nFixes {group.qualified_short_id}"
        commit.save()

        self.assertLinkedFromCommitDeferred(group, commit)

    @receivers_raise_on_send()
    def test_updating_commit_with_existing_grouplink(self) -> None:
        """Updating commit with existing link keeps deferred state."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertLinkedFromCommitDeferred(group, commit)

        commit.message = f"Foo Bar Biz\n\nFixes {group.qualified_short_id}"
        commit.save()

        self.assertLinkedFromCommitDeferred(group, commit)

    @receivers_raise_on_send()
    def test_removes_group_link_when_message_changes(self) -> None:
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertLinkedFromCommitDeferred(group, commit)

        commit.message = "no groups here"
        commit.save()

        self.assertNotLinkedFromCommit(group, commit)

    @receivers_raise_on_send()
    def test_no_matching_group(self) -> None:
        repo = Repository.objects.create(name="example", organization_id=self.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=self.organization.id,
            message=f"Foo Biz\n\nFixes {self.project.slug.upper()}-12F",
        )

        assert not GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()

    @receivers_raise_on_send()
    def test_matching_author_with_assignment(self) -> None:
        """Commits assign users but don't resolve issues."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            email = UserEmail.objects.get_primary_email(user=user)
        email.is_verified = True
        with assume_test_silo_mode(SiloMode.CONTROL):
            email.save()
        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)
        OrganizationMember.objects.create(organization=group.project.organization, user_id=user.id)
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.set_value(user=user, key="self_assign_issue", value="1")

        author = CommitAuthor.objects.create(
            organization_id=group.organization.id, name=user.name, email=user.email
        )
        author.preload_users()

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            commit = Commit.objects.create(
                key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
                organization_id=group.organization.id,
                repository_id=repo.id,
                message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
                author=author,
            )

        self.assertLinkedFromCommitDeferred(group, commit)

        assert GroupAssignee.objects.filter(group=group, user_id=user.id).exists()

        # The self-assign is attributed to the commit author, not logged as a system action.
        assign_records = [r for r in logs.records if r.__dict__.get("action") == "assign"]
        assert len(assign_records) == 1
        assert assign_records[0].__dict__["actor_id"] == str(user.id)
        assert assign_records[0].__dict__["actor_type"] == "user"
        assert assign_records[0].__dict__["source"] == "system"

        assert Activity.objects.filter(
            project=group.project, group=group, type=ActivityType.ASSIGNED.value, user_id=user.id
        )[0].data == {
            "assignee": str(user.id),
            "assigneeEmail": user.email,
            "assigneeName": user.name,
            "assigneeType": "user",
        }

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

    @receivers_raise_on_send()
    def test_matching_author_without_assignment(self) -> None:
        """Commits subscribe users but don't resolve issues."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            email = UserEmail.objects.get_primary_email(user=user)
            email.is_verified = True
            email.save()
            UserOption.objects.set_value(user=user, key="self_assign_issue", value="0")

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)
        OrganizationMember.objects.create(organization=group.project.organization, user_id=user.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=CommitAuthor.objects.create(
                organization_id=group.organization.id, name=user.name, email=user.email
            ),
        )

        self.assertLinkedFromCommitDeferred(group, commit)

        assert not Activity.objects.filter(
            project=group.project, group=group, type=ActivityType.ASSIGNED.value, user_id=user.id
        ).exists()

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()


class ResolvedInPullRequestTest(TestCase):
    def _create_pull_request_author(
        self, github_username: str, organization_id: int
    ) -> CommitAuthor:
        author = self.create_commit_author(
            organization_id=organization_id,
            email=f"{github_username}@localhost",
        )
        author.update(name=github_username, external_id=f"github:{github_username}")
        return author

    def _create_resolving_pull_request(
        self, group: Group, repo: Repository, author: CommitAuthor
    ) -> PullRequest:
        return self.create_pull_request(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=author,
        )

    @receivers_raise_on_send()
    def test_matching_external_actor_sets_activity_user(self) -> None:
        group = self.create_group()
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        self.create_member(organization=group.organization, user=user)
        integration = self.create_integration(
            organization=group.organization,
            external_id="github:1",
            provider="github",
        )
        self.create_external_user(
            user=user,
            organization=group.organization,
            integration=integration,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newdev",
        )
        other_user = self.create_user(email="other@example.com")
        self.create_member(organization=group.organization, user=other_user)
        other_integration = self.create_integration(
            organization=group.organization,
            external_id="github:2",
            provider="github",
        )
        self.create_external_user(
            user=other_user,
            organization=group.organization,
            integration=other_integration,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newdev",
        )
        repo = self.create_repo(
            project=group.project,
            provider="integrations:github",
            integration_id=integration.id,
        )
        author = self._create_pull_request_author("newdev", group.organization.id)

        pull_request = self._create_resolving_pull_request(group, repo, author)

        activity = Activity.objects.get(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
        )
        assert activity.user_id == user.id
        assert activity.data == {"pull_request": pull_request.id}
        assert GroupAssignee.objects.filter(group=group, user_id=user.id).exists()

    @receivers_raise_on_send()
    def test_author_from_different_organization_does_not_set_activity_user(self) -> None:
        group = self.create_group()
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        other_organization = self.create_organization(owner=user)
        self.create_member(organization=group.organization, user=user)
        integration = self.create_integration(
            organization=other_organization,
            external_id="github:1",
            provider="github",
        )
        self.create_external_user(
            user=user,
            organization=other_organization,
            integration=integration,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newdev",
        )
        repo = self.create_repo(project=group.project, provider="integrations:github")
        author = self._create_pull_request_author("newdev", other_organization.id)

        self._create_resolving_pull_request(group, repo, author)

        activity = Activity.objects.get(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
        )
        assert activity.user_id is None
        assert not GroupAssignee.objects.filter(group=group).exists()

    @receivers_raise_on_send()
    def test_external_actor_user_must_be_organization_member(self) -> None:
        group = self.create_group()
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        integration = self.create_integration(
            organization=group.organization,
            external_id="github:1",
            provider="github",
        )
        self.create_external_user(
            user=user,
            organization=group.organization,
            integration=integration,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newdev",
        )
        repo = self.create_repo(
            project=group.project,
            provider="integrations:github",
            integration_id=integration.id,
        )
        author = self._create_pull_request_author("newdev", group.organization.id)

        self._create_resolving_pull_request(group, repo, author)

        activity = Activity.objects.get(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
        )
        assert activity.user_id is None
        assert not GroupAssignee.objects.filter(group=group).exists()


class ProjectHasReleasesReceiverTest(TestCase):
    @receivers_raise_on_send()
    def test(self) -> None:
        buffer = Buffer()
        rp = ReleaseProject.objects.get_or_create(release=self.release, project=self.project)[0]
        self.project.flags.has_releases = False
        self.project.update(flags=self.project.flags)
        buffer.process(
            ReleaseProject,
            {"new_groups": 1},
            {"release_id": rp.release_id, "project_id": rp.project_id},
        )
        self.project.refresh_from_db()
        assert self.project.flags.has_releases

    @receivers_raise_on_send()
    def test_deleted_release_project(self) -> None:
        # Should just not raise an error here if the `ReleaseProject` does not exist
        buffer_incr_complete.send_robust(
            model=ReleaseProject,
            columns={},
            filters={"release_id": -1, "project_id": -2},
            sender=ReleaseProject,
        )


@with_feature("organizations:pr-lifecycle-activity")
class PullRequestLifecycleSignalTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="example/repo")
        self.group = self.create_group(project=self.project)
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="1"
        )
        self.pull_request.message = f"Fixes {self.group.qualified_short_id}"
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pull_request.id,
        )

    def _save_with_state(self, state: str) -> None:
        self.pull_request.state = state
        self.pull_request.save()

    def _link_pr(self, group: Group, key: str, state: str | None) -> PullRequest:
        pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key=key
        )
        pr.message = f"Fixes {group.qualified_short_id}"
        PullRequest.objects.filter(id=pr.id).update(state=state, message=pr.message)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=pr.id,
        )
        return pr

    def test_closed_emits_activity(self) -> None:
        self._save_with_state(PullRequestLifecycleState.CLOSED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert activity.ident == str(self.pull_request.id)
        assert activity.data == {
            "pull_request": self.pull_request.id,
            "has_other_open_prs": False,
        }

    @with_feature({"organizations:pr-lifecycle-activity": False})
    def test_flag_disabled_still_emits_closed_activity(self) -> None:
        self._save_with_state(PullRequestLifecycleState.CLOSED)

        assert Activity.objects.filter(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        ).exists()

    @with_feature({"organizations:pr-lifecycle-activity": False})
    def test_flag_disabled_does_not_emit_merged_activity(self) -> None:
        self._save_with_state(PullRequestLifecycleState.MERGED)

        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.PULL_REQUEST_MERGED.value
        ).exists()

    def test_open_sibling_pr_counts_as_remaining(self) -> None:
        self._link_pr(self.group, key="2", state=PullRequestLifecycleState.OPEN)

        self._save_with_state(PullRequestLifecycleState.CLOSED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert activity.data["has_other_open_prs"] is True

    def test_null_state_sibling_counts_as_remaining(self) -> None:
        self._link_pr(self.group, key="2", state=None)

        self._save_with_state(PullRequestLifecycleState.CLOSED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert activity.data["has_other_open_prs"] is True

    def test_merged_sibling_does_not_count_as_remaining(self) -> None:
        self._link_pr(self.group, key="2", state=PullRequestLifecycleState.MERGED)

        self._save_with_state(PullRequestLifecycleState.CLOSED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert activity.data["has_other_open_prs"] is False

    def test_last_open_pr_closing_reports_zero_remaining(self) -> None:
        other = self._link_pr(self.group, key="2", state=PullRequestLifecycleState.OPEN)

        # First PR closes while the second is still open.
        self._save_with_state(PullRequestLifecycleState.CLOSED)
        first_activity = Activity.objects.get(
            group=self.group,
            type=ActivityType.PULL_REQUEST_CLOSED.value,
            ident=str(self.pull_request.id),
        )
        assert first_activity.data["has_other_open_prs"] is True

        # The second (and last) PR closes -> nothing open remains.
        other.state = PullRequestLifecycleState.CLOSED
        other.save()
        second_activity = Activity.objects.get(
            group=self.group,
            type=ActivityType.PULL_REQUEST_CLOSED.value,
            ident=str(other.id),
        )
        assert second_activity.data["has_other_open_prs"] is False

    def test_per_group_counts_when_pr_links_two_groups(self) -> None:
        other_group = self.create_group(project=self.project)
        # The closing PR also links the second group.
        GroupLink.objects.create(
            group_id=other_group.id,
            project_id=other_group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pull_request.id,
        )
        # Only the second group has another open PR.
        self._link_pr(other_group, key="2", state=PullRequestLifecycleState.OPEN)

        self._save_with_state(PullRequestLifecycleState.CLOSED)

        first = Activity.objects.get(group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value)
        second = Activity.objects.get(
            group=other_group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert first.data["has_other_open_prs"] is False
        assert second.data["has_other_open_prs"] is True

    def test_merged_emits_activity(self) -> None:
        with capture_action_log() as action_log:
            self._save_with_state(PullRequestLifecycleState.MERGED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_MERGED.value
        )
        assert activity.data == {
            "pull_request": self.pull_request.id,
            "has_other_open_prs": False,
        }
        action_log.assert_logged(
            PullRequestMergedAction,
            group_id=self.group.id,
            pull_request=self.pull_request.id,
            has_other_open_prs=False,
        )

    def test_superseded_emits_closed_activity(self) -> None:
        with capture_action_log() as action_log:
            self._save_with_state(PullRequestLifecycleState.SUPERSEDED)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_CLOSED.value
        )
        assert activity.data == {
            "pull_request": self.pull_request.id,
            "has_other_open_prs": False,
        }
        action_log.assert_logged(
            PullRequestClosedAction,
            group_id=self.group.id,
            pull_request=self.pull_request.id,
            has_other_open_prs=False,
        )

    def test_reopened_emits_activity(self) -> None:
        PullRequest.objects.filter(id=self.pull_request.id).update(
            state=PullRequestLifecycleState.CLOSED
        )
        self.pull_request.state = PullRequestLifecycleState.CLOSED

        with capture_action_log() as action_log:
            self._save_with_state(PullRequestLifecycleState.OPEN)

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_REOPENED.value
        )
        assert activity.data == {"pull_request": self.pull_request.id}
        action_log.assert_logged(
            PullRequestReopenedAction,
            group_id=self.group.id,
            pull_request=self.pull_request.id,
        )

    def test_unlinked_emits_activity(self) -> None:
        self.pull_request.message = "No issue reference"
        with capture_action_log() as action_log:
            self.pull_request.save()

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_UNLINKED.value
        )
        assert activity.data == {
            "pull_request": self.pull_request.id,
            "has_other_open_prs": False,
        }
        action_log.assert_logged(
            PullRequestUnlinkedAction,
            group_id=self.group.id,
            pull_request=self.pull_request.id,
            has_other_open_prs=False,
        )

    def test_unlinked_with_open_sibling_reports_remaining(self) -> None:
        self._link_pr(self.group, key="2", state=PullRequestLifecycleState.OPEN)
        self.pull_request.message = "No issue reference"

        self.pull_request.save()

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.PULL_REQUEST_UNLINKED.value
        )
        assert activity.data["has_other_open_prs"] is True

    def test_open_does_not_emit_activity(self) -> None:
        self._save_with_state(PullRequestLifecycleState.OPEN)

        assert not Activity.objects.filter(
            type__in=(
                ActivityType.PULL_REQUEST_CLOSED.value,
                ActivityType.PULL_REQUEST_REOPENED.value,
                ActivityType.PULL_REQUEST_MERGED.value,
                ActivityType.PULL_REQUEST_UNLINKED.value,
            )
        ).exists()

    def test_resaving_closed_pr_does_not_duplicate(self) -> None:
        self._save_with_state(PullRequestLifecycleState.CLOSED)
        self._save_with_state(PullRequestLifecycleState.CLOSED)

        assert Activity.objects.filter(type=ActivityType.PULL_REQUEST_CLOSED.value).count() == 1
