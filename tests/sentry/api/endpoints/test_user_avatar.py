from base64 import b64encode
from io import BytesIO
from unittest import mock

from django.test import override_settings
from django.urls import reverse

from sentry import options as options_store
from sentry.models.avatars.user_avatar import UserAvatar, UserAvatarType
from sentry.models.files import ControlFile, File
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class UserAvatarTest(APITestCase):
    def test_get_letter_avatar(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_get_gravatar(self):
        user = self.create_user(email="a@example.com")
        UserAvatar.objects.create(user=user, avatar_type=UserAvatarType.GRAVATAR)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "gravatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_get_upload_control_file(self):
        user = self.create_user(email="a@example.com")

        photo = ControlFile.objects.create(name="test.png", type="avatar.file")
        photo.putfile(BytesIO(b"test"))
        UserAvatar.objects.create(
            user=user, control_file_id=photo.id, avatar_type=UserAvatarType.UPLOAD
        )

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "upload"
        assert response.data["avatar"]["avatarUuid"]

    def test_get_upload_file(self):
        user = self.create_user(email="a@example.com")

        with assume_test_silo_mode(SiloMode.REGION):
            photo = File.objects.create(name="test.png", type="avatar.file")
            photo.putfile(BytesIO(b"test"))
        UserAvatar.objects.create(user=user, file_id=photo.id, avatar_type=UserAvatarType.UPLOAD)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "upload"
        assert response.data["avatar"]["avatarUuid"]

    def test_get_prefers_control_file(self):
        user = self.create_user(email="a@example.com")
        with assume_test_silo_mode(SiloMode.REGION):
            photo = File.objects.create(name="test.png", type="avatar.file")
            photo.putfile(BytesIO(b"test"))
        controlphoto = ControlFile.objects.create(name="control_test.png", type="avatar.file")
        controlphoto.putfile(BytesIO(b"control test"))

        avatar = UserAvatar.objects.create(
            user=user,
            file_id=photo.id,
            control_file_id=controlphoto.id,
            avatar_type=UserAvatarType.UPLOAD,
        )

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "upload"
        assert response.data["avatar"]["avatarUuid"]
        assert isinstance(avatar.get_file(), ControlFile)

    def test_put_gravatar(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.put(url, data={"avatar_type": "gravatar"}, format="json")

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "gravatar"

    def test_put_upload(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.put(
            url,
            data={
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            },
            format="json",
        )

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.get_file_id()
        assert avatar.control_file_id, "new files are control files"
        assert ControlFile.objects.filter(id=avatar.control_file_id).exists()

    def test_put_upload_saves_to_control_file(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)
        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})

        with self.tasks():
            response = self.client.put(
                url,
                data={
                    "avatar_type": "upload",
                    "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
                },
                format="json",
            )

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.get_file_id()
        assert avatar.control_file_id
        assert isinstance(avatar.get_file(), ControlFile)
        assert ControlFile.objects.filter(id=avatar.control_file_id).exists()

    @mock.patch("sentry.tasks.files.copy_file_to_control_and_update_model.apply_async")
    def test_do_not_copy_file_to_control(self, mock_task):
        user = self.create_user(email="a@example.com")

        with assume_test_silo_mode(SiloMode.REGION):
            photo = File.objects.create(name="test.png", type="avatar.file")
            photo.putfile(BytesIO(b"test"))
        avatar = UserAvatar.objects.create(
            user=user, file_id=photo.id, avatar_type=UserAvatarType.UPLOAD
        )

        assert avatar
        assert avatar.get_file_id()
        assert avatar.file_id
        assert not avatar.control_file_id
        with assume_test_silo_mode(SiloMode.REGION):
            assert isinstance(avatar.get_file(), File)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})

        mock_task.reset_mock()
        with assume_test_silo_mode(SiloMode.CONTROL), override_settings(SILO_MODE=SiloMode.CONTROL):
            response = self.client.put(
                url,
                data={
                    "avatar_type": "upload",
                    "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "upload"
        assert response.data["avatar"]["avatarUuid"]
        assert mock_task.call_count == 0

        avatar = UserAvatar.objects.get(user=user)
        assert avatar
        assert avatar.get_file_id()
        assert avatar.file_id is None, "non-control file relation be removed."
        assert avatar.control_file_id
        assert isinstance(avatar.get_file(), ControlFile)

    def test_put_upload_saves_to_control_file_with_separate_storage(self):
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            user = self.create_user(email="a@example.com")

            self.login_as(user=user)
            url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})

            with self.tasks():
                response = self.client.put(
                    url,
                    data={
                        "avatar_type": "upload",
                        "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
                    },
                    format="json",
                )
            avatar = UserAvatar.objects.get(user=user)
            assert response.status_code == 200, response.content
            assert avatar.get_file_id()
            assert isinstance(avatar.get_file(), ControlFile)
            assert ControlFile.objects.filter(id=avatar.control_file_id).exists()

    def test_put_bad(self):
        user = self.create_user(email="a@example.com")
        UserAvatar.objects.create(user=user)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.put(url, data={"avatar_type": "upload"}, format="json")

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

        response = self.client.put(url, data={"avatar_type": "foo"}, format="json")
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

    def test_put_forbidden(self):
        user = self.create_user(email="a@example.com")
        user2 = self.create_user(email="b@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": user2.id})
        response = self.client.put(url, data={"avatar_type": "gravatar"}, format="json")

        assert response.status_code == 403
