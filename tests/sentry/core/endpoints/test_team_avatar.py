from base64 import b64encode

from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.testutils.cases import APITestCase


class TeamAvatarTestBase(APITestCase):
    endpoint = "sentry-api-0-team-avatar"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.team = self.create_team(organization=self.organization, members=[self.user])


class TeamAvatarGetTest(TeamAvatarTestBase):
    def test_get(self) -> None:
        response = self.get_success_response(self.organization.slug, self.team.slug)
        assert response.data["id"] == str(self.team.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None
        assert response.data["avatar"]["avatarUrl"] is None


class TeamAvatarPutTest(TeamAvatarTestBase):
    method = "put"

    def test_upload(self) -> None:
        data = {
            "avatar_type": "upload",
            "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
        }
        response = self.get_success_response(self.organization.slug, self.team.slug, **data)

        avatar = TeamAvatar.objects.get(team=self.team)
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file_id

        assert response.data["avatar"]["avatarType"] == "upload"
        assert response.data["avatar"]["avatarUuid"] is not None
        assert response.data["avatar"]["avatarUrl"] is not None

    def test_put_bad(self) -> None:
        TeamAvatar.objects.create(team=self.team)

        self.get_error_response(
            self.organization.slug, self.team.slug, avatar_type="upload", status_code=400
        )

        avatar = TeamAvatar.objects.get(team=self.team)
        assert avatar.get_avatar_type_display() == "letter_avatar"

        self.get_error_response(
            self.organization.slug, self.team.slug, avatar_type="foo", status_code=400
        )

        assert avatar.get_avatar_type_display() == "letter_avatar"

    def test_put_gravatar(self) -> None:
        self.get_error_response(
            self.organization.slug, self.team.slug, avatar_type="gravatar", status_code=400
        )

    def test_put_forbidden(self) -> None:
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.get_error_response(org.slug, team.slug, avatar_type="letter_avatar", status_code=403)

    def test_put_letter_avatar(self) -> None:
        TeamAvatar.objects.create(team=self.team)

        self.get_success_response(
            self.organization.slug, self.team.slug, avatar_type="letter_avatar"
        )

        avatar = TeamAvatar.objects.get(team=self.team)
        assert avatar.get_avatar_type_display() == "letter_avatar"
        assert avatar.file_id is None
