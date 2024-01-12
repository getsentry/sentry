from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from unittest.mock import Mock, patch

import pytest
import responses
from celery.exceptions import MaxRetriesExceededError, Retry
from django.utils import timezone

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.mixins.commit_context import CommitInfo, FileBlameInfo, SourceLineInfo
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.pullrequest import PullRequest, PullRequestComment, PullRequestCommit
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.tasks.commit_context import PR_COMMENT_WINDOW, process_commit_context
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.committers import get_frame_paths

pytestmark = [requires_snuba]


class TestCommitContextMixin(TestCase):
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
            stack_root="sentry/",
            source_root="sentry/",
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
                        None,
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


@region_silo_test
class TestCommitContext(TestCommitContextMixin):
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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

    @patch("sentry.integrations.utils.commit_context.logger.exception")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiError(text="integration_failed"),
    )
    def test_failed_to_fetch_commit_context_apierror(
        self, mock_get_commit_context, mock_record, mock_logger_exception
    ):
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

        assert mock_logger_exception.call_count == 1
        mock_record.assert_called_with(
            "integrations.failed_to_fetch_commit_context",
            organization_id=self.organization.id,
            project_id=self.project.id,
            code_mapping_id=self.code_mapping.id,
            group_id=self.event.group_id,
            provider="github",
            error_message="integration_failed",
        )

    @patch("sentry.integrations.utils.commit_context.logger.exception")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiRateLimitedError("exceeded rate limit"),
    )
    def test_failed_to_fetch_commit_context_rate_limit(
        self, mock_get_commit_context, mock_record, mock_logger_exception
    ):
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

        assert not mock_logger_exception.called
        mock_record.assert_called_with(
            "integrations.failed_to_fetch_commit_context",
            organization_id=self.organization.id,
            project_id=self.project.id,
            code_mapping_id=self.code_mapping.id,
            group_id=self.event.group_id,
            provider="github",
            error_message="exceeded rate limit",
        )

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

    @patch("sentry.tasks.commit_context.logger")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfasdf",
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=370)),
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_found_commit_is_too_old(self, mock_get_commit_context, mock_logger):
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

        assert mock_logger.info.call_count == 1
        mock_logger.info.assert_called_with(
            "process_commit_context.find_commit_context",
            extra={
                "event": self.event.event_id,
                "group": self.event.group_id,
                "organization": self.event.group.project.organization_id,
                "reason": "could_not_fetch_commit_context",
                "code_mappings_count": 1,
                "fallback": True,
            },
        )

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfasdf",
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
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


