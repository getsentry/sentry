from sentry.models import UserRole
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


class PermissionTestMixin:
    def test_fails_without_superuser(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        UserRole.objects.create(name="test-role")
        resp = self.get_response("test-role")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("test-role")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self):
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("test-role")
        assert resp.status_code == 403


class UserRolesDetailsTest(APITestCase):
    endpoint = "sentry-api-0-userroles-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")


@control_silo_test(stable=True)
class UserRolesDetailsGetTest(PermissionTestMixin, UserRolesDetailsTest):
    def test_simple(self):
        UserRole.objects.create(name="test-role")
        UserRole.objects.create(name="test-role2")
        resp = self.get_response("test-role")
        assert resp.status_code == 200
        assert resp.data["name"] == "test-role"


@control_silo_test(stable=True)
class UserRolesDetailsPutTest(PermissionTestMixin, UserRolesDetailsTest):
    method = "PUT"

    def test_simple(self):
        role1 = UserRole.objects.create(name="test-role", permissions=["users.edit"])
        role2 = UserRole.objects.create(name="test-role2", permissions=["users.edit"])
        resp = self.get_response("test-role", permissions=["users.admin"])
        assert resp.status_code == 200

        role1 = UserRole.objects.get(id=role1.id)
        assert role1.permissions == ["users.admin"]
        role2 = UserRole.objects.get(id=role2.id)
        assert role2.permissions == ["users.edit"]


@control_silo_test(stable=True)
class UserRolesDetailsDeleteTest(PermissionTestMixin, UserRolesDetailsTest):
    method = "DELETE"

    def test_simple(self):
        role1 = UserRole.objects.create(name="test-role")
        role2 = UserRole.objects.create(name="test-role2")
        resp = self.get_response("test-role")
        assert resp.status_code == 204

        assert not UserRole.objects.filter(id=role1.id).exists()
        assert UserRole.objects.filter(id=role2.id).exists()
