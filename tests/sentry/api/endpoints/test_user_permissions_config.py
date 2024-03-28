from unittest.mock import patch

from sentry.api.permissions import StaffPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserPermissionsConfigGetTest(APITestCase):
    endpoint = "sentry-api-0-user-permissions-config"
    method = "GET"

    def test_superuser_lookup_self(self):
        self.superuser = self.create_user(is_superuser=True)
        self.login_as(user=self.superuser, superuser=True)

        self.add_user_permission(self.superuser, "users.admin")
        response = self.get_success_response("me", status_code=200)

        assert len(response.data) == 3
        assert "broadcasts.admin" in response.data
        assert "users.admin" in response.data
        assert "options.admin" in response.data

    @patch.object(StaffPermission, "has_permission", wraps=StaffPermission().has_permission)
    def test_staff_lookup_self(self, mock_has_permission):
        self.staff_user = self.create_user(is_staff=True)
        self.login_as(user=self.staff_user, staff=True)

        self.add_user_permission(self.staff_user, "users.admin")
        with override_options({"staff.user-email-allowlist": [self.staff_user.email]}):
            response = self.get_success_response("me", status_code=200)

        assert len(response.data) == 3
        assert "broadcasts.admin" in response.data
        assert "users.admin" in response.data
        assert "options.admin" in response.data
        # ensure we fail the scope check and call is_active_staff
        assert mock_has_permission.call_count == 1
