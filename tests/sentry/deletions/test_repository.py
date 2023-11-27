from unittest.mock import patch

from django.core import mail
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.exceptions import PluginError
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.pullrequest import CommentType, PullRequest, PullRequestComment
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class DeleteRepositoryTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.PENDING_DELETION,
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, provider="dummy", name="example/example2"
        )
        commit_author = CommitAuthor.objects.create(
            organization_id=org.id,
            name="Sally",
            email="sally@example.org",
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key="1234abcd",
            author=commit_author,
        )
        commit2 = Commit.objects.create(
            repository_id=repo2.id,
            organization_id=org.id,
            key="1234abcd",
            author=commit_author,
        )
        pull = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key="42",
            title="fix bugs",
            message="various fixes",
            author=commit_author,
        )
        comment = PullRequestComment.objects.create(
            pull_request=pull,
            external_id=123,
            group_ids=[1],
            comment_type=CommentType.OPEN_PR,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        self.ScheduledDeletion.schedule(instance=repo, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert not PullRequest.objects.filter(id=pull.id).exists()
        assert not PullRequestComment.objects.filter(id=comment.id).exists()
        assert Commit.objects.filter(id=commit2.id).exists()

    def test_codeowners(self):
        org = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="github", name="Example", external_id="abcd"
            )
            org_integration = self.integration.add_organization(org, self.user)
        project = self.create_project(organization=org)
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.PENDING_DELETION,
        )
        path_config = RepositoryProjectPathConfig.objects.create(
            project=project,
            repository=repo,
            stack_root="",
            source_root="src/packages/store",
            default_branch="main",
            organization_integration_id=org_integration.id,
            integration_id=org_integration.integration_id,
            organization_id=org_integration.organization_id,
        )
        code_owner = ProjectCodeOwners.objects.create(
            project=project,
            repository_project_path_config=path_config,
            raw="* @org/devs",
        )
        self.ScheduledDeletion.schedule(instance=repo, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not RepositoryProjectPathConfig.objects.filter(id=path_config.id).exists()
        assert not ProjectCodeOwners.objects.filter(id=code_owner.id).exists()

    def test_no_delete_visible(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id, provider="dummy", name="example/example"
        )
        self.ScheduledDeletion.schedule(instance=repo, days=0)

        with self.tasks():
            run_scheduled_deletions()
        assert Repository.objects.filter(id=repo.id).exists()

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.delete_repository")
    def test_delete_fail_email(self, mock_delete_repo):
        mock_delete_repo.side_effect = PluginError("foo")

        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.PENDING_DELETION,
        )

        self.ScheduledDeletion.schedule(instance=repo, actor=self.user, days=0)

        with self.tasks():
            run_scheduled_deletions()

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Delete Repository Webhooks"
        assert msg.to == [self.user.email]
        assert "foo" in msg.body
        assert not Repository.objects.filter(id=repo.id).exists()

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.delete_repository")
    def test_delete_fail_email_random(self, mock_delete_repo):
        mock_delete_repo.side_effect = Exception("secrets")

        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.PENDING_DELETION,
        )

        self.ScheduledDeletion.schedule(instance=repo, actor=self.user, days=0)

        with self.tasks():
            run_scheduled_deletions()

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Delete Repository Webhooks"
        assert msg.to == [self.user.email]
        assert "secrets" not in msg.body
        assert not Repository.objects.filter(id=repo.id).exists()

    def test_botched_deletion(self):
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.PENDING_DELETION,
        )
        # Left over from a botched deletion.
        OrganizationOption.objects.create(
            organization_id=self.organization.id,
            key=repo.build_pending_deletion_key(),
            value="",
        )

        self.ScheduledDeletion.schedule(instance=repo, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Repository.objects.filter(id=repo.id).exists()
