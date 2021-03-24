from sentry.models import OrganizationOption, Repository
from sentry.testutils import TestCase
from sentry.utils.compat.mock import patch


class RenamePendingDeleteTest(TestCase):
    def setUp(self):
        super().setUp()
        self.repository = Repository.objects.create(
            organization_id=self.organization.id,
            name="example/name",
            provider="provider",
            external_id="external_id",
        )

    def assert_organization_option(self, repo):
        option = OrganizationOption.objects.get(
            organization_id=repo.organization_id, key=repo.build_pending_deletion_key()
        )
        assert option.value == {
            "id": repo.id,
            "model": Repository.__name__,
            "name": "example/name",
            "external_id": "external_id",
        }

    def test_rename_on_pending_deletion(self):
        with patch("sentry.db.mixin.uuid4", new=self.get_mock_uuid()):
            self.repository.rename_on_pending_deletion()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == "abc123"
        assert repo.external_id == "abc123"
        self.assert_organization_option(repo)

    def test_reset_pending_deletion_field_names(self):
        self.repository.rename_on_pending_deletion()
        self.repository.reset_pending_deletion_field_names()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == "example/name"
        assert repo.external_id == "external_id"
        self.assert_organization_option(repo)

    def test_delete_pending_deletion_option(self):
        self.repository.rename_on_pending_deletion()
        self.repository.delete()
        assert not OrganizationOption.objects.filter(
            organization_id=self.organization.id, key=self.repository.build_pending_deletion_key()
        ).exists()
