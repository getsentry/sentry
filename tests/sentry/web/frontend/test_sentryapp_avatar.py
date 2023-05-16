from io import BytesIO

from django.urls import reverse

from sentry.models import File, SentryAppAvatar
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@control_silo_test
class SentryAppAvatarTest(APITestCase):
    def test_headers(self):
        sentry_app = self.create_sentry_app(name="Meow", organization=self.organization)
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = SentryAppAvatar.objects.create(
            sentry_app=sentry_app, avatar_type=1, color=True, file_id=photo.id
        )
        url = reverse("sentry-app-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") == "Accept-Language, Cookie"
        assert response.get("Set-Cookie") is None
