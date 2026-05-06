import pytest

from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.files.file import File
from sentry.models.organizationavatarreplica import OrganizationAvatarReplica
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test, create_test_cells


class OrganizationAvatarTestCase(TestCase):
    def test_set_null(self) -> None:
        org = self.create_organization()
        afile = File.objects.create(name="avatar.png", type=OrganizationAvatar.FILE_TYPE)
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=afile.id)

        assert avatar.get_file() == afile

        afile.delete()
        assert avatar.get_file() is None
        assert OrganizationAvatar.objects.get(id=avatar.id).file_id is None
        assert OrganizationAvatar.objects.get(id=avatar.id).get_file() is None


# TODO(cells): Unskip when implemented
@pytest.mark.skip(reason="Requires implementation of avatar replication in control")
@django_db_all(transaction=True)
@cell_silo_test(cells=create_test_cells("us"), include_monolith_run=True)
def test_organization_avatar_replica_created_on_save() -> None:
    org = Factories.create_organization()
    avatar = OrganizationAvatar.objects.create(organization=org, avatar_type=0)

    with assume_test_silo_mode(SiloMode.CONTROL):
        replica = OrganizationAvatarReplica.objects.get(organization_id=org.id)
        assert replica.avatar_type == avatar.avatar_type
        assert replica.avatar_ident == avatar.ident


# TODO(cells): Unskip when implemented
@pytest.mark.skip(reason="Requires implementation of avatar deletion in control")
@django_db_all(transaction=True)
@cell_silo_test(cells=create_test_cells("us"), include_monolith_run=True)
def test_organization_avatar_replica_deleted_on_avatar_delete() -> None:
    org = Factories.create_organization()
    avatar = OrganizationAvatar.objects.create(organization=org, avatar_type=0)
    org_id = org.id

    with outbox_runner():
        avatar.delete()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not OrganizationAvatarReplica.objects.filter(organization_id=org_id).exists()
