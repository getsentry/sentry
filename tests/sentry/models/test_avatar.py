from sentry.models import File, UserAvatar
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserAvatarTestCase(TestCase):
    def test_set_null(self):
        user = self.create_user("foo@example.com")
        afile = File.objects.create(name="avatar.png", type=UserAvatar.FILE_TYPE)
        avatar = UserAvatar.objects.create(user=user, file_id=afile.id)

        assert avatar.get_file() == afile

        afile.delete()
        assert avatar.get_file() is None
        assert UserAvatar.objects.get(id=avatar.id).file_id is None
        assert UserAvatar.objects.get(id=avatar.id).get_file() is None
