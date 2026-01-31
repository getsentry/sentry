from hashlib import sha1
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.buffer.base import Buffer
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
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.signals import buffer_incr_complete, receivers_raise_on_send
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
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

    With "organizations:defer-commit-resolution" flag ON (new behavior):
    Commits with "Fixes ISSUE-123" create GroupLinks and Activity entries,
    but do NOT immediately resolve issues. Resolution happens when a release is
    created that includes these commits, via update_group_resolutions().

    With flag OFF (legacy behavior): Issues are immediately resolved when commits
    are pushed.
    """

    def assertLinkedFromCommitDeferred(self, group, commit):
        """Assert that a GroupLink, Activity, and GroupHistory were created, but issue is NOT resolved."""
        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT
        ).exists()
        # Issue should NOT be resolved immediately - resolution happens via releases
        assert not Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        # Inbox should NOT be modified
        assert GroupInbox.objects.filter(group=group).exists()

    def assertLinkedFromCommitImmediate(self, group, commit):
        """Assert that a GroupLink, Activity, GroupHistory were created, and issue IS resolved (legacy behavior)."""
        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT
        ).exists()
        # Issue should be resolved immediately (legacy behavior)
        assert Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        # Inbox should be removed
        assert not GroupInbox.objects.filter(group=group).exists()

    def assertNotLinkedFromCommit(self, group, commit):
        """Assert that no GroupLink exists for this commit."""
        assert not GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert not Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        assert GroupInbox.objects.filter(group=group).exists()

    # Tests with defer-commit-resolution flag ON (new behavior) #

    @with_feature("organizations:defer-commit-resolution")
    @receivers_raise_on_send()
    def test_simple_no_author(self) -> None:
        """With defer-commit-resolution ON, commits create links but don't resolve issues."""
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

    @with_feature("organizations:defer-commit-resolution")
    @receivers_raise_on_send()
    def test_updating_commit(self) -> None:
        """With defer-commit-resolution ON, updating a commit message creates links but doesn't resolve."""
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

    @with_feature("organizations:defer-commit-resolution")
    @receivers_raise_on_send()
    def test_updating_commit_with_existing_grouplink(self) -> None:
        """With defer-commit-resolution ON, updating commit with existing link keeps deferred state."""
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

    @with_feature("organizations:defer-commit-resolution")
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

    @with_feature("organizations:defer-commit-resolution")
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

    @with_feature("organizations:defer-commit-resolution")
    @receivers_raise_on_send()
    def test_matching_author_with_assignment(self) -> None:
        """With defer-commit-resolution ON, commits assign users but don't resolve issues."""
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

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=author,
        )

        self.assertLinkedFromCommitDeferred(group, commit)

        assert GroupAssignee.objects.filter(group=group, user_id=user.id).exists()

        assert Activity.objects.filter(
            project=group.project, group=group, type=ActivityType.ASSIGNED.value, user_id=user.id
        )[0].data == {
            "assignee": str(user.id),
            "assigneeEmail": user.email,
            "assigneeName": user.name,
            "assigneeType": "user",
        }

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

    @with_feature("organizations:defer-commit-resolution")
    @receivers_raise_on_send()
    def test_matching_author_without_assignment(self) -> None:
        """With defer-commit-resolution ON, commits subscribe users but don't resolve issues."""
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

    # Tests with defer-commit-resolution flag OFF (legacy behavior) #

    @with_feature({"organizations:defer-commit-resolution": False})
    @receivers_raise_on_send()
    def test_immediate_resolution_without_flag(self) -> None:
        """Without defer-commit-resolution flag, commits immediately resolve issues (legacy behavior)."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertLinkedFromCommitImmediate(group, commit)

    @with_feature({"organizations:defer-commit-resolution": False})
    @receivers_raise_on_send()
    def test_immediate_resolution_with_author(self) -> None:
        """Without flag, commits with authors immediately resolve and assign issues."""
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            email = UserEmail.objects.get_primary_email(user=user)
            email.is_verified = True
            email.save()
            UserOption.objects.set_value(user=user, key="self_assign_issue", value="1")

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)
        OrganizationMember.objects.create(organization=group.project.organization, user_id=user.id)

        author = CommitAuthor.objects.create(
            organization_id=group.organization.id, name=user.name, email=user.email
        )
        author.preload_users()

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=author,
        )

        # Issue should be immediately resolved (legacy behavior)
        self.assertLinkedFromCommitImmediate(group, commit)

        # Author should still be assigned
        assert GroupAssignee.objects.filter(group=group, user_id=user.id).exists()
        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()


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
