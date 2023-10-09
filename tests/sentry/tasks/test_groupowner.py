from unittest.mock import patch

from django.utils import timezone

from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.grouprelease import GroupRelease
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.tasks.groupowner import PREFERRED_GROUP_OWNER_AGE, process_suspect_commits
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.committers import get_frame_paths, get_serialized_event_file_committers

pytestmark = [requires_snuba]


@region_silo_test
class TestGroupOwners(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        self.release = self.create_release(project=self.project, version="v1337")
        self.group = self.create_group(
            project=self.project, message="Kaboom!", first_release=self.release
        )
        GroupRelease.objects.create(
            group_id=self.group.id, release_id=self.release.id, project_id=self.project.id
        )

        self.event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=10)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )
        assert self.event.group is not None
        GroupRelease.objects.create(
            group_id=self.event.group.id, project_id=self.project.id, release_id=self.release.id
        )

    def set_release_commits(self, author_email):
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": author_email,
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )

    def test_simple(self):
        self.set_release_commits(self.user.email)
        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

    def test_user_deletion_cascade(self):
        other_user = self.create_user()
        group = self.create_group()
        other_group = self.create_group()
        GroupOwner.objects.create(
            group=group,
            project=group.project,
            organization=group.project.organization,
            type=0,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=other_group,
            project=other_group.project,
            organization=other_group.project.organization,
            type=0,
            user_id=other_user.id,
        )

        assert GroupOwner.objects.count() == 2
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.user.delete()
        assert GroupOwner.objects.count() == 2

        with TaskRunner():
            schedule_hybrid_cloud_foreign_key_jobs()

        assert GroupOwner.objects.count() == 1

    def test_no_matching_user(self):
        self.set_release_commits("not@real.user")

        result = get_serialized_event_file_committers(self.project, self.event)

        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        assert not GroupOwner.objects.filter(group=self.event.group).exists()

    def test_delete_old_entries(self):
        # As new events come in associated with new owners, we should delete old ones.
        self.set_release_commits(self.user.email)
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )

        assert GroupOwner.objects.filter(group=self.event.group).count() == 1
        assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()
        event_2 = self.store_event(
            data={
                "message": "BANG!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "process_suspect_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks/groupowner.py",
                            "module": "sentry.tasks.groupowner",
                            "in_app": True,
                            "lineno": 48,
                            "filename": "sentry/tasks/groupowner.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )
        event_3 = self.store_event(
            data={
                "message": "BOP!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "process_suspect_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks/groupowner.py",
                            "module": "sentry.tasks.groupowner",
                            "in_app": True,
                            "lineno": 48,
                            "filename": "sentry/tasks/groupowner.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )

        self.user_2 = self.create_user("another@user.com", is_superuser=True)
        self.create_member(teams=[self.team], user=self.user_2, organization=self.organization)
        self.user_3 = self.create_user("user_3@sentry.io", is_superuser=True)
        self.create_member(teams=[self.team], user=self.user_3, organization=self.organization)
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": self.user_2.email,
                    "author_name": "joe",
                    "message": "i fixed another bug",
                    "patch_set": [{"path": "src/sentry/tasks/groupowner.py", "type": "M"}],
                }
            ]
        )

        assert event_2.group == self.event.group
        assert event_3.group == self.event.group

        self.set_release_commits(self.user_2.email)
        event_2_frames = get_frame_paths(event_2)
        process_suspect_commits(
            event_id=event_2.event_id,
            event_platform=event_2.platform,
            event_frames=event_2_frames,
            group_id=event_2.group_id,
            project_id=event_2.project_id,
        )
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()
        assert GroupOwner.objects.filter(group=event_2.group, user_id=self.user_2.id).exists()

        self.set_release_commits(self.user_3.email)
        event_3_frames = get_frame_paths(event_3)
        process_suspect_commits(
            event_id=event_3.event_id,
            event_platform=event_3.platform,
            event_frames=event_3_frames,
            group_id=event_3.group_id,
            project_id=event_3.project_id,
        )
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()
        assert GroupOwner.objects.filter(group=event_2.group, user_id=self.user_2.id).exists()
        assert not GroupOwner.objects.filter(group=event_2.group, user_id=self.user_3.id).exists()

        go = GroupOwner.objects.filter(group=event_2.group, user_id=self.user_2.id).first()
        go.date_added = timezone.now() - PREFERRED_GROUP_OWNER_AGE * 2
        go.save()

        self.set_release_commits(self.user_3.email)
        process_suspect_commits(
            event_id=event_3.event_id,
            event_platform=event_3.platform,
            event_frames=event_3_frames,
            group_id=event_3.group_id,
            project_id=event_3.project_id,
        )
        # Won't be processed because the cache is present and this group has owners
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()
        assert not GroupOwner.objects.filter(group=event_2.group, user_id=self.user_2.id).exists()
        assert GroupOwner.objects.filter(group=event_2.group, user_id=self.user_3.id).exists()

    def test_update_existing_entries(self):
        # As new events come in associated with existing owners, we should update the date_added of that owner.
        self.set_release_commits(self.user.email)
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        go = GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        date_added_before_update = go.date_added
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        go.refresh_from_db()
        assert go.date_added > date_added_before_update
        assert GroupOwner.objects.filter(group=self.event.group).count() == 1
        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

    def test_no_release_or_commit(self):
        event_with_no_release = self.store_event(
            data={
                "message": "BOOM!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "process_suspect_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks/groupowner.py",
                            "module": "sentry.tasks.groupowner",
                            "in_app": True,
                            "lineno": 48,
                            "filename": "sentry/tasks/groupowner.py",
                        },
                    ]
                },
                "fingerprint": ["i-have-no-release"],
            },
            project_id=self.project.id,
        )
        process_suspect_commits(
            event_with_no_release.event_id,
            event_with_no_release.platform,
            event_with_no_release.data,
            event_with_no_release.group_id,
            event_with_no_release.project_id,
        )
        assert GroupOwner.objects.filter(group=event_with_no_release.group).count() == 0

    @patch("sentry.tasks.groupowner.get_event_file_committers")
    def test_keep_highest_score(self, patched_committers):
        self.user2 = self.create_user(email="user2@sentry.io")
        self.user3 = self.create_user(email="user3@sentry.io")
        patched_committers.return_value = [
            {
                "commits": [(None, 3)],
                "author": {
                    "username": self.user.email,
                    "lastLogin": None,
                    "isSuperuser": True,
                    "isManaged": False,
                    "experiments": {},
                    "lastActive": timezone.now(),
                    "isStaff": True,
                    "id": self.user.id,
                    "isActive": True,
                    "has2fa": False,
                    "name": self.user.email,
                    "avatarUrl": "https://secure.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56?s=32&d=mm",
                    "dateJoined": timezone.now(),
                    "emails": [
                        {"is _verified": True, "id": self.user.id, "email": self.user.email}
                    ],
                    "avatar": {"avatarUuid": None, "avatarType": "letter_avatar"},
                    "hasPasswordAuth": True,
                    "email": self.user.email,
                },
            },
            {
                "commits": [(None, 1)],
                "author": {
                    "username": self.user2.email,
                    "lastLogin": None,
                    "isSuperuser": True,
                    "isManaged": False,
                    "experiments": {},
                    "lastActive": timezone.now(),
                    "isStaff": True,
                    "id": self.user2.id,
                    "isActive": True,
                    "has2fa": False,
                    "name": self.user2.email,
                    "avatarUrl": "https://secure.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56?s=32&d=mm",
                    "dateJoined": timezone.now(),
                    "emails": [
                        {"is_verified": True, "id": self.user2.id, "email": self.user2.email}
                    ],
                    "avatar": {"avatarUuid": None, "avatarType": "letter_avatar"},
                    "hasPasswordAuth": True,
                    "email": self.user2.email,
                },
            },
            {
                "commits": [(None, 2)],
                "author": {
                    "username": self.user3.email,
                    "lastLogin": None,
                    "isSuperuser": True,
                    "isManaged": False,
                    "experiments": {},
                    "lastActive": timezone.now(),
                    "isStaff": True,
                    "id": self.user3.id,
                    "isActive": True,
                    "has2fa": False,
                    "name": self.user3.email,
                    "avatarUrl": "https://secure.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56?s=32&d=mm",
                    "dateJoined": timezone.now(),
                    "emails": [
                        {"is_verified": True, "id": self.user3.id, "email": self.user3.email}
                    ],
                    "avatar": {"avatarUuid": None, "avatarType": "letter_avatar"},
                    "hasPasswordAuth": True,
                    "email": self.user3.email,
                },
            },
        ]
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )
        # Doesn't use self.user2 due to low score.
        assert GroupOwner.objects.get(user_id=self.user.id)
        assert GroupOwner.objects.get(user_id=self.user3.id)
        assert not GroupOwner.objects.filter(user_id=self.user2.id).exists()

    @patch("sentry.tasks.groupowner.get_event_file_committers")
    def test_low_suspect_committer_score(self, patched_committers):
        self.user = self.create_user()
        patched_committers.return_value = [
            {
                # score < MIN_COMMIT_SCORE
                "commits": [(None, 1)],
                "author": {
                    "id": self.user.id,
                },
            },
        ]
        event_frames = get_frame_paths(self.event)
        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )

        assert not GroupOwner.objects.filter(user_id=self.user.id).exists()

    def test_owners_count(self):
        self.set_release_commits(self.user.email)
        self.user = self.create_user()
        event_frames = get_frame_paths(self.event)

        process_suspect_commits(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
        )

        owners = GroupOwner.objects.filter(
            group_id=self.event.group_id,
            project=self.event.project,
            organization_id=self.event.project.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        assert owners.count() == 1
