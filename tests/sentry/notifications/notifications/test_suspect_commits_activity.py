from typing import int
from django.db.models import F
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.organization import Organization
from sentry.notifications.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SuspectCommitsInActivityNotificationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

        self.repo = self.create_repo(
            project=self.project,
            name="example/repo",
        )

        # Create a second user for multi-user tests
        self.user2 = self.create_user(name="Jane Doe", email="jane@example.com")

        self.commit1 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.create_commit_author(project=self.project, user=self.user),
            key="abc123def456",
            message="feat: Add new feature\n\nDetailed description of the feature.",
        )

        self.commit2 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.create_commit_author(project=self.project, user=self.user2),
            key="def456ghi789",
            message="fix: Critical bug fix",
        )

    def _create_suspect_commit_owner(self, commit, user=None):
        """Helper to create a GroupOwner record for suspect commit."""
        return GroupOwner.objects.create(
            group=self.group,
            user_id=(user or self.user).id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

    @with_feature("organizations:suspect-commits-in-emails")
    def test_assigned_notification_includes_suspect_commits(self):
        self._create_suspect_commit_owner(self.commit1)

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = AssignedActivityNotification(activity)
        context = notification.get_context()

        assert "commits" in context
        assert len(context["commits"]) == 1
        assert context["commits"][0]["subject"] == "feat: Add new feature"
        assert context["commits"][0]["shortId"] == "abc123d"
        assert context["commits"][0]["author"]["name"] == self.user.get_display_name()

    @with_feature("organizations:suspect-commits-in-emails")
    def test_unassigned_notification_includes_suspect_commits(self):
        # First assign, then unassign
        GroupAssignee.objects.create(
            group=self.group,
            project=self.project,
            user_id=self.user.id,
            date_added=timezone.now(),
        )

        self._create_suspect_commit_owner(self.commit1)

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.UNASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = UnassignedActivityNotification(activity)
        context = notification.get_context()

        assert "commits" in context
        assert len(context["commits"]) == 1
        assert context["commits"][0]["subject"] == "feat: Add new feature"

    @with_feature("organizations:suspect-commits-in-emails")
    def test_resolved_notification_includes_suspect_commits(self):
        self._create_suspect_commit_owner(self.commit1)

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
            data={},
        )

        notification = ResolvedActivityNotification(activity)
        context = notification.get_context()

        assert "commits" in context
        assert len(context["commits"]) == 1
        assert context["commits"][0]["subject"] == "feat: Add new feature"

    @with_feature("organizations:suspect-commits-in-emails")
    def test_note_notification_includes_suspect_commits(self):
        self._create_suspect_commit_owner(self.commit1)

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "This is a test comment"},
        )

        notification = NoteActivityNotification(activity)
        context = notification.get_context()

        assert "commits" in context
        assert len(context["commits"]) == 1
        assert context["commits"][0]["subject"] == "feat: Add new feature"

    @with_feature("organizations:suspect-commits-in-emails")
    def test_multiple_suspect_commits_in_notification(self):
        """Test that when multiple suspect commits exist, only the most recent one is returned."""
        # Create GroupOwner records for both commits
        self._create_suspect_commit_owner(self.commit1)
        self._create_suspect_commit_owner(self.commit2, self.user2)

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = AssignedActivityNotification(activity)
        context = notification.get_context()

        # Assert only one commit is returned (the most recent one by date_added)
        assert "commits" in context
        assert len(context["commits"]) == 1

        # Since commit2 was created after commit1 (more recent), it should be returned
        commit = context["commits"][0]
        assert commit["subject"] == "fix: Critical bug fix"
        assert commit["id"] == "def456ghi789"

    @with_feature("organizations:suspect-commits-in-emails")
    def test_notification_without_suspect_commits(self):
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = AssignedActivityNotification(activity)
        context = notification.get_context()

        assert "commits" in context
        assert context["commits"] == []

    @with_feature("organizations:suspect-commits-in-emails")
    def test_graceful_handling_of_invalid_commit_ids(self):
        # Create GroupOwner with invalid commit ID
        GroupOwner.objects.create(
            group=self.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": 99999},  # Non-existent commit ID
        )

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = AssignedActivityNotification(activity)
        # Should not raise an exception
        context = notification.get_context()

        assert "commits" in context
        assert context["commits"] == []

    @with_feature("organizations:suspect-commits-in-emails")
    def test_enhanced_privacy_hides_suspect_commits(self):
        """Test that suspect commits are hidden when enhanced privacy is enabled."""
        self._create_suspect_commit_owner(self.commit1)
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        self.organization.refresh_from_db()
        assert self.organization.flags.enhanced_privacy.is_set is True

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": str(self.user.id),
                "assigneeEmail": self.user.email,
                "assigneeName": self.user.get_display_name(),
                "assigneeType": "user",
            },
        )

        notification = AssignedActivityNotification(activity)
        context = notification.get_context()

        # Verify that context includes commits but enhanced_privacy is set
        # The templates will use this context to conditionally hide suspect commits
        assert "commits" in context
        assert len(context["commits"]) == 1
        assert context["commits"][0]["subject"] == "feat: Add new feature"
        assert context["enhanced_privacy"]
