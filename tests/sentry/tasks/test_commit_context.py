from unittest.mock import patch

from sentry.models import Repository
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.commit_context import process_commit_context
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.committers import get_frame_paths


@region_silo_test
class TestCommitContext(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )
        self.commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )
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
                            "in_app": False,
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

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_simple(self, mock_get_commit_context):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
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

        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).context == {"commitId": self.commit.id}

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfasdf",
            "committedDate": "",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_no_matching_commit_in_db(self, mock_get_commit_context):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert not GroupOwner.objects.filter(group=self.event.group).exists()

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_delete_old_entries(self, mock_get_commit_context):
        # As new events come in associated with new owners, we should delete old ones.
        user_2 = self.create_user("another@user.com", is_superuser=True)
        self.create_member(teams=[self.team], user=user_2, organization=self.organization)
        GroupOwner.objects.create(
            group=self.event.group,
            user=user_2,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )

            assert GroupOwner.objects.filter(group=self.event.group).count() == 1
            assert GroupOwner.objects.filter(group=self.event.group, user=self.user).exists()

    def test_no_inapp_frame_in_stacktrace(self):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            self.event_2 = self.store_event(
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
                                "in_app": False,
                                "lineno": 30,
                                "filename": "sentry/tasks.py",
                            },
                            {
                                "function": "set_commits",
                                "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                                "module": "sentry.models.release",
                                "in_app": False,
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
            event_frames = get_frame_paths(self.event_2)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert not GroupOwner.objects.filter(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).exists()
