from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import NotFound

from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange, post_bulk_create
from sentry.models.group import Group
from sentry.models.groupowner import ISSUE_OWNERS_DEBOUNCE_KEY
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.projectownership import ProjectOwnership
from sentry.models.repository import Repository
from sentry.tasks.codeowners import (
    code_owners_auto_sync,
    invalidate_project_issue_owners_cache,
    update_code_owners_schema,
)
from sentry.taskworker.retry import RetryTaskError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.cache import cache

LATEST_GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class CodeOwnersTest(TestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )
        self.repo = Repository.objects.create(
            name="example", organization_id=self.organization.id, integration_id=self.integration.id
        )

        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
        }

        self.ownership = ProjectOwnership.objects.create(
            project=self.project, auto_assignment=True, codeowners_auto_sync=True
        )

        self.code_owners = self.create_codeowners(
            self.project, self.code_mapping, raw=self.data["raw"]
        )

    def test_simple(self) -> None:
        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # new external team mapping
            self.external_team = self.create_external_team(integration=self.integration)
            update_code_owners_schema(
                organization=self.organization.id, integration=self.integration.id
            )

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "team", "identifier": "tiger-team", "id": self.team.id},
                    ],
                }
            ],
        }

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # delete external team mapping
            ExternalActor.objects.get(id=self.external_team.id).delete()
            update_code_owners_schema(
                organization=self.organization.id, integration=self.integration.id
            )

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {"$version": 1, "rules": []}

    @freeze_time("2023-01-01 00:00:00")
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=LATEST_GITHUB_CODEOWNERS,
    )
    def test_codeowners_auto_sync_successful(self, mock_get_codeowner_file: MagicMock) -> None:
        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == self.data["raw"]

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            self.create_external_team()
            self.create_external_user(external_name="@NisanthanNanthakumar")
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="A",
            )
            code_owners_auto_sync(commit.id)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == LATEST_GITHUB_CODEOWNERS["raw"]
        assert code_owners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"identifier": "admin@localhost", "type": "user", "id": self.user.id},
                        {"identifier": "tiger-team", "type": "team", "id": self.team.id},
                    ],
                },
                {
                    "matcher": {"pattern": "*", "type": "codeowners"},
                    "owners": [
                        {"identifier": "admin@localhost", "type": "user", "id": self.user.id}
                    ],
                },
            ],
        }
        assert code_owners.date_updated.strftime("%Y-%m-%d %H:%M:%S") == "2023-01-01 00:00:00"

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=None,
    )
    @patch("sentry.notifications.notifications.codeowners_auto_sync.AutoSyncNotification.send")
    def test_codeowners_auto_sync_failed_to_fetch_file(
        self,
        mock_send_email: MagicMock,
        mock_get_codeowner_file: MagicMock,
    ) -> None:
        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == self.data["raw"]

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="A",
            )
            code_owners_auto_sync(commit.id)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == self.data["raw"]
        mock_send_email.assert_called_once_with()

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_commit_file_change_triggers_auto_sync_task(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="A",
            )

            mock_code_owners_auto_sync.delay.assert_called_once_with(commit_id=commit.id)

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_commit_file_change_triggers_auto_sync_task_modified(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename="CODEOWNERS",
                type="M",
            )

            mock_code_owners_auto_sync.delay.assert_called_once_with(commit_id=commit.id)

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_commit_file_change_does_not_trigger_auto_sync_for_deleted_file(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="D",
            )

            mock_code_owners_auto_sync.delay.assert_not_called()

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_commit_file_change_does_not_trigger_auto_sync_for_non_codeowners_file(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename="src/main.py",
                type="A",
            )

            mock_code_owners_auto_sync.delay.assert_not_called()

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_bulk_create_commit_file_changes_does_not_trigger_auto_sync_task(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            change1 = CommitFileChange(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="M",
            )
            change2 = CommitFileChange(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename="src/main.py",
                type="A",
            )
            CommitFileChange.objects.bulk_create([change1, change2])

            mock_code_owners_auto_sync.delay.assert_not_called()

    @patch("sentry.tasks.codeowners.code_owners_auto_sync")
    def test_post_bulk_create_commit_file_changes_triggers_auto_sync_task(
        self, mock_code_owners_auto_sync: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            change1 = CommitFileChange(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename=".github/CODEOWNERS",
                type="M",
            )
            change2 = CommitFileChange(
                organization_id=self.organization.id,
                commit_id=commit.id,
                filename="src/main.py",
                type="A",
            )
            file_changes = [change1, change2]
            CommitFileChange.objects.bulk_create(file_changes)
            post_bulk_create(file_changes)

            mock_code_owners_auto_sync.delay.assert_called_once_with(commit_id=commit.id)

    def test_codeowners_auto_sync_retries_on_missing_commit(self) -> None:
        non_existent_commit_id = 999999999

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            with pytest.raises(RetryTaskError):
                code_owners_auto_sync(non_existent_commit_id)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == self.data["raw"]

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        side_effect=NotImplementedError("Integration does not support CODEOWNERS"),
    )
    @patch("sentry.notifications.notifications.codeowners_auto_sync.AutoSyncNotification.send")
    def test_codeowners_auto_sync_handles_not_implemented_error(
        self,
        mock_send_email: MagicMock,
        mock_get_codeowner_file: MagicMock,
    ) -> None:
        original_raw = self.code_owners.raw

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            commit = self.create_commit(repo=self.repo)
            code_owners_auto_sync(commit.id)

        # The codeowners should NOT be updated
        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == original_raw
        # Notification should have been sent
        mock_send_email.assert_called_once_with()

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        side_effect=NotFound("CODEOWNERS file not found"),
    )
    @patch("sentry.notifications.notifications.codeowners_auto_sync.AutoSyncNotification.send")
    def test_codeowners_auto_sync_handles_not_found_error(
        self,
        mock_send_email: MagicMock,
        mock_get_codeowner_file: MagicMock,
    ) -> None:
        original_raw = self.code_owners.raw

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            commit = self.create_commit(repo=self.repo)
            code_owners_auto_sync(commit.id)

        # The codeowners should NOT be updated
        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == original_raw
        # Notification should have been sent
        mock_send_email.assert_called_once_with()


class InvalidateProjectIssueOwnersCacheTest(TestCase):
    def test_invalidate_project_issue_owners_cache_clears_cache_for_groups(self) -> None:
        group = Group.objects.create(
            project=self.project,
            message="Test group",
            last_seen=timezone.now(),
        )
        cache_key = ISSUE_OWNERS_DEBOUNCE_KEY(group.id)
        cache.set(cache_key, True, 3600)

        assert cache.get(cache_key) is True

        invalidate_project_issue_owners_cache(self.project.id)

        assert cache.get(cache_key) is None
