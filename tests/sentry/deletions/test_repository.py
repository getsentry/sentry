from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from django.core import mail

from sentry.exceptions import PluginError
from sentry.models import Commit, Repository, ScheduledDeletion
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteRepositoryTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id, provider="dummy", name="example/example"
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

    @patch("sentry.plugins.providers.dummy.repository.DummyRepositoryProvider.delete_repository")
    def test_delete_fail_email(self, mock_delete_repo):
        mock_delete_repo.side_effect = PluginError("foo")

        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id, provider="dummy", name="example/example"
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
            organization_id=org.id, provider="dummy", name="example/example"
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
