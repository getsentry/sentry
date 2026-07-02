from django.conf import settings
from django.test import override_settings

from sentry.models.files.control_file import ControlFile
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_avatar import UserAvatar


@control_silo_test
class UserAvatarTestCase(TestCase):
    def test_set_null(self) -> None:
        with override_settings(
            SENTRY_CONTROL_FILE_STORAGE_BACKEND=settings.SENTRY_FILE_STORAGE_BACKEND,
            SENTRY_CONTROL_FILE_STORAGE_CONFIG=settings.SENTRY_FILE_STORAGE_CONFIG,
        ):
            user = self.create_user("foo@example.com")
            afile = ControlFile.objects.create(name="avatar.png", type=UserAvatar.FILE_TYPE)
            avatar = UserAvatar.objects.create(user=user, control_file_id=afile.id)

            assert avatar.get_file() == afile

            afile.delete()
            assert avatar.get_file() is None
            assert UserAvatar.objects.get(id=avatar.id).control_file_id is None
            assert UserAvatar.objects.get(id=avatar.id).get_file() is None
