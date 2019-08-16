from __future__ import absolute_import

from django.core.urlresolvers import reverse
from six import BytesIO

from sentry.models import File, ProjectAvatar
from sentry.testutils import TestCase
from sentry.web.frontend.generic import FOREVER_CACHE


class ProjectAvatarTest(TestCase):
    def test_headers(self):
        project = self.create_project()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = ProjectAvatar.objects.create(project=project, file=photo)
        url = reverse("sentry-project-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
