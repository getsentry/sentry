from hashlib import sha1
from unittest.mock import patch
from uuid import uuid4

from sentry.buffer import Buffer
from sentry.models import (
    Activity,
    Commit,
    CommitAuthor,
    Group,
    GroupAssignee,
    GroupHistory,
    GroupHistoryStatus,
    GroupInbox,
    GroupInboxReason,
    GroupLink,
    GroupStatus,
    GroupSubscription,
    OrganizationMember,
    Release,
    ReleaseProject,
    Repository,
    UserEmail,
    UserOption,
    add_group_to_inbox,
)
from sentry.signals import buffer_incr_complete
from sentry.testutils import TestCase


class ResolveGroupResolutionsTest(TestCase):
    @patch("sentry.tasks.clear_expired_resolutions.clear_expired_resolutions.delay")
    def test_simple(self, mock_delay):
        release = Release.objects.create(version="a", organization_id=self.project.organization_id)
        release.add_project(self.project)

        mock_delay.assert_called_once_with(release_id=release.id)


class ResolvedInCommitTest(TestCase):
    def assertResolvedFromCommit(self, group, commit):
        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert Group.objects.filter(
            id=group.id, status=GroupStatus.RESOLVED, resolved_at__isnull=False
        ).exists()
        assert not GroupInbox.objects.filter(group=group).exists()
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
        ).exists()

    def assertNotResolvedFromCommit(self, group, commit):
        assert not GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()
        assert not Group.objects.filter(id=group.id, status=GroupStatus.RESOLVED).exists()
        assert GroupInbox.objects.filter(group=group).exists()

    # TODO(dcramer): pull out short ID matching and expand regexp tests
    def test_simple_no_author(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertResolvedFromCommit(group, commit)

    def test_updating_commit(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
        )

        self.assertNotResolvedFromCommit(group, commit)

        commit.message = f"Foo Biz\n\nFixes {group.qualified_short_id}"
        commit.save()

        self.assertResolvedFromCommit(group, commit)

    def test_updating_commit_with_existing_grouplink(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertResolvedFromCommit(group, commit)

        commit.message = f"Foo Bar Biz\n\nFixes {group.qualified_short_id}"
        commit.save()

        self.assertResolvedFromCommit(group, commit)

    def test_removes_group_link_when_message_changes(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        self.assertResolvedFromCommit(group, commit)

        commit.message = "no groups here"
        commit.save()

        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        self.assertNotResolvedFromCommit(group, commit)

    def test_no_matching_group(self):
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

    def test_matching_author_with_assignment(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        email = UserEmail.objects.get_primary_email(user=user)
        email.is_verified = True
        email.save()
        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)
        OrganizationMember.objects.create(organization=group.project.organization, user=user)
        UserOption.objects.set_value(user=user, key="self_assign_issue", value="1")

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=CommitAuthor.objects.create(
                organization_id=group.organization.id, name=user.name, email=user.email
            ),
        )

        self.assertResolvedFromCommit(group, commit)

        assert GroupAssignee.objects.filter(group=group, user=user).exists()

        assert Activity.objects.filter(
            project=group.project, group=group, type=Activity.ASSIGNED, user=user
        )[0].data == {
            "assignee": str(user.id),
            "assigneeEmail": user.email,
            "assigneeType": "user",
        }

        assert GroupSubscription.objects.filter(group=group, user=user).exists()

    def test_matching_author_without_assignment(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        user = self.create_user(name="Foo Bar", email="foo@example.com", is_active=True)
        email = UserEmail.objects.get_primary_email(user=user)
        email.is_verified = True
        email.save()
        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)
        OrganizationMember.objects.create(organization=group.project.organization, user=user)
        UserOption.objects.set_value(user=user, key="self_assign_issue", value="0")

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
            author=CommitAuthor.objects.create(
                organization_id=group.organization.id, name=user.name, email=user.email
            ),
        )

        self.assertResolvedFromCommit(group, commit)

        assert not Activity.objects.filter(
            project=group.project, group=group, type=Activity.ASSIGNED, user=user
        ).exists()

        assert GroupSubscription.objects.filter(group=group, user=user).exists()


class ProjectHasReleasesReceiverTest(TestCase):
    def test(self):
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

    def test_deleted_release_project(self):
        # Should just not raise an error here if the `ReleaseProject` does not exist
        buffer_incr_complete.send_robust(
            model=ReleaseProject,
            columns={},
            filters={"release_id": -1, "project_id": -2},
            sender=ReleaseProject,
        )
