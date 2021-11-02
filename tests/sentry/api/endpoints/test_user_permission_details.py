from sentry.models import UserPermission
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permission-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(user=self.user)


class UserPermissionDetailsGetTest(UserDetailsTest):
    def test_with_permission(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 204

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 404


class UserPermissionDetailsPostTest(UserDetailsTest):
    def test_required_access(self):
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code == 403

        self.login_as(user=self.user, superuser=True)
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code == 403

        UserPermission.objects.create(user=self.user, permission="users.admin")
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code != 403

    def test_with_permission(self):
        self.user.update(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        UserPermission.objects.create(user=self.user, permission="users.admin")
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code == 410
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()

    def test_without_permission(self):
        self.user.update(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        UserPermission.objects.create(user=self.user, permission="users.admin")
        resp = self.get_response("me", "broadcasts.admin", method="POST")
        assert resp.status_code == 201
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()


class UserPermissionDetailsDeleteTest(UserDetailsTest):
    def test_required_access(self):
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code == 403

        self.login_as(user=self.user, superuser=True)
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code == 403

        UserPermission.objects.create(user=self.user, permission="users.admin")
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code != 403

    def test_with_permission(self):
        self.user.update(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        UserPermission.objects.create(user=self.user, permission="users.admin")
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code == 204
        assert not UserPermission.objects.filter(
            user=self.user, permission="broadcasts.admin"
        ).exists()

    def test_without_permission(self):
        self.user.update(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        UserPermission.objects.create(user=self.user, permission="users.admin")
        resp = self.get_response("me", "broadcasts.admin", method="DELETE")
        assert resp.status_code == 404
        assert not UserPermission.objects.filter(
            user=self.user, permission="broadcasts.admin"
        ).exists()
