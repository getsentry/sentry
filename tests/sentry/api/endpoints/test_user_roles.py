from sentry.models.userrole import UserRole
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserUserRolesTest(APITestCase):
    endpoint = "sentry-api-0-user-userroles"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")

    def test_fails_without_superuser(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        UserRole.objects.create(name="test-role")
        resp = self.get_response("me")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        resp = self.get_response("me")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self):
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("me")
        assert resp.status_code == 403


@control_silo_test
class UserUserRolesGetTest(UserUserRolesTest):
    def test_lookup_self(self):
        role = UserRole.objects.create(name="support", permissions=["broadcasts.admin"])
        role.users.add(self.user)
        role2 = UserRole.objects.create(name="admin", permissions=["users.admin"])
        role2.users.add(self.user)
        UserRole.objects.create(name="other", permissions=["users.edit"])
        resp = self.get_response("me")
        assert resp.status_code == 200
        assert len(resp.data) == 2, resp.data
        role_names = [r["name"] for r in resp.data]
        assert "support" in role_names
        assert "admin" in role_names
