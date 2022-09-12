from io import BytesIO

from django.urls import reverse

from sentry.models import File, UserAvatar
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@control_silo_test
class UserAvatarTest(TestCase):
    def test_headers(self):
        user = self.create_user(email="a@example.com")
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = UserAvatar.objects.create(user=user, file_id=photo.id)
        url = reverse("sentry-user-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
