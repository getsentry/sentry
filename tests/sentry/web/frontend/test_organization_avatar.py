from io import BytesIO

from django.urls import reverse

from sentry.models import File, OrganizationAvatar
from sentry.testutils import TestCase
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
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
