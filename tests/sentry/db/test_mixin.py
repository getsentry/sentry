from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.models import OrganizationOption, Repository
from sentry.testutils import TestCase


class RenamePendingDeleteTest(TestCase):
    def setUp(self):
        super(RenamePendingDeleteTest, self).setUp()
        self.repository = Repository.objects.create(
            organization_id=self.organization.id,
            name="example/name",
            provider="provider",
            external_id="external_id",
        )

        class MockUuid4:
            hex = "1234567"

        self.mock_uuid4 = MockUuid4

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
        with patch("sentry.db.mixin.uuid4", new=self.mock_uuid4):
            self.repository.rename_on_pending_deletion()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == "1234567"
        assert repo.external_id == "1234567"
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
