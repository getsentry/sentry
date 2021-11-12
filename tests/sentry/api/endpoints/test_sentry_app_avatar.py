from base64 import b64encode

from sentry.models import SentryAppAvatar
from sentry.testutils import APITestCase


class SentryAppAvatarTestBase(APITestCase):
    def setUp(self):
        super().setUp()
        self.unpublished_app = self.create_sentry_app(name="Meow", organization=self.organization)
        self.endpoint = "sentry-api-0-sentry-app-avatar"

        self.login_as(self.user)


class SentryAppAvatarTest(SentryAppAvatarTestBase):
    def test_get(self):
        response = self.get_success_response(self.unpublished_app.slug)
        assert response.data["uuid"] == str(self.unpublished_app.uuid)
        # TODO(CEO): Update/uncomment this when the serializer is updated
        # assert response.data["avatar"]["avatarUuid"] is None


class SentryAppAvatarPutTest(SentryAppAvatarTestBase):
    method = "put"

    def test_upload(self):
        data = {"avatar_type": "upload", "avatar_photo": b64encode(self.load_fixture("avatar.svg"))}
        self.get_success_response(self.unpublished_app.slug, **data)

        avatar = SentryAppAvatar.objects.get(sentry_app=self.unpublished_app)
        assert avatar.file_id
        assert avatar.get_avatar_type_display() == "upload"

    def test_put_bad(self):
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app)

        self.get_error_response(self.unpublished_app.slug, avatar_type="upload", status_code=400)
