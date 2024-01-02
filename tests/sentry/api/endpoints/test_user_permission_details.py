from sentry.models.userpermission import UserPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permission-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")

    def test_fails_without_superuser(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self):
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403


@control_silo_test
class UserPermissionDetailsGetTest(UserDetailsTest):
    def test_with_permission(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 204

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 404


@control_silo_test
class UserPermissionDetailsPostTest(UserDetailsTest):
    method = "POST"

    def test_with_permission(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 410
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 201
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()


@control_silo_test
class UserPermissionDetailsDeleteTest(UserDetailsTest):
    method = "DELETE"

    def test_with_permission(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 204
        assert not UserPermission.objects.filter(
            user=self.user, permission="broadcasts.admin"
        ).exists()

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 404
        assert not UserPermission.objects.filter(
            user=self.user, permission="broadcasts.admin"
        ).exists()
