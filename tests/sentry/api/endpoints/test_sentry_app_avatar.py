from base64 import b64encode

from sentry import options as options_store
from sentry.models.avatars.sentry_app_avatar import SentryAppAvatar
from sentry.models.files.control_file import ControlFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class SentryAppAvatarTestBase(APITestCase):
    endpoint = "sentry-api-0-sentry-app-avatar"

    def setUp(self):
        super().setUp()
        self.unpublished_app = self.create_sentry_app(name="Meow", organization=self.organization)
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app, color=True, avatar_type=0)
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app, color=False, avatar_type=0)
        self.login_as(self.user)

    def get_avatar(self, resp, is_color=True):
        avatars = resp.data["avatars"]
        for avatar in avatars:
            if avatar.get("color") == is_color:
                return avatar

    def create_avatar(self, is_color):
        avatar_photo = (
            b64encode(self.load_fixture("rookout-color.png"))
            if is_color is True
            else b64encode(self.load_fixture("rookout-bw.png"))
        )
        data = {
            "color": is_color,
            "avatar_type": "upload",
            "avatar_photo": avatar_photo,
        }
        return self.get_success_response(self.unpublished_app.slug, **data)


@control_silo_test
class SentryAppAvatarGetTest(SentryAppAvatarTestBase):
    def test_get(self):
        response = self.get_success_response(self.unpublished_app.slug)

        color_avatar = self.get_avatar(response)
        simple_avatar = self.get_avatar(response, False)

        assert color_avatar["avatarType"] == "default"
        assert color_avatar["avatarUuid"] is not None
        assert color_avatar["color"] is True

        assert simple_avatar["avatarType"] == "default"
        assert simple_avatar["avatarUuid"] is not None
        assert simple_avatar["color"] is False
        assert response.data["uuid"] == str(self.unpublished_app.uuid)

    def test_get_upload_control_file(self):
        self.method = "put"
        self.create_avatar(is_color=True)

        self.method = "get"
        self.create_avatar(is_color=True)
        response = self.get_success_response(self.unpublished_app.slug)

        assert response.status_code == 200, response.content
        assert response.data["uuid"] == str(self.unpublished_app.uuid)
        uploads = [
            avatar for avatar in response.data["avatars"] if avatar["avatarType"] == "upload"
        ]
        upload = uploads[0]
        assert upload["avatarType"] == "upload"
        assert upload["avatarUuid"]

        avatar = SentryAppAvatar.objects.filter(sentry_app_id=self.unpublished_app.id).first()
        assert avatar
        assert avatar.get_file_id()
        assert avatar.control_file_id
        file = avatar.get_file()
        assert isinstance(file, ControlFile)


@control_silo_test
class SentryAppAvatarPutTest(SentryAppAvatarTestBase):
    method = "put"

    def test_upload(self):
        resp = self.create_avatar(is_color=True)

        avatar = SentryAppAvatar.objects.get(sentry_app=self.unpublished_app, color=True)
        assert avatar.get_file_id()
        assert avatar.get_avatar_type_display() == "upload"
        color_avatar = self.get_avatar(resp)
        assert color_avatar
        assert color_avatar["avatarType"] == "upload"
        assert color_avatar["avatarUuid"] is not None
        assert color_avatar["color"] is True

    def test_upload_control_file(self):
        resp = self.create_avatar(is_color=True)

        avatar = SentryAppAvatar.objects.get(sentry_app=self.unpublished_app, color=True)
        assert avatar.get_file_id()
        assert avatar.control_file_id
        assert avatar.get_avatar_type_display() == "upload"
        color_avatar = self.get_avatar(resp)
        assert color_avatar
        assert color_avatar["avatarType"] == "upload"
        assert color_avatar["avatarUuid"] is not None
        assert color_avatar["color"] is True

    def test_upload_control_with_storage_options(self):
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            resp = self.create_avatar(is_color=True)

            avatar = SentryAppAvatar.objects.get(sentry_app=self.unpublished_app, color=True)
            assert avatar.get_file_id()
            assert avatar.get_avatar_type_display() == "upload"
            color_avatar = self.get_avatar(resp)
            assert color_avatar
            assert color_avatar["avatarType"] == "upload"
            assert color_avatar["avatarUuid"] is not None
            assert color_avatar["color"] is True

    def test_upload_both(self):
        self.create_avatar(is_color=True)
        resp = self.create_avatar(is_color=False)

        avatars = SentryAppAvatar.objects.filter(sentry_app=self.unpublished_app)

        assert len(avatars) == 2
        assert avatars[0].get_file_id()
        assert avatars[0].get_avatar_type_display() == "upload"
        color_avatar = self.get_avatar(resp)
        assert color_avatar
        assert color_avatar["color"] is True
        assert color_avatar["avatarType"] == "upload"
        assert color_avatar["avatarUuid"] is not None

        assert avatars[1].get_file_id()
        assert avatars[1].get_avatar_type_display() == "upload"
        simple_avatar = self.get_avatar(resp, False)
        assert simple_avatar
        assert simple_avatar["color"] is False
        assert simple_avatar["avatarType"] == "upload"
        assert simple_avatar["avatarUuid"] is not None

    def test_revert_to_default(self):
        """Test that a user can go back to the default avatars after having uploaded one"""
        self.create_avatar(is_color=True)
        self.create_avatar(is_color=False)

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

        color_avatar = self.get_avatar(response)
        simple_avatar = self.get_avatar(response, False)

        assert color_avatar
        assert color_avatar["avatarType"] == "default"
        assert color_avatar["avatarUuid"] is not None
        assert color_avatar["color"] is True

        assert simple_avatar
        assert simple_avatar["avatarType"] == "default"
        assert simple_avatar["avatarUuid"] is not None
        assert simple_avatar["color"] is False

    def test_upload_color_for_black_white(self):
        """Test that we reject a color image meant for the black and white icon"""
        data = {
            "color": False,
            "avatar_type": "upload",
            "avatar_photo": b64encode(self.load_fixture("rookout-color.png")),
        }
        self.get_error_response(self.unpublished_app.slug, **data)

    def test_reject_jpgs(self):
        """Test that we reject a non-png file type"""
        data = {
            "color": False,
            "avatar_type": "upload",
            "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
        }
        self.get_error_response(self.unpublished_app.slug, **data)

    def test_put_bad(self):
        SentryAppAvatar.objects.create(sentry_app=self.unpublished_app)
        self.get_error_response(self.unpublished_app.slug, avatar_type="upload", status_code=400)


@control_silo_test
class SentryAppAvatarDeleteTest(SentryAppAvatarTestBase):
    def test_delete(self):
        """Test that when the related sentryapp is deleted (not really deleted, but date_deleted is set), the associated avatars are deleted"""
        self.create_avatar(is_color=True)
        self.create_avatar(is_color=False)

        assert SentryAppAvatar.objects.count() == 2
        self.unpublished_app.delete()
        assert SentryAppAvatar.objects.count() == 0
