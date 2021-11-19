from base64 import b64encode

from sentry.models import SentryAppAvatar
from sentry.testutils import APITestCase


class SentryAppAvatarTestBase(APITestCase):
    def setUp(self):
        super().setUp()
        self.unpublished_app = self.create_sentry_app(name="Meow", organization=self.organization)
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app, color=True, avatar_type=0)
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app, color=False, avatar_type=0)
        self.endpoint = "sentry-api-0-sentry-app-avatar"
        self.login_as(self.user)


class SentryAppAvatarTest(SentryAppAvatarTestBase):
    def test_get(self):
        with self.feature("organizations:sentry-app-logo-upload"):
            response = self.get_success_response(self.unpublished_app.slug)

        assert response.data["avatars"][0]["avatarType"] == 0
        assert response.data["avatars"][0]["avatarUuid"] is not None
        assert response.data["avatars"][0]["color"] is True

        assert response.data["avatars"][1]["avatarType"] == 0
        assert response.data["avatars"][1]["avatarUuid"] is not None
        assert response.data["avatars"][1]["color"] is False
        assert response.data["uuid"] == str(self.unpublished_app.uuid)


class SentryAppAvatarPutTest(SentryAppAvatarTestBase):
    method = "put"

    def test_upload(self):
        with self.feature("organizations:sentry-app-logo-upload"):
            data = {
                "color": 1,
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            }
            resp = self.get_success_response(self.unpublished_app.slug, **data)

        avatar = SentryAppAvatar.objects.get(sentry_app=self.unpublished_app, color=True)
        assert avatar.file_id
        assert avatar.get_avatar_type_display() == "upload"
        assert resp.data["avatars"][1]["avatarType"] == 1
        assert resp.data["avatars"][1]["avatarUuid"] is not None
        assert resp.data["avatars"][1]["color"] is True

    def test_upload_both(self):
        with self.feature("organizations:sentry-app-logo-upload"):
            # upload the regular logo
            data = {
                "color": True,
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            }
            self.get_success_response(self.unpublished_app.slug, **data)

            # upload the issue link logo
            data2 = {
                "color": False,
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            }
            resp = self.get_success_response(self.unpublished_app.slug, **data2)

        avatars = SentryAppAvatar.objects.filter(sentry_app=self.unpublished_app)

        assert len(avatars) == 2
        assert avatars[0].file_id
        assert avatars[0].get_avatar_type_display() == "upload"
        assert resp.data["avatars"][0]["color"] is True
        assert resp.data["avatars"][0]["avatarType"] == 1
        assert resp.data["avatars"][0]["avatarUuid"] is not None

        assert avatars[1].file_id
        assert avatars[1].get_avatar_type_display() == "upload"
        assert resp.data["avatars"][1]["color"] is False
        assert resp.data["avatars"][1]["avatarType"] == 1
        assert resp.data["avatars"][1]["avatarUuid"] is not None

    def test_revert_to_default(self):
        """Test that a user can go back to the default avatars after having uploaded one"""
        with self.feature("organizations:sentry-app-logo-upload"):
            # upload the regular logo
            data = {
                "color": True,
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            }
            self.get_success_response(self.unpublished_app.slug, **data)

            # upload the issue link logo
            data2 = {
                "color": False,
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            }
            self.get_success_response(self.unpublished_app.slug, **data2)

            # revert to default
            data = {
                "color": True,
                "avatar_type": "default",
            }
            self.get_success_response(self.unpublished_app.slug, **data)

            # revert to default
            data2 = {
                "color": False,
                "avatar_type": "default",
            }
            response = self.get_success_response(self.unpublished_app.slug, **data2)

        assert response.data["avatars"][0]["avatarType"] == 0
        assert response.data["avatars"][0]["avatarUuid"] is not None
        assert response.data["avatars"][0]["color"] is True

        assert response.data["avatars"][1]["avatarType"] == 0
        assert response.data["avatars"][1]["avatarUuid"] is not None
        assert response.data["avatars"][1]["color"] is False

    def test_put_bad(self):
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app)
        with self.feature("organizations:sentry-app-logo-upload"):
            self.get_error_response(
                self.unpublished_app.slug, avatar_type="upload", status_code=400
            )
