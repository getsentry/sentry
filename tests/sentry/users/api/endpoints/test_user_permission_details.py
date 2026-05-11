from unittest.mock import MagicMock, patch

from sentry.api.permissions import StaffPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.userpermission import UserPermission


@control_silo_test
class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permission-details"

    def setUp(self) -> None:
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.add_user_permission(self.staff_user, "users.admin")

        self.normal_user = self.create_user(is_superuser=False, is_staff=False)

    # For each request method testcase, ensure regular users fail
    @override_options({"staff.ga-rollout": True})
    def test_fails_without_staff(self) -> None:
        self.login_as(self.normal_user)
        response = self.get_response("me", "broadcasts.admin")
        assert response.status_code == 403

    # For each request method testcase, ensure staff without users.admin fail
    @override_options({"staff.ga-rollout": True})
    def test_fails_without_users_admin_permission(self) -> None:
        staff_without_permission = self.create_user(is_staff=True)
        self.login_as(staff_without_permission, staff=True)

        # We are active staff but lack the users.admin permission
        response = self.get_response("me", "broadcasts.admin", status_code=403)
        assert response.status_code == 403


@control_silo_test
class UserPermissionDetailsGetTest(UserDetailsTest):
    method = "GET"

    @override_options({"staff.ga-rollout": False})
    def test_superuser_with_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")
        self.get_success_response("me", "broadcasts.admin", status_code=204)

    @override_options({"staff.ga-rollout": False})
    def test_superuser_without_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)
        self.get_error_response("me", "broadcasts.admin", status_code=404)

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission: MagicMock) -> None:
        self.login_as(self.staff_user, staff=True)
        self.add_user_permission(self.staff_user, "broadcasts.admin")

        self.get_success_response("me", "broadcasts.admin", status_code=204)
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_without_permission(self, mock_has_permission: MagicMock) -> None:
        self.login_as(self.staff_user, staff=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1


@control_silo_test
class UserPermissionDetailsPostTest(UserDetailsTest):
    method = "POST"

    @override_options({"staff.ga-rollout": False})
    def test_superuser_with_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)

        self.get_success_response("me", "broadcasts.admin", status_code=201)
        assert UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": False})
    def test_superuser_duplicate_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")

        self.get_error_response("me", "broadcasts.admin", status_code=410)
        assert UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission: MagicMock) -> None:
        self.login_as(self.staff_user, staff=True)

        self.get_success_response("me", "broadcasts.admin", status_code=201)
        assert UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_duplicate_permission(self, mock_has_permission: MagicMock) -> None:
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

    @override_options({"staff.ga-rollout": False})
    def test_superuser_with_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "broadcasts.admin")

        self.get_success_response("me", "broadcasts.admin", status_code=204)
        assert not UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": False})
    def test_superuser_without_permission(self) -> None:
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(self.superuser, superuser=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        assert not UserPermission.objects.filter(
            user=self.superuser, permission="broadcasts.admin"
        ).exists()

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_with_permission(self, mock_has_permission: MagicMock) -> None:
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
    def test_staff_without_permission(self, mock_has_permission: MagicMock) -> None:
        self.login_as(self.staff_user, staff=True)

        self.get_error_response("me", "broadcasts.admin", status_code=404)
        assert not UserPermission.objects.filter(
            user=self.staff_user, permission="broadcasts.admin"
        ).exists()
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1
