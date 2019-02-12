from __future__ import absolute_import

from mock import patch

from sentry.models import OrganizationOption, Repository
from sentry.testutils import TestCase


class RenamePendingDeleteTest(TestCase):
    def setUp(self):
        super(RenamePendingDeleteTest, self).setUp()
        self.repository = Repository.objects.create(
            organization_id=self.organization.id,
            name='example/name',
            provider='provider',
            external_id='external_id',
        )

        class MockUuid4:
            hex = '1234567'

        self.mock_uuid4 = MockUuid4

    def test_rename_on_pending_deletion(self):
        with patch('sentry.db.mixin.uuid4', new=self.mock_uuid4):
            self.repository.rename_on_pending_deletion()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == '1234567'
        assert repo.external_id == '1234567'

    def test_reset_pending_deletion_field_names(self):
        self.repository.rename_on_pending_deletion()
        self.repository.reset_pending_deletion_field_names()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == 'example/name'
        assert repo.external_id == 'external_id'

    def test_delete_pending_deletion_option(self):
        self.repository.rename_on_pending_deletion()
        self.repository.delete()
        assert not OrganizationOption.objects.filter(
            organization_id=self.organization.id,
        ).exists()
