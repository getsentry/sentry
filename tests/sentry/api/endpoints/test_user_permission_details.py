from unittest.mock import patch

from sentry.api.permissions import StaffPermission
from sentry.models.userpermission import UserPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permission-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")

        self.staff_user = self.create_user(is_staff=True)
        self.add_user_permission(self.staff_user, "users.admin")

    def test_fails_without_superuser(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(self.user)

        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

        self.user.update(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

    def test_fails_without_staff(self):
        self.user = self.create_user(is_staff=False)
        self.login_as(self.user)

        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

        self.user.update(is_staff=True)
        self.login_as(self.user, staff=True)
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403

    def test_fails_without_users_admin_permission(self):
        self.user = self.create_user(is_superuser=True)
        self.login_as(self.user, superuser=True)
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 403


class UserPermissionDetailsGetTest(UserDetailsTest):
    def test_with_permission(self):
        self.add_user_permission(self.user, "broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 204

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 404

    @with_feature("auth:enterprise-staff-cookie")
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)
        self.add_user_permission(self.staff_user, "broadcasts.admin")

        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 204
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @with_feature("auth:enterprise-staff-cookie")
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_without_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)

        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 404
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1


class UserPermissionDetailsPostTest(UserDetailsTest):
    method = "POST"

    def test_with_permission(self):
        self.add_user_permission(self.user, "broadcasts.admin")
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 410
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()

    def test_without_permission(self):
        resp = self.get_response("me", "broadcasts.admin")
        assert resp.status_code == 201
        assert UserPermission.objects.filter(user=self.user, permission="broadcasts.admin").exists()


class UserPermissionDetailsDeleteTest(UserDetailsTest):
    method = "DELETE"

    def test_with_permission(self):
        self.add_user_permission(self.user, "broadcasts.admin")
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
