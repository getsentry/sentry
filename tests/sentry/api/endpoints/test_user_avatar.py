from base64 import b64encode

from django.urls import reverse

from sentry import options as options_store
from sentry.models import UserAvatar
from sentry.models.files import ControlFile
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserAvatarTest(APITestCase):
    def test_get(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(user.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_gravatar(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.put(url, data={"avatar_type": "gravatar"}, format="json")

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "gravatar"

    def test_upload(self):
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
        assert avatar.control_file_id

    def test_transition_to_control_before_options_set(self):
        with self.tasks():
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
            assert avatar.control_file_id
            assert isinstance(avatar.get_file(), ControlFile)

    def test_transition_to_control_after_options_set(self):
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            with self.tasks():
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
                assert avatar.control_file_id
                assert isinstance(avatar.get_file(), ControlFile)

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
