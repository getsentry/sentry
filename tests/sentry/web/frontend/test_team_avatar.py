from io import BytesIO

from django.urls import reverse

from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@region_silo_test(stable=True)
class TeamAvatarTest(TestCase):
    def test_headers(self):
        team = self.create_team()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = TeamAvatar.objects.create(team=team, file_id=photo.id)
        url = reverse("sentry-team-avatar-url", kwargs={"avatar_id": avatar.ident})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
