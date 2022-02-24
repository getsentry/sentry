from unittest.mock import patch

from django.core import mail

from sentry.constants import ObjectStatus
from sentry.exceptions import PluginError
from sentry.models import (
    Commit,
    Integration,
    ProjectCodeOwners,
    Repository,
    RepositoryProjectPathConfig,
    ScheduledDeletion,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteRepositoryTest(TransactionTestCase):
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
        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=org.id, key="1234abcd"
        )
        commit2 = Commit.objects.create(
            repository_id=repo2.id, organization_id=org.id, key="1234abcd"
        )

        deletion = ScheduledDeletion.schedule(repo, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert Commit.objects.filter(id=commit2.id).exists()

    def test_codeowners(self):
        org = self.create_organization(owner=self.user)
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
            organization_integration=org_integration,
        )
        code_owner = ProjectCodeOwners.objects.create(
            project=project,
            repository_project_path_config=path_config,
            raw="* @org/devs",
        )
        deletion = ScheduledDeletion.schedule(repo, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Repository.objects.filter(id=repo.id).exists()
        assert not RepositoryProjectPathConfig.objects.filter(id=path_config.id).exists()
        assert not ProjectCodeOwners.objects.filter(id=code_owner.id).exists()

    def test_no_delete_visible(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id, provider="dummy", name="example/example"
        )
        deletion = ScheduledDeletion.schedule(repo, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)
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

        deletion = ScheduledDeletion.schedule(repo, actor=self.user, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

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

        deletion = ScheduledDeletion.schedule(repo, actor=self.user, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        msg = mail.outbox[-1]
        assert msg.subject == "Unable to Delete Repository Webhooks"
        assert msg.to == [self.user.email]
        assert "secrets" not in msg.body
        assert not Repository.objects.filter(id=repo.id).exists()
