from io import BytesIO

from django.urls import reverse

from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@region_silo_test
class OrganizationAvatarTest(TestCase):
    def test_headers(self):
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=photo.id)
        url = reverse("sentry-organization-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"]
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None

    def test_origin_header(self):
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = OrganizationAvatar.objects.create(organization=org, file_id=photo.id)
        url = reverse("sentry-organization-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url, HTTP_ORIGIN="http://localhost")
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"] == "http://localhost"
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
