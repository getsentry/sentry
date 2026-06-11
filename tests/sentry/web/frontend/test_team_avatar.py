from io import BytesIO

from django.urls import reverse

from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.web.constants import FOREVER_CACHE


class TeamAvatarPhotoTest(TestCase):
    def test_headers(self) -> None:
        org = self.create_organization()
        team = self.create_team(organization=org)
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = TeamAvatar.objects.create(team=team, file_id=photo.id)
        url = reverse(
            "sentry-team-avatar-url",
            kwargs={"organization_slug": org.slug, "avatar_id": avatar.ident},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"]
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None

    def test_origin_header(self) -> None:
        org = self.create_organization()
        team = self.create_team(organization=org)
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        avatar = TeamAvatar.objects.create(team=team, file_id=photo.id)
        url = reverse(
            "sentry-team-avatar-url",
            kwargs={"organization_slug": org.slug, "avatar_id": avatar.ident},
        )
        response = self.client.get(url, HTTP_ORIGIN="http://localhost")
        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Access-Control-Allow-Origin"] == "http://localhost"
        assert response.get("Vary") is None
        assert response.get("Set-Cookie") is None
