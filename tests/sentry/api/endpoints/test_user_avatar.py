from base64 import b64encode

from django.urls import reverse

from sentry.api.serializers.models.user import AVATAR_URL_REGEX
from sentry.models import UserAvatar
from sentry.models.user import User
from sentry.testutils import APITestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.types.region import get_local_region


@region_silo_test(stable=True)
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

        avatar = UserAvatar.objects.get(user_id=user.id)
        assert response.status_code == 200, response.content
        with exempt_from_silo_limits():
            user = User.objects.get(id=user.id)
            assert user.get_avatar_type() == "gravatar"
            assert user.avatar_url is None
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

        avatar = UserAvatar.objects.get(user_id=user.id)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file_id
        with exempt_from_silo_limits():
            user = User.objects.get(id=user.id)
            assert user.get_avatar_type() == "upload"
            assert user.avatar_url == get_local_region().to_url(f"/avatar/{avatar.ident}/")
            assert AVATAR_URL_REGEX.search(user.avatar_url)

    def test_put_bad(self):
        user = self.create_user(email="a@example.com")
        UserAvatar.objects.create(user=user)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-avatar", kwargs={"user_id": "me"})
        response = self.client.put(url, data={"avatar_type": "upload"}, format="json")

        avatar = UserAvatar.objects.get(user_id=user.id)
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
