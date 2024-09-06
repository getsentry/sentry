from unittest.mock import patch

from sentry.api.permissions import StaffPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.userpermission import UserPermission


@control_silo_test
class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permission-details"

    def setUp(self):
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.add_user_permission(self.superuser, "users.admin")

        self.staff_user = self.create_user(is_staff=True)
        self.add_user_permission(self.staff_user, "users.admin")

        self.normal_user = self.create_user(is_superuser=False, is_staff=False)

    # For each request method testcase, ensure regular users fail
    def test_fails_without_superuser_or_staff(self):
        self.login_as(self.normal_user)
        response = self.get_response("me", "broadcasts.admin")
        assert response.status_code == 403

    # For each request method testcase, ensure superuser+staff without users.admin fail
    def test_fails_without_users_admin_permission(self):
        self.superuser_and_staff = self.create_user(is_superuser=True, is_staff=True)
        self.login_as(self.superuser_and_staff, superuser=True, staff=True)

        # We are active superuser and staff but lack the users.admin permission
        response = self.get_response("me", "broadcasts.admin", status_code=403)
        assert response.status_code == 403


@control_silo_test
class UserPermissionDetailsGetTest(UserDetailsTest):
    method = "GET"

    def test_superuser_with_permission(self):
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")
        self.get_success_response("me", "broadcasts.admin", status_code=204)

    def test_superuser_without_permission(self):
        self.login_as(self.superuser, superuser=True)
        self.get_error_response("me", "broadcasts.admin", status_code=404)

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)
        self.add_user_permission(self.staff_user, "broadcasts.admin")

        self.get_success_response("me", "broadcasts.admin", status_code=204)
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_without_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1


@control_silo_test
class UserPermissionDetailsPostTest(UserDetailsTest):
    method = "POST"

    def test_superuser_with_permission(self):
        self.login_as(self.superuser, superuser=True)

        self.get_success_response("me", "broadcasts.admin", status_code=201)
        assert UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    def test_superuser_duplicate_permission(self):
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")

        self.get_error_response("me", "broadcasts.admin", status_code=410)
        assert UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)

        self.get_success_response("me", "broadcasts.admin", status_code=201)
        assert UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_duplicate_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)
        self.add_user_permission(self.staff_user, "broadcasts.admin")

        self.get_error_response("me", "broadcasts.admin", status_code=410)
        assert UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1


@control_silo_test
class UserPermissionDetailsDeleteTest(UserDetailsTest):
    method = "DELETE"

    def test_superuser_with_permission(self):
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")

        self.get_success_response("me", "broadcasts.admin", status_code=204)
        assert not UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    def test_superuser_without_permission(self):
        self.login_as(self.superuser, superuser=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        assert not UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)
        self.add_user_permission(self.staff_user, "broadcasts.admin")

        self.get_success_response("me", "broadcasts.admin", status_code=204)
        assert not UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_without_permission(self, mock_has_permission):
        self.login_as(self.staff_user, staff=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        assert not UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1
