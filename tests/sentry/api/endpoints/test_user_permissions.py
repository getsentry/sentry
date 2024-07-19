from unittest.mock import patch

from sentry.api.permissions import StaffPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


class UserPermissionsTest(APITestCase):
    endpoint = "sentry-api-0-user-permissions"


@control_silo_test
class UserPermissionsGetTest(UserPermissionsTest):
    method = "GET"

    def test_superuser_lookup_self(self):
        self.superuser = self.create_user(is_superuser=True)
        self.login_as(user=self.superuser, superuser=True)

        self.add_user_permission(self.superuser, "users.admin")
        self.add_user_permission(self.superuser, "broadcasts.admin")
        response = self.get_success_response("me", status_code=200)

        assert len(response.data) == 2
        assert "broadcasts.admin" in response.data
        assert "users.admin" in response.data

    @override_options({"staff.ga-rollout": True})
    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_lookup_self(self, mock_has_permission):
        staff_user = self.create_user(is_staff=True)
        self.login_as(staff_user, staff=True)

        self.add_user_permission(staff_user, "users.admin")
        self.add_user_permission(staff_user, "broadcasts.admin")
        response = self.get_success_response("me")

        assert len(response.data) == 2
        assert "broadcasts.admin" in response.data
        assert "users.admin" in response.data
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1
