from io import BytesIO

from django.urls import reverse

from sentry.models.avatars.sentry_app_avatar import SentryAppAvatar
from sentry.models.files.control_file import ControlFile
from sentry.models.files.file import File
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@control_silo_test
class SentryAppAvatarTest(APITestCase):
    def test_headers(self):
        # We cannot read File from Control silo
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        sentry_app = self.create_sentry_app(name="Meow", organization=self.organization)
        with assume_test_silo_mode(SiloMode.REGION):
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
        assert response["Access-Control-Allow-Origin"]

    def test_headers_control_file(self):
        sentry_app = self.create_sentry_app(name="Meow", organization=self.organization)
        photo = ControlFile.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = SentryAppAvatar.objects.create(
            sentry_app=sentry_app, avatar_type=1, color=True, control_file_id=photo.id
        )
        url = reverse("sentry-app-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") == "Accept-Language, Cookie"
        assert response.get("Set-Cookie") is None
        assert response["Access-Control-Allow-Origin"]
