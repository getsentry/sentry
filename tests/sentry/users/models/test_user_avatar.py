from sentry import options as options_store
from sentry.models.files.control_file import ControlFile
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_avatar import UserAvatar


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
