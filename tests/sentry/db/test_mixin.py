from __future__ import absolute_import

from sentry.models import OrganizationOption, Repository
from sentry.testutils import TestCase


class RenamePendingDeleteTest(TestCase):
    def setUp(self):
        super(RenamePendingDeleteTest, self).setUp()
        self.repository = Repository.objects.create(
            organization_id=self.organization.id,
            name='name',
            provider='provider',
            external_id='external_id',
        )

    def test_rename_on_pending_deletion(self):
        self.repository.rename_on_pending_deletion()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name != 'name'
        assert repo.external_id != 'external_id'

    def test_reset_pending_deletion_field_names(self):
        self.repository.rename_on_pending_deletion()
        self.repository.reset_pending_deletion_field_names()
        repo = Repository.objects.get(id=self.repository.id)
        assert repo.name == 'name'
        assert repo.external_id == 'external_id'

    def test_delete_pending_deletion_option(self):
        self.repository.rename_on_pending_deletion()
        self.repository.delete()
        assert not OrganizationOption.objects.filter(
            organization_id=self.organization.id,
        ).exists()
