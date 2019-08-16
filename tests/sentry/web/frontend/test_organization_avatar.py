from __future__ import absolute_import

from django.core.urlresolvers import reverse
from six import BytesIO

from sentry.models import File, OrganizationAvatar
from sentry.testutils import TestCase
from sentry.web.frontend.generic import FOREVER_CACHE


class OrganizationAvatarTest(TestCase):
    def test_headers(self):
        org = self.create_organization()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = OrganizationAvatar.objects.create(organization=org, file=photo)
        url = reverse("sentry-organization-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
