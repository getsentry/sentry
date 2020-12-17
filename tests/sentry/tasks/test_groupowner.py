from __future__ import absolute_import

from django.utils import timezone

from sentry.tasks.groupowner import process_suspect_commits, PREFERRED_GROUP_OWNER_AGE
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import Repository
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.compat.mock import patch


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
        process_suspect_commits(self.event)
        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

    def test_no_matching_user(self):
        self.set_release_commits("not@real.user")

        result = get_serialized_event_file_committers(self.project, self.event)

        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        process_suspect_commits(self.event)
        assert not GroupOwner.objects.filter(group=self.event.group).exists()

    @patch("sentry.tasks.groupowner.OWNER_CACHE_LIFE", 0)
    def test_delete_old_entries(self):
        # As new events come in associated with new owners, we should delete old ones.
        self.set_release_commits(self.user.email)
        process_suspect_commits(self.event)
        process_suspect_commits(self.event)
        process_suspect_commits(self.event)

        assert GroupOwner.objects.filter(group=self.event.group).count() == 1
        assert GroupOwner.objects.filter(group=self.event.group, user=self.user).exists()
        self.event_2 = self.store_event(
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
        self.event_3 = self.store_event(
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

        assert self.event_2.group == self.event.group
        assert self.event_3.group == self.event.group

        self.set_release_commits(self.user_2.email)
        process_suspect_commits(self.event_2)
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user=self.user).exists()
        assert GroupOwner.objects.filter(group=self.event_2.group, user=self.user_2).exists()

        self.set_release_commits(self.user_3.email)
        process_suspect_commits(self.event_3)
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user=self.user).exists()
        assert GroupOwner.objects.filter(group=self.event_2.group, user=self.user_2).exists()
        assert not GroupOwner.objects.filter(group=self.event_2.group, user=self.user_3).exists()

        go = GroupOwner.objects.filter(group=self.event_2.group, user=self.user_2).first()
        go.date_added = timezone.now() - PREFERRED_GROUP_OWNER_AGE * 2
        go.save()

        self.set_release_commits(self.user_3.email)
        process_suspect_commits(self.event_3)
        # Won't be processed because the cache is present and this group has owners
        assert GroupOwner.objects.filter(group=self.event.group).count() == 2
        assert GroupOwner.objects.filter(group=self.event.group, user=self.user).exists()
        assert not GroupOwner.objects.filter(group=self.event_2.group, user=self.user_2).exists()
        assert GroupOwner.objects.filter(group=self.event_2.group, user=self.user_3).exists()

    @patch("sentry.tasks.groupowner.OWNER_CACHE_LIFE", 0)
    def test_update_existing_entries(self):
        # As new events come in associated with existing owners, we should update the date_added of that owner.
        self.set_release_commits(self.user.email)
        process_suspect_commits(self.event)
        go = GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        date_added_before_update = go.date_added
        process_suspect_commits(self.event)
        go.refresh_from_db()
        assert go.date_added > date_added_before_update
        assert GroupOwner.objects.filter(group=self.event.group).count() == 1
        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

    @patch("sentry.tasks.groupowner.OWNER_CACHE_LIFE", 0)
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
        process_suspect_commits(self.event)
        # Doesn't use self.user2 due to low score.
        assert GroupOwner.objects.get(user=self.user.id)
        assert GroupOwner.objects.get(user=self.user3.id)
        assert not GroupOwner.objects.filter(user=self.user2.id).exists()
