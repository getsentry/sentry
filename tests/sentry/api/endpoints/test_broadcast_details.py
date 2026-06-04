from sentry.models.broadcast import Broadcast, BroadcastSeen
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BroadcastDetailsTest(APITestCase):
    def test_simple(self) -> None:
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        Broadcast.objects.create(message="foo", is_active=False)

        self.login_as(user=self.user)

        response = self.client.get(f"/api/0/broadcasts/{broadcast1.id}/")
        assert response.status_code == 200
        assert response.data["id"] == str(broadcast1.id)

    def test_invalid_id(self) -> None:
        self.login_as(user=self.user)

        response = self.client.get("/api/0/broadcasts/nope/")
        assert response.status_code == 404


@control_silo_test
class BroadcastUpdateTest(APITestCase):
    def test_regular_user(self) -> None:
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        broadcast2 = Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user)

        response = self.client.put(
            f"/api/0/broadcasts/{broadcast1.id}/", {"hasSeen": "1", "message": "foobar"}
        )
        assert response.status_code == 200
        assert response.data["hasSeen"]

        assert BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast1).exists()
        assert not BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast2).exists()
        broadcast1 = Broadcast.objects.get(id=broadcast1.id)
        assert broadcast1.message == "bar"
        broadcast2 = Broadcast.objects.get(id=broadcast2.id)
        assert broadcast2.message == "foo"

    def test_superuser(self) -> None:
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        broadcast2 = Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(
            f"/api/0/broadcasts/{broadcast1.id}/", {"hasSeen": "1", "message": "foobar"}
        )
        assert response.status_code == 200
        assert response.data["hasSeen"]

        assert BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast1).exists()
        assert not BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast2).exists()
        broadcast1 = Broadcast.objects.get(id=broadcast1.id)
        assert broadcast1.message == "foobar"
        broadcast2 = Broadcast.objects.get(id=broadcast2.id)
        assert broadcast2.message == "foo"

    def test_edit_changelog_broadcast_locks_sync(self) -> None:
        broadcast = Broadcast.objects.create(
            upstream_id="changelog-abc",
            title="Orig",
            message="Orig message",
            link="https://sentry.io/changelog/orig/",
            is_active=True,
        )

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(
            f"/api/0/broadcasts/{broadcast.id}/",
            {
                "title": "Fixed typo",
                "message": broadcast.message,
                "link": broadcast.link,
            },
        )
        assert response.status_code == 200

        broadcast.refresh_from_db()
        assert broadcast.title == "Fixed typo"
        assert broadcast.sync_locked is True

    def test_edit_non_changelog_broadcast_does_not_lock(self) -> None:
        broadcast = Broadcast.objects.create(
            title="Manual",
            message="Manual",
            link="https://sentry.io/",
            is_active=True,
        )

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(
            f"/api/0/broadcasts/{broadcast.id}/",
            {"title": "Updated", "message": broadcast.message, "link": broadcast.link},
        )
        assert response.status_code == 200

        broadcast.refresh_from_db()
        assert broadcast.sync_locked is False

    def test_hasseen_only_does_not_lock(self) -> None:
        broadcast = Broadcast.objects.create(
            upstream_id="changelog-xyz",
            title="Orig",
            message="Orig",
            link="https://sentry.io/changelog/x/",
            is_active=True,
        )

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(f"/api/0/broadcasts/{broadcast.id}/", {"hasSeen": "1"})
        assert response.status_code == 200

        broadcast.refresh_from_db()
        assert broadcast.sync_locked is False

    def test_explicit_unlock_clears_sync_locked(self) -> None:
        broadcast = Broadcast.objects.create(
            upstream_id="changelog-unlock",
            title="Orig",
            message="Orig",
            link="https://sentry.io/changelog/u/",
            is_active=True,
            sync_locked=True,
        )

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(
            f"/api/0/broadcasts/{broadcast.id}/",
            {
                "title": broadcast.title,
                "message": broadcast.message,
                "link": broadcast.link,
                "syncLocked": False,
            },
        )
        assert response.status_code == 200

        broadcast.refresh_from_db()
        assert broadcast.sync_locked is False

    def test_serializer_exposes_sync_fields(self) -> None:
        broadcast = Broadcast.objects.create(
            upstream_id="changelog-serialize",
            title="T",
            message="M",
            link="https://sentry.io/changelog/s/",
            is_active=True,
            sync_locked=True,
        )

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.get(f"/api/0/broadcasts/{broadcast.id}/")
        assert response.status_code == 200
        assert response.data["upstreamId"] == "changelog-serialize"
        assert response.data["syncLocked"] is True
