import logging
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from unittest.mock import MagicMock, patch

import responses
from django.utils import timezone

from sentry.analytics.events.integration_commit_context_all_frames import (
    IntegrationsFailedToFetchCommitContextAllFrames,
    IntegrationsSuccessfullyFetchedCommitContextAllFrames,
)
from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import (
    CommitContextIntegration,
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.metrics import CommitContextHaltReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.commit_context import PR_COMMENT_WINDOW, process_commit_context
from sentry.testutils.asserts import assert_halt_metric
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils.committers import get_frame_paths

pytestmark = [requires_snuba]


class TestCommitContextIntegration(TestCase):
    def setUp(self) -> None:
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
                "timestamp": before_now(seconds=10).isoformat(),
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


class TestCommitContextAllFrames(TestCommitContextIntegration):
    def setUp(self) -> None:
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
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(days=70),
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

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_inactive_integration(self, mock_get_commit_context: MagicMock) -> None:
        """
        Early return if the integration is not active
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(status=ObjectStatus.DISABLED)

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

        assert not mock_get_commit_context.called

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_success_existing_commit(
        self, mock_get_commit_context: MagicMock, mock_record: MagicMock
    ) -> None:
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
        assert created_group_owner.context == {
            "commitId": existing_commit.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

        assert_any_analytics_event(
            mock_record,
            IntegrationsSuccessfullyFetchedCommitContextAllFrames(
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
            ),
        )

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_success_updating_group_owner(self, mock_get_commit_context, mock_record):
        """
        Runs through process_commit_context twice to make sure we aren't creating duplicate
        GroupOwners for the same suggestion.
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
        assert created_group_owner.context == {
            "commitId": existing_commit.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

        with self.tasks():
            assert GroupOwner.objects.filter(group=self.event.group).count() == 1
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )

        assert GroupOwner.objects.filter(group=self.event.group).count() == 1

        updated_group_owner = GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        # Number of commit objects should remain the same
        assert Commit.objects.count() == 2
        commit = Commit.objects.get(key="existing-commit")

        # Message should be unchanged
        assert commit.message == "placeholder commit message"

        assert updated_group_owner
        assert updated_group_owner.context == {
            "commitId": existing_commit.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_success_create_commit(
        self, mock_get_commit_context: MagicMock, mock_record: MagicMock
    ) -> None:
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
        assert created_commit.author is not None
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
        ).context == {
            "commitId": created_commit.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_success_external_author_no_user(self, mock_get_commit_context: MagicMock, _) -> None:
        """
        Test that process_commit_context creates GroupOwner with user_id=None
        when commit author has no Sentry user mapping.
        """
        # Create blame info with external commit author (no Sentry user)
        blame_external = FileBlameInfo(
            repo=self.repo,
            path="sentry/external.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=50,
            commit=CommitInfo(
                commitId="external-commit-id",
                committedDate=datetime.now(tz=datetime_timezone.utc) - timedelta(hours=2),
                commitMessage="external commit by non-user",
                commitAuthorName="External Developer",
                commitAuthorEmail="external@example.com",
            ),
        )

        mock_get_commit_context.return_value = [blame_external]

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

            # Verify GroupOwner created with user_id=None
            created_group_owner = GroupOwner.objects.get(
                group=self.event.group,
                project=self.project,
                organization_id=self.organization.id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
            )
            assert created_group_owner.user_id is None

            # Verify the created commit and author
            created_commit = Commit.objects.get(key="external-commit-id")
            assert created_commit.message == "external commit by non-user"
            assert created_commit.author is not None
            assert created_commit.author.name == "External Developer"
            assert created_commit.author.email == "external@example.com"
            assert created_group_owner.context == {
                "commitId": created_commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
            }

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_success_multiple_blames(
        self, mock_get_commit_context: MagicMock, mock_record: MagicMock
    ) -> None:
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

        assert created_group_owner.context == {
            "commitId": created_commit.id,
            "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
        }

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_maps_correct_files(
        self, mock_get_commit_context: MagicMock, mock_record: MagicMock
    ) -> None:
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
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_failure_no_inapp_frames(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits
    ):
        """
        A simple failure case where the event has no in app frames, so we bail out.
        """
        self.event_with_no_inapp_frames = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=10).isoformat(),
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
        mock_process_suspect_commits.assert_not_called()

        assert_any_analytics_event(
            mock_record,
            IntegrationsFailedToFetchCommitContextAllFrames(
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.event.group_id,
                event_id=self.event.event_id,
                num_frames=0,
                num_successfully_mapped_frames=0,
                reason="could_not_find_in_app_stacktrace_frame",
            ),
        )

    @patch("sentry.integrations.utils.commit_context.logger.info")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_failure_no_blames(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits, mock_logger_info
    ):
        """
        A simple failure case where no blames are returned. We bail out.
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
        mock_process_suspect_commits.assert_not_called()

        assert_any_analytics_event(
            mock_record,
            IntegrationsFailedToFetchCommitContextAllFrames(
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.event.group_id,
                event_id=self.event.event_id,
                num_frames=1,
                num_successfully_mapped_frames=1,
                reason="no_commits_found",
            ),
        )

        mock_logger_info.assert_any_call(
            "process_commit_context_all_frames.find_commit_context_failed",
            extra={
                "organization": self.organization.id,
                "group": self.event.group_id,
                "event": self.event.event_id,
                "project_id": self.project.id,
                "reason": "no_commits_found",
                "num_frames": 1,
            },
        )

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_time_threshold_filtering(
        self, mock_get_commit_context, mock_record, mock_process_suspect_commits
    ):
        """
        A hacky way to run a parameterized test in TestCase.
        Tests the logic that filters commits by age relative to issue first_seen.
        """
        # Test cases: each tuple contains (test_case_name, blames_setup, group_first_seen_days_ago, expected_group_owner_exists, expected_commit_id)
        test_cases = [
            ("all_commits_too_young", ["blame_recent"], 3, False, None),  # All commits too young
            (
                "all_outside_range",
                ["blame_recent", "blame_too_old"],
                10,
                False,
                None,
            ),  # All outside range
            (
                "skip_young_find_valid",
                ["blame_recent", "blame_existing_commit"],
                5,
                True,
                "existing-commit",
            ),  # Skip young, find valid
            (
                "all_valid_picks_most_recent",
                ["blame_existing_commit", "blame_no_existing_commit"],
                5,
                True,
                "existing-commit",
            ),  # All valid, picks most recent
            ("only_old_commits", ["blame_too_old"], 10, False, None),  # All commits too old
            ("empty_blames", [], 10, False, None),  # No blames
        ]

        existing_commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author,
            key="existing-commit",
        )
        existing_commit.update(message="")

        # Map blame names to actual blame objects
        blame_mapping = {
            "blame_recent": self.blame_recent,
            "blame_too_old": self.blame_too_old,
            "blame_existing_commit": self.blame_existing_commit,
            "blame_no_existing_commit": self.blame_no_existing_commit,
        }

        for (
            case_name,
            blames_setup,
            group_first_seen_days_ago,
            expected_group_owner_exists,
            expected_commit_id,
        ) in test_cases:
            with self.subTest(case=case_name):
                # Reset mocks for each test case
                mock_get_commit_context.reset_mock()
                mock_record.reset_mock()

                # Clean up any existing GroupOwners from previous test cases
                GroupOwner.objects.filter(group=self.event.group).delete()

                # Setup group first_seen
                group_first_seen = datetime.now(tz=datetime_timezone.utc) - timedelta(
                    days=group_first_seen_days_ago
                )
                self.event.group.first_seen = group_first_seen
                self.event.group.save()

                # Build the mock return value
                mock_blames = [blame_mapping[blame_name] for blame_name in blames_setup]
                mock_get_commit_context.return_value = mock_blames

                with self.tasks():
                    assert not GroupOwner.objects.filter(group=self.event.group).exists()
                    event_frames = get_frame_paths(self.event)

                    with self.options({"issues.suspect-commit-strategy": True}):
                        process_commit_context(
                            event_id=self.event.event_id,
                            event_platform=self.event.platform,
                            event_frames=event_frames,
                            group_id=self.event.group_id,
                            project_id=self.event.project_id,
                            sdk_name="sentry.python",
                        )

                # Assert GroupOwner existence
                actual_exists = GroupOwner.objects.filter(group=self.event.group).exists()
                self.assertEqual(
                    actual_exists,
                    expected_group_owner_exists,
                    f"GroupOwner existence assertion failed for case: {case_name}",
                )

                # Assert correct commit selected
                if expected_group_owner_exists and expected_commit_id:
                    created_commit = Commit.objects.get(key=expected_commit_id)
                    group_owner = GroupOwner.objects.get(group=self.event.group)
                    self.assertEqual(
                        group_owner.context["commitId"],
                        created_commit.id,
                        f"Wrong commit selected for case: {case_name}",
                    )

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
        side_effect=ApiError("File not found", code=404),
    )
    def test_no_retry_on_non_retryable_api_error(
        self, mock_get_commit_context, mock_process_suspect_commits
    ):
        """
        A failure case where the integration hits a 404 error.
        This type of failure should immediately bail with no retries.
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
        mock_process_suspect_commits.assert_not_called()

    @patch("sentry.integrations.utils.commit_context.logger.exception")
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
        side_effect=Exception("some other error"),
    )
    def test_failure_unknown(
        self,
        mock_get_commit_context,
        mock_process_suspect_commits,
        mock_logger_exception,
    ):
        """
        A failure case where the integration returned an API error.
        The error should be recorded.
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
        mock_process_suspect_commits.assert_not_called()

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
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_filters_invalid_and_dedupes_frames(
        self, mock_get_commit_context: MagicMock, mock_record: MagicMock
    ) -> None:
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
                "function": "something_else",
                "abs_path": "/usr/src/sentry/src/sentry/invalid_2.py",
                "module": "sentry.invalid_2",
                "in_app": True,
                # Bad path with quotes
                "filename": 'sentry/"invalid_2".py',
                "lineno": 39,
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
        assert_any_analytics_event(
            mock_record,
            IntegrationsSuccessfullyFetchedCommitContextAllFrames(
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.event.group_id,
                event_id=self.event.event_id,
                # 1 was a duplicate, 2 filtered out because of missing properties
                num_frames=2,
                num_unique_commits=1,
                num_unique_commit_authors=1,
                # Only 1 successfully mapped frame of the 6 total
                num_successfully_mapped_frames=1,
                selected_frame_index=0,
                selected_provider="github",
                selected_code_mapping_id=self.code_mapping.id,
            ),
        )


@patch(
    "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    return_value=[],
)
@patch("sentry.integrations.source_code_management.tasks.pr_comment_workflow.delay")
class TestGHCommentQueuing(IntegrationTestCase, TestCommitContextIntegration):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self) -> None:
        super().setUp()
        self.pull_request = PullRequest.objects.create(
            organization_id=self.commit.organization_id,
            repository_id=self.repo.id,
            key="99",
            author=self.commit.author,
            message="foo",
            title="bar",
            merge_commit_sha=self.commit.key,
            date_added=before_now(days=1),
        )
        self.repo.provider = "integrations:github"
        self.repo.save()
        self.pull_request_comment = PullRequestComment.objects.create(
            pull_request=self.pull_request,
            external_id=1,
            created_at=before_now(days=1),
            updated_at=before_now(days=1),
            group_ids=[],
        )
        self.blame = FileBlameInfo(
            repo=self.repo,
            path="sentry/models/release.py",
            ref="master",
            code_mapping=self.code_mapping,
            lineno=39,
            commit=CommitInfo(
                commitId="asdfwreqr",
                committedDate=(datetime.now(tz=datetime_timezone.utc) - timedelta(days=7)),
                commitMessage="placeholder commit message",
                commitAuthorName="",
                commitAuthorEmail="admin@localhost",
            ),
        )
        OrganizationOption.objects.set_value(
            organization=self.project.organization, key="sentry:github_pr_bot", value=True
        )

    def add_responses(self):
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json=[{"merge_commit_sha": self.pull_request.merge_commit_sha, "state": "closed"}],
        )

    def test_gh_comment_not_github(
        self, mock_comment_workflow: MagicMock, mock_get_commit_context: MagicMock
    ) -> None:
        """Non github repos shouldn't be commented on"""
        mock_get_commit_context.return_value = [self.blame]
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

    def test_gh_comment_org_option(
        self, mock_comment_workflow: MagicMock, mock_get_commit_context: MagicMock
    ) -> None:
        """No comments on org with organization option disabled"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_api(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """No comments on suspect commit with no pr returned from API response"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @patch("sentry_sdk.capture_exception")
    @responses.activate
    def test_gh_comment_api_error(
        self, mock_capture_exception, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """Captures exception if Github API call errors"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_commit_not_in_default_branch(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """No comments on commit not in default branch"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_query(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """No comments on suspect commit with no pr row in table"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_pr_too_old(
        self,
        get_jwt: MagicMock,
        mock_comment_workflow: MagicMock,
        mock_get_commit_context: MagicMock,
    ) -> None:
        """No comment on pr that's older than PR_COMMENT_WINDOW"""
        mock_get_commit_context.return_value = [self.blame]
        self.pull_request.date_added = before_now(days=PR_COMMENT_WINDOW + 1)
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_pr_info_level_issue(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """No comment on pr that's has info level issue"""
        mock_get_commit_context.return_value = [self.blame]
        self.pull_request.date_added = before_now(days=1)
        self.pull_request.save()

        self.add_responses()
        self.event.group.update(level=logging.INFO)

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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_repeat_issue(
        self,
        get_jwt: MagicMock,
        mock_comment_workflow: MagicMock,
        mock_get_commit_context: MagicMock,
    ) -> None:
        """No comment on a pr that has a comment with the issue in the same pr list"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """Task queued if no prior comment exists"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued_existing_pr_commit(
        self, get_jwt, mock_comment_workflow, mock_get_commit_context
    ):
        """Task queued if no prior comment exists"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_update_queue(
        self,
        get_jwt: MagicMock,
        mock_comment_workflow: MagicMock,
        mock_get_commit_context: MagicMock,
    ) -> None:
        """Task queued if new issue for prior comment"""
        mock_get_commit_context.return_value = [self.blame]
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

    def test_gh_comment_no_repo(
        self, mock_comment_workflow: MagicMock, mock_get_commit_context: MagicMock
    ) -> None:
        """No comments on suspect commit if no repo row exists"""
        mock_get_commit_context.return_value = [self.blame]
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

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_debounces(
        self, get_jwt, mock_record, mock_comment_workflow, mock_get_commit_context
    ):
        mock_get_commit_context.return_value = [self.blame]
        self.add_responses()
        assert not GroupOwner.objects.filter(group=self.event.group).exists()

        groupowner = GroupOwner.objects.create(
            group_id=self.event.group_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=1,
            project_id=self.event.project_id,
            organization_id=self.project.organization_id,
            context={
                "commitId": self.commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
            },
            date_added=timezone.now(),
        )

        integration = integration_service.get_integration(
            organization_id=self.code_mapping.organization_id
        )
        assert integration

        install = integration.get_installation(organization_id=self.code_mapping.organization_id)
        assert isinstance(install, CommitContextIntegration)

        with self.tasks():
            install.queue_pr_comment_task_if_needed(
                project=self.project,
                commit=self.commit,
                group_owner=groupowner,
                group_id=self.event.group_id,
            )
            install.queue_pr_comment_task_if_needed(
                project=self.project,
                commit=self.commit,
                group_owner=groupowner,
                group_id=self.event.group_id,
            )
            assert mock_comment_workflow.call_count == 1

        start_1, success_1, start_2, halt_2 = mock_record.mock_calls
        assert start_1.args[0] == EventLifecycleOutcome.STARTED
        assert success_1.args[0] == EventLifecycleOutcome.SUCCESS
        assert start_2.args[0] == EventLifecycleOutcome.STARTED
        assert halt_2.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, CommitContextHaltReason.ALREADY_QUEUED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_gh_comment_multiple_comments(
        self, get_jwt, mock_record, mock_comment_workflow, mock_get_commit_context
    ):
        self.add_responses()

        assert not GroupOwner.objects.filter(group=self.event.group).exists()

        groupowner = GroupOwner.objects.create(
            group_id=self.event.group_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=1,
            project_id=self.event.project_id,
            organization_id=self.project.organization_id,
            context={
                "commitId": self.commit.id,
                "suspectCommitStrategy": "scm_based",
            },
            date_added=timezone.now(),
        )

        integration = integration_service.get_integration(
            organization_id=self.code_mapping.organization_id
        )
        assert integration

        install = integration.get_installation(organization_id=self.code_mapping.organization_id)
        assert isinstance(install, CommitContextIntegration)

        # open PR comment
        PullRequestComment.objects.create(
            external_id=1,
            pull_request=self.pull_request,
            created_at=before_now(days=1),
            updated_at=before_now(days=1),
            group_ids=[],
            comment_type=CommentType.OPEN_PR,
        )

        with self.tasks():
            install.queue_pr_comment_task_if_needed(
                project=self.project,
                commit=self.commit,
                group_owner=groupowner,
                group_id=self.event.group_id,
            )
            install.queue_pr_comment_task_if_needed(
                project=self.project,
                commit=self.commit,
                group_owner=groupowner,
                group_id=self.event.group_id,
            )
            assert mock_comment_workflow.call_count == 1

        start_1, success_1, start_2, halt_2 = mock_record.mock_calls
        assert start_1.args[0] == EventLifecycleOutcome.STARTED
        assert success_1.args[0] == EventLifecycleOutcome.SUCCESS
        assert start_2.args[0] == EventLifecycleOutcome.STARTED
        assert halt_2.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, CommitContextHaltReason.ALREADY_QUEUED)
