from rest_framework.request import Request

from sentry.api.permissions import (
    StaffPermission,
    SuperuserOrStaffFeatureFlaggedPermission,
    SuperuserPermission,
)
from sentry.auth.staff import Staff
from sentry.auth.superuser import Superuser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class PermissionsTest(TestCase):
    def setUp(self):
        # self.user is superuser and staff user by default
        self.request: Request = self.make_request(user=self.user)  # type: ignore
        self.request.superuser = Superuser(self.request)
        self.request.staff = Staff(self.request)  # type: ignore[attr-defined]
        self.login_as(self.user)

    def _activate_superuser(self):
        self.request.superuser.uid = str(self.user.id)
        self.request.superuser._is_active = True

    def _activate_staff(self):
        self.request.staff.uid = str(self.user.id)
        self.request.staff._is_active = True

    def test_superuser_permission(self):
        self._activate_superuser()
        assert SuperuserPermission().has_permission(self.request, None)

    def test_staff_permission(self):
        self._activate_staff()
        assert StaffPermission().has_permission(self.request, None)

    @with_feature("auth:enterprise-staff-cookie")
    def test_superuser_or_staff_feature_flagged_permission_active_flag(self):
        # With active superuser
        self._activate_superuser()
        assert not SuperuserOrStaffFeatureFlaggedPermission().has_permission(self.request, None)

        # With active staff
        self._activate_staff()
        assert SuperuserOrStaffFeatureFlaggedPermission().has_permission(self.request, None)

    def test_superuser_or_staff_feature_flagged_permission_inactive_flag(self):
        # With active staff
        self._activate_staff()
        assert not SuperuserOrStaffFeatureFlaggedPermission().has_permission(self.request, None)

        # With active superuser
        self._activate_superuser()
        assert SuperuserOrStaffFeatureFlaggedPermission().has_permission(self.request, None)
