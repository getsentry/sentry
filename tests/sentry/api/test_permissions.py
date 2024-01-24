from rest_framework.request import Request

from sentry.api.permissions import (
    StaffPermission,
    SuperuserOrStaffFeatureFlaggedPermission,
    SuperuserPermission,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class PermissionsTest(TestCase):
    def setUp(self):
        self.superuser_request: Request = self.make_request(user=self.user, is_superuser=True)  # type: ignore
        self.staff_request: Request = self.make_request(user=self.user, is_staff=True)  # type: ignore

    def test_superuser_permission(self):
        assert SuperuserPermission().has_permission(self.superuser_request, None)

    def test_staff_permission(self):
        assert StaffPermission().has_permission(self.staff_request, None)

    @with_feature("auth:enterprise-staff-cookie")
    def test_superuser_or_staff_feature_flagged_permission_active_flag(self):
        # With active superuser
        assert not SuperuserOrStaffFeatureFlaggedPermission().has_permission(
            self.superuser_request, None
        )

        # With active staff
        assert SuperuserOrStaffFeatureFlaggedPermission().has_permission(self.staff_request, None)

    def test_superuser_or_staff_feature_flagged_permission_inactive_flag(self):
        # With active staff
        assert not SuperuserOrStaffFeatureFlaggedPermission().has_permission(
            self.staff_request, None
        )

        # With active superuser
        assert SuperuserOrStaffFeatureFlaggedPermission().has_permission(
            self.superuser_request, None
        )
