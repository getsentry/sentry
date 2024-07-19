from sentry import options as options_store
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.avatars.user_avatar import UserAvatar
from sentry.models.files.control_file import ControlFile
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserAvatarTestCase(TestCase):
    def test_set_null(self):
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            user = self.create_user("foo@example.com")
            afile = ControlFile.objects.create(name="avatar.png", type=UserAvatar.FILE_TYPE)
            avatar = UserAvatar.objects.create(user=user, control_file_id=afile.id)

            assert avatar.get_file() == afile

            afile.delete()
            assert avatar.get_file() is None
            assert UserAvatar.objects.get(id=avatar.id).control_file_id is None
            assert UserAvatar.objects.get(id=avatar.id).get_file() is None


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
