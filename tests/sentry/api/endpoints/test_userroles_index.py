from sentry.models import UserRole
from sentry.testutils import APITestCase


class PermissionTestMixin:
    def test_fails_without_superuser(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        UserRole.objects.create(name="test-role")
        resp = self.get_response(name="test-role")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response(name="test-role")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self):
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response(name="test-role")
        assert resp.status_code == 403


class UserRolesTest(APITestCase):
    endpoint = "sentry-api-0-userroles"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")


class UserRolesGetTest(UserRolesTest, PermissionTestMixin):
    def test_simple(self):
        UserRole.objects.create(name="test-role")
        resp = self.get_response()
        assert resp.status_code == 200
        assert len(resp.data) >= 1, resp.data
        assert "test-role" in [r["name"] for r in resp.data]


class UserRolesPostTest(UserRolesTest, PermissionTestMixin):
    method = "POST"

    def test_simple(self):
        resp = self.get_response(name="test-role", permissions=["users.admin"])
        assert resp.status_code == 201
        assert resp.data["name"] == "test-role"
        role = UserRole.objects.get(name="test-role")
        assert role.permissions == ["users.admin"]

    def test_already_exists(self):
        UserRole.objects.create(name="test-role")
        resp = self.get_response(name="test-role")
        assert resp.status_code == 410