@region_silo_test
class TestCommitContextAllFrames(TestCommitContextMixin):
    def setUp(self):
        super().setUp()
        self.blame_recent = FileBlameInfo(
            repo=self.repo,
            path="sentry/recent.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=30,
            commit=CommitInfo(
                commitId="commit-id-recent",
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(days=1),
                commitMessage="recent commit message",
                commitAuthorName=None,
                commitAuthorEmail="recent@localhost",
            ),
        )
        self.blame_too_old = FileBlameInfo(
            repo=self.repo,
            path="sentry/recent.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=30,
            commit=CommitInfo(
                commitId="commit-id-old",
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(days=370),
                commitMessage="old commit message",
                commitAuthorName=None,
                commitAuthorEmail="old@localhost",
            ),
        )
        self.blame_existing_commit = FileBlameInfo(
            repo=self.repo,
            path="sentry/models/release.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=39,
            commit=CommitInfo(
                commitId="existing-commit",
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(days=7),
                commitMessage="placeholder commit message",
                commitAuthorName=None,
                commitAuthorEmail="admin@localhost",
            ),
        )
        self.blame_no_existing_commit = FileBlameInfo(
            repo=self.repo,
            path="sentry/not_existing.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=40,
            commit=CommitInfo(
                commitId="commit-id",
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(days=14),
                commitMessage="no existing commit message",
                commitAuthorName=None,
                commitAuthorEmail="admin2@localhost",
            ),
        )

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_success_existing_commit(self, mock_get_commit_context, mock_record):
        """
        Tests a simple successful case, where get_commit_context_all_frames returns
        a single blame item. A GroupOwner should be created, but Commit and CommitAuthor
        already exist so should not.
        """
        mock_get_commit_context.return_value = [self.blame_existing_commit]
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            existing_commit = self.create_commit(
                project=self.project,
                repo=self.repo,
                author=self.commit_author,
                key="existing-commit",
            )
            existing_commit.update(message="")
            assert Commit.objects.count() == 2
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )

        created_group_owner = GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        # Number of commit objects should remain the same
        assert Commit.objects.count() == 2
        commit = Commit.objects.get(key="existing-commit")

        # Message should be updated
        assert commit.message == "placeholder commit message"

        assert created_group_owner
        assert created_group_owner.context == {"commitId": existing_commit.id}

        mock_record.assert_any_call(
            "integrations.successfully_fetched_commit_context_all_frames",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            event_id=self.event.event_id,
            num_frames=1,
            num_unique_commits=1,
            num_unique_commit_authors=1,
            num_successfully_mapped_frames=1,
            selected_frame_index=0,
            selected_provider="github",
            selected_code_mapping_id=self.code_mapping.id,
        )

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_success_create_commit(self, mock_get_commit_context, mock_record):
        """
        A simple success case where a new commit needs to be created.
        """
        mock_get_commit_context.return_value = [self.blame_no_existing_commit]
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

        created_commit_author = CommitAuthor.objects.get(
            organization_id=self.organization.id, email="admin2@localhost"
        )
        created_commit = Commit.objects.get(key="commit-id")
        assert created_commit.author.id == created_commit_author.id

        assert created_commit.organization_id == self.organization.id
        assert created_commit.repository_id == self.repo.id
        assert created_commit.date_added == self.blame_no_existing_commit.commit.committedDate
        assert created_commit.message == "no existing commit message"

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
        ).context == {"commitId": created_commit.id}

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_success_multiple_blames(self, mock_get_commit_context, mock_record):
        """
        A simple success case where multiple blames are returned.
        The most recent blame should be selected.
        """
        mock_get_commit_context.return_value = [
            self.blame_existing_commit,
            self.blame_recent,
            self.blame_no_existing_commit,
        ]
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

        created_group_owner = GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        created_commit = Commit.objects.get(key="commit-id-recent")

        assert created_group_owner.context == {"commitId": created_commit.id}

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_maps_correct_files(self, mock_get_commit_context, mock_record):
        """
        Tests that the get_commit_context_all_frames function is called with the correct
        files. Code mappings should be applied properly and non-matching files thrown out.
        Code mappings should also be checked in the correct order, with empty stack roots
        checked last.
        """
        mock_get_commit_context.return_value = [self.blame_existing_commit]

        # Code mapping with empty stack root should not be used event though it was created earlier
        self.create_code_mapping(
            repo=self.repo,
            project=self.project,
            stack_root="",
            source_root="foo/",
        )

        # This code mapping has a defined stack root and matches the filename so should be used
        code_mapping_defined_stack_root = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
            stack_root="other/",
            source_root="bar/",
        )
        frames = [
            {
                "in_app": True,
                "lineno": 39,
                "filename": "other/models/release.py",
            }
        ]

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )

        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        mock_get_commit_context.assert_called_once_with(
            [
                SourceLineInfo(
                    lineno=39,
                    path="bar/models/release.py",
                    ref="master",
                    repo=code_mapping_defined_stack_root.repository,
                    code_mapping=code_mapping_defined_stack_root,
                )
            ],
            extra={
                "event": self.event.event_id,
                "group": self.event.group_id,
                "organization": self.event.project.organization_id,
            },
        )

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_failure_no_inapp_frames(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits
    ):
        """
        A simple failure case where the event has no in app frames, so we bail out
        and fall back to the release-based suspect commits.
        """
        self.event_with_no_inapp_frames = self.store_event(
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

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event_with_no_inapp_frames)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not mock_get_commit_context.called
        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once_with(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
            sdk_name="sentry.python",
        )

        mock_record.assert_any_call(
            "integrations.failed_to_fetch_commit_context_all_frames",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            event_id=self.event.event_id,
            num_frames=0,
            num_successfully_mapped_frames=0,
            reason="could_not_find_in_app_stacktrace_frame",
        )

    @patch("sentry.integrations.utils.commit_context.logger.info")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_failure_no_blames(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits, mock_logger_info
    ):
        """
        A simple failure case where no blames are returned. We bail out and fall back
        to the release-based suspect commits.
        """
        mock_get_commit_context.return_value = []
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once_with(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
            sdk_name="sentry.python",
        )

        mock_record.assert_any_call(
            "integrations.failed_to_fetch_commit_context_all_frames",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            event_id=self.event.event_id,
            num_frames=1,
            num_successfully_mapped_frames=1,
            reason="no_commit_found",
        )

        mock_logger_info.assert_any_call(
            "process_commit_context_all_frames.find_commit_context_failed",
            extra={
                "organization": self.organization.id,
                "group": self.event.group_id,
                "event": self.event.event_id,
                "project_id": self.project.id,
                "reason": "no_commit_found",
                "num_frames": 1,
            },
        )

    @patch("sentry.integrations.utils.commit_context.logger.info")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_failure_old_blame(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits, mock_logger_info
    ):
        """
        A simple failure case where no blames are returned. We bail out and fall back
        to the release-based suspect commits.
        """
        mock_get_commit_context.return_value = [self.blame_too_old]
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once_with(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
            sdk_name="sentry.python",
        )

        mock_record.assert_any_call(
            "integrations.failed_to_fetch_commit_context_all_frames",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            event_id=self.event.event_id,
            num_frames=1,
            num_successfully_mapped_frames=1,
            reason="commit_too_old",
        )

        mock_logger_info.assert_any_call(
            "process_commit_context_all_frames.find_commit_context_failed",
            extra={
                "organization": self.organization.id,
                "group": self.event.group_id,
                "event": self.event.event_id,
                "project_id": self.project.id,
                "reason": "commit_too_old",
                "num_frames": 1,
            },
        )

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
        side_effect=ApiError("Unknown API error"),
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_retry_on_bad_api_error(self, mock_get_commit_context, mock_process_suspect_commits):
        """
        A failure case where the integration hits an unknown API error.
        The task should be retried.
        """
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            with pytest.raises(Retry):
                process_commit_context(
                    event_id=self.event.event_id,
                    event_platform=self.event.platform,
                    event_frames=event_frames,
                    group_id=self.event.group_id,
                    project_id=self.event.project_id,
                    sdk_name="sentry.python",
                )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        assert not mock_process_suspect_commits.called

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
        side_effect=ApiError("File not found", code=404),
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_no_retry_on_expected_api_error(
        self, mock_get_commit_context, mock_process_suspect_commits
    ):
        """
        A failure case where the integration hits an a 404 error.
        This type of failure should immediately fall back to the release-based suspesct commits.
        """
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once()

    @patch("celery.app.task.Task.request")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
        side_effect=ApiError("Unknown API error"),
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_falls_back_on_max_retries(
        self, mock_get_commit_context, mock_process_suspect_commits, mock_request
    ):
        """
        A failure case where the integration hits an unknown API error a fifth time.
        After 5 retries, the task should fall back to the release-based suspect commits.
        """
        mock_request.called_directly = False
        mock_request.retries = 5

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)

            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once()

    @patch("sentry.integrations.utils.commit_context.logger.exception")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
        side_effect=Exception("some other error"),
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_failure_unknown(
        self,
        mock_get_commit_context,
        mock_process_suspect_commits,
        mock_logger_exception,
    ):
        """
        A failure case where the integration returned an API error.
        The error should be recorded and we should fall back to the release-based suspect commits.
        """
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        assert not GroupOwner.objects.filter(group=self.event.group).exists()
        mock_process_suspect_commits.assert_called_once_with(
            event_id=self.event.event_id,
            event_platform=self.event.platform,
            event_frames=event_frames,
            group_id=self.event.group_id,
            project_id=self.event.project_id,
            sdk_name="sentry.python",
        )

        mock_logger_exception.assert_any_call(
            "process_commit_context_all_frames.get_commit_context_all_frames.unknown_error",
            extra={
                "organization": self.organization.id,
                "group": self.event.group_id,
                "event": self.event.event_id,
                "project_id": self.project.id,
                "integration_id": self.integration.id,
                "provider": "github",
            },
        )

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context_all_frames",
    )
    @with_feature("organizations:suspect-commits-all-frames")
    def test_filters_invalid_and_dedupes_frames(self, mock_get_commit_context, mock_record):
        """
        Tests that invalid frames are filtered out and that duplicate frames are deduped.
        """
        mock_get_commit_context.return_value = [self.blame_existing_commit]
        frames_with_dups = [
            {
                "function": "handle_set_commits",
                "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                "module": "sentry.tasks",
                "in_app": False,  # Not an In-App frame
                "lineno": 30,
                "filename": "sentry/tasks.py",
            },
            {
                "function": "something_else",
                "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                "module": "sentry.tasks",
                "in_app": True,
                "filename": "sentry/tasks.py",
                # No lineno
            },
            {
                "function": "set_commits",
                "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                "module": "sentry.models.release",
                "in_app": True,
                "lineno": 39,
                "filename": "sentry/models/release.py",
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

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=frames_with_dups,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
                sdk_name="sentry.python",
            )

        mock_get_commit_context.assert_called_with(
            [
                SourceLineInfo(
                    lineno=39,
                    path="sentry/models/release.py",
                    ref="master",
                    repo=self.repo,
                    code_mapping=self.code_mapping,
                ),
            ],
            extra={
                "event": self.event.event_id,
                "group": self.event.group_id,
                "organization": self.organization.id,
            },
        )
        mock_record.assert_any_call(
            "integrations.successfully_fetched_commit_context_all_frames",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.event.group_id,
            event_id=self.event.event_id,
            num_frames=1,  # Filters out the invalid frames and dedupes the 2 valid frames
            num_unique_commits=1,
            num_unique_commit_authors=1,
            num_successfully_mapped_frames=1,
            selected_frame_index=0,
            selected_provider="github",
            selected_code_mapping_id=self.code_mapping.id,
        )


@region_silo_test
@patch(
    "sentry.integrations.github.GitHubIntegration.get_commit_context",
    Mock(
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": (datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        }
    ),
)
@patch("sentry.tasks.integrations.github.pr_comment.github_comment_workflow.delay")
class TestGHCommentQueuing(IntegrationTestCase, TestCommitContextMixin):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
        self.pull_request = PullRequest.objects.create(
            organization_id=self.commit.organization_id,
            repository_id=self.repo.id,
            key="99",
            author=self.commit.author,
            message="foo",
            title="bar",
            merge_commit_sha=self.commit.key,
            date_added=iso_format(before_now(days=1)),
        )
        self.repo.provider = "integrations:github"
        self.repo.save()
        self.pull_request_comment = PullRequestComment.objects.create(
            pull_request=self.pull_request,
            external_id=1,
            created_at=iso_format(before_now(days=1)),
            updated_at=iso_format(before_now(days=1)),
            group_ids=[],
        )

    def add_responses(self):
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json=[{"merge_commit_sha": self.pull_request.merge_commit_sha}],
        )

    def test_gh_comment_not_github(self, mock_comment_workflow):
        """Non github repos shouldn't be commented on"""
        self.repo.provider = "integrations:gitlab"
        self.repo.save()
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    def test_gh_comment_org_option(self, mock_comment_workflow):
        """No comments on org with organization option disabled"""
        OrganizationOption.objects.set_value(
            organization=self.project.organization, key="sentry:github_pr_bot", value=False
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
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_api(self, get_jwt, mock_comment_workflow):
        """No comments on suspect commit with no pr returned from API response"""
        self.pull_request.delete()

        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json={"message": "No commit found for SHA"},
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
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @patch("sentry_sdk.capture_exception")
    @responses.activate
    def test_gh_comment_api_error(self, mock_capture_exception, get_jwt, mock_comment_workflow):
        """Captures exception if Github API call errors"""

        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=400,
            json={"message": "error"},
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
            assert mock_capture_exception.called
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_commit_not_in_default_branch(self, get_jwt, mock_comment_workflow):
        """No comments on commit not in default branch"""

        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json=[{"merge_commit_sha": "abcd"}, {"merge_commit_sha": "efgh"}],
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
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_query(self, get_jwt, mock_comment_workflow):
        """No comments on suspect commit with no pr row in table"""
        self.pull_request.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_pr_too_old(self, get_jwt, mock_comment_workflow):
        """No comment on pr that's older than PR_COMMENT_WINDOW"""
        self.pull_request.date_added = iso_format(before_now(days=PR_COMMENT_WINDOW + 1))
        self.pull_request.save()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_repeat_issue(self, get_jwt, mock_comment_workflow):
        """No comment on a pr that has a comment with the issue in the same pr list"""
        self.pull_request_comment.group_ids.append(self.event.group_id)
        self.pull_request_comment.save()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued(self, get_jwt, mock_comment_workflow):
        """Task queued if no prior comment exists"""
        self.pull_request_comment.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0].commit == self.commit

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued_existing_pr_commit(self, get_jwt, mock_comment_workflow):
        """Task queued if no prior comment exists"""
        pr_commit = PullRequestCommit.objects.create(
            commit=self.commit, pull_request=self.pull_request
        )
        self.pull_request_comment.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0] == pr_commit

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_update_queue(self, get_jwt, mock_comment_workflow):
        """Task queued if new issue for prior comment"""

        self.add_responses()

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
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0].commit == self.commit

    def test_gh_comment_no_repo(self, mock_comment_workflow):
        """No comments on suspect commit if no repo row exists"""
        self.repo.delete()
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_debounces(self, get_jwt, mock_comment_workflow):
        self.add_responses()

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
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.call_count == 1
