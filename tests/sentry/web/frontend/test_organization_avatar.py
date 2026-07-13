import gc
import warnings
from io import BytesIO

from django.urls import reverse
from PIL import Image

from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.web.constants import FOREVER_CACHE


def _png_bytes() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (128, 128)).save(buf, "PNG")
    return buf.getvalue()


class OrganizationAvatarTest(TestCase):
    def test_headers(self) -> None:
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=photo.id)
        url = reverse(
            "sentry-organization-avatar-url",
            kwargs={"avatar_id": avatar.ident, "organization_slug": org.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"]
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None

    def test_origin_header(self) -> None:
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=photo.id)
        url = reverse(
            "sentry-organization-avatar-url",
            kwargs={"avatar_id": avatar.ident, "organization_slug": org.slug},
        )
        response = self.client.get(url, HTTP_ORIGIN="http://localhost")
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"] == "http://localhost"
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None

    def _assert_no_leaked_file_handle(self, url: str) -> None:
        """Fetch ``url`` and assert the avatar file handle is closed before GC.

        An orphaned file handle is only reclaimed by the garbage collector, which
        emits ``ResourceWarning: unclosed file`` from the stdlib finalizer. We force
        a collection and fail if any such warning surfaces.
        """
        gc.collect()
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            response = self.client.get(url)
            assert response.status_code == 200
            response.getvalue()
            del response
            gc.collect()

        unclosed = [
            str(w.message)
            for w in caught
            if issubclass(w.category, ResourceWarning) and "unclosed file" in str(w.message)
        ]
        assert not unclosed, f"avatar request leaked a file handle: {unclosed}"

    def test_does_not_leak_file_handle(self) -> None:
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(_png_bytes()))
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=photo.id)
        url = reverse(
            "sentry-organization-avatar-url",
            kwargs={"avatar_id": avatar.ident, "organization_slug": org.slug},
        )

        self._assert_no_leaked_file_handle(url)
        self._assert_no_leaked_file_handle(url + "?s=80")
