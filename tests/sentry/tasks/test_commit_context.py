from datetime import timedelta
from unittest.mock import patch

import pytest
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone

from sentry.models import Repository
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.tasks.commit_context import process_commit_context
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.committers import get_frame_paths


@region_silo_test(stable=True)
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
            "committedDate": "2023-02-14T11:11Z",
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

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiError(text="integration_failed"),
    )
    def test_failed_to_fetch_commit_context_record(self, mock_get_commit_context, mock_record):
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

        mock_record.assert_called_with(
            "integrations.failed_to_fetch_commit_context",
            organization_id=self.organization.id,
            project_id=self.project.id,
            code_mapping_id=self.code_mapping.id,
            group_id=self.event.group_id,
            provider="github",
            error_message="integration_failed",
        )

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfasdf",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_no_matching_commit_in_db(self, mock_get_commit_context):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            assert not Commit.objects.filter(key="asdfasdf").exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert Commit.objects.filter(key="asdfasdf").exists()
        assert GroupOwner.objects.filter(group=self.event.group).exists()

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_delete_old_entries(self, mock_get_commit_context):
        # As new events come in associated with new owners, we should delete old ones.
        user_2 = self.create_user("another@user.com", is_superuser=True)
        self.create_member(teams=[self.team], user=user_2, organization=self.organization)
        owner = GroupOwner.objects.create(
            group=self.event.group,
            user_id=user_2.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            date_added=timezone.now() - timedelta(days=8),
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
            assert not GroupOwner.objects.filter(id=owner.id).exists()
            assert GroupOwner.objects.filter(group=self.event.group).count() == 1
            assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    def test_no_inapp_frame_in_stacktrace(self, mock_process_suspect_commits):
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
        assert mock_process_suspect_commits.call_count == 1
        assert not GroupOwner.objects.filter(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).exists()

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_commit_author_not_in_sentry(self, mock_get_commit_context):
        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

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
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch("sentry.tasks.commit_context.get_users_for_authors", return_value={})
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_commit_author_no_user(self, mock_get_commit_context, mock_get_users_for_author):
        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

        with self.tasks(), patch(
            "sentry.tasks.commit_context.get_users_for_authors", return_value={}
        ):
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_multiple_matching_code_mappings_but_only_1_repository_has_the_commit_in_db(
        self, mock_get_commit_context
    ):

        self.integration_2 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:2",
        )

        self.repo_2 = Repository.objects.create(
            organization_id=self.organization.id,
            name="another/example",
            integration_id=self.integration_2.id,
        )
        self.code_mapping_2 = self.create_code_mapping(
            repo=self.repo_2, project=self.project, stack_root="src", source_root="src"
        )

        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo_2,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

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
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiError(text="integration_failed"),
    )
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    def test_fallback_if_max_retries_exceeded(self, mock_suspect_commits, mock_get_commit_context):
        def after_return(self, status, retval, task_id, args, kwargs, einfo):
            raise MaxRetriesExceededError()

        with self.tasks() and pytest.raises(MaxRetriesExceededError):
            with patch("celery.app.task.Task.after_return", after_return):
                process_commit_context.apply(
                    kwargs={
                        "event_id": self.event.event_id,
                        "event_platform": self.event.platform,
                        "event_frames": get_frame_paths(self.event),
                        "group_id": self.event.group_id,
                        "project_id": self.event.project_id,
                    },
                    retries=1,
                )

            assert mock_suspect_commits.called
