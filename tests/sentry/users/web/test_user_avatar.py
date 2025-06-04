from io import BytesIO

from django.urls import reverse

from sentry.models.files.control_file import ControlFile
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_avatar import UserAvatar
from sentry.web.frontend.generic import FOREVER_CACHE


@control_silo_test
class UserAvatarTest(TestCase):
    def test_headers_control_file(self):
        user = self.create_user(email="a@example.com")
        photo = ControlFile.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = UserAvatar.objects.create(user=user, control_file_id=photo.id)

        url = reverse("sentry-user-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
        assert response["Access-Control-Allow-Origin"]
