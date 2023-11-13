from datetime import datetime, timezone
from unittest.mock import patch

from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.projectownership import ProjectOwnership
from sentry.models.repository import Repository
from sentry.tasks.codeowners import code_owners_auto_sync, update_code_owners_schema
from sentry.testutils.cases import TestCase

LATEST_GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class CodeOwnersTest(TestCase):
    def setUp(self):
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

    def test_simple(self):
        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # new external team mapping
            self.external_team = self.create_external_team(integration=self.integration)
            update_code_owners_schema(organization=self.organization, integration=self.integration)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "team", "identifier": "tiger-team"},
                    ],
                }
            ],
        }

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # delete external team mapping
            ExternalActor.objects.get(id=self.external_team.id).delete()
            update_code_owners_schema(organization=self.organization, integration=self.integration)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {"$version": 1, "rules": []}

    @patch("django.utils.timezone.now")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_codeowner_file",
        return_value=LATEST_GITHUB_CODEOWNERS,
    )
    def test_codeowners_auto_sync_successful(self, mock_get_codeowner_file, mock_timezone_now):
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
                commit=commit,
                filename=".github/CODEOWNERS",
                type="A",
            )
            mock_now = datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)
            mock_timezone_now.return_value = mock_now
            code_owners_auto_sync(commit.id)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == LATEST_GITHUB_CODEOWNERS["raw"]
        assert code_owners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"identifier": "admin@localhost", "type": "user"},
                        {"identifier": "tiger-team", "type": "team"},
                    ],
                },
                {
                    "matcher": {"pattern": "*", "type": "codeowners"},
                    "owners": [{"identifier": "admin@localhost", "type": "user"}],
                },
            ],
        }
        assert code_owners.date_updated == mock_now

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_codeowner_file",
        return_value=None,
    )
    @patch("sentry.notifications.notifications.codeowners_auto_sync.AutoSyncNotification.send")
    def test_codeowners_auto_sync_failed_to_fetch_file(
        self,
        mock_send_email,
        mock_get_codeowner_file,
    ):

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            commit = Commit.objects.create(
                repository_id=self.repo.id,
                organization_id=self.organization.id,
                key="1234",
                message="Initial commit",
            )
            CommitFileChange.objects.create(
                organization_id=self.organization.id,
                commit=commit,
                filename=".github/CODEOWNERS",
                type="A",
            )
            code_owners_auto_sync(commit.id)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)
        assert code_owners.raw == self.data["raw"]
        mock_send_email.assert_called_once_with()
