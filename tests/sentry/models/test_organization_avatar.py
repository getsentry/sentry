from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase


class OrganizationAvatarTestCase(TestCase):
    def test_set_null(self):
        org = self.create_organization()
        afile = File.objects.create(name="avatar.png", type=OrganizationAvatar.FILE_TYPE)
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=afile.id)

        assert avatar.get_file() == afile

        afile.delete()
        assert avatar.get_file() is None
        assert OrganizationAvatar.objects.get(id=avatar.id).file_id is None
        assert OrganizationAvatar.objects.get(id=avatar.id).get_file() is None
