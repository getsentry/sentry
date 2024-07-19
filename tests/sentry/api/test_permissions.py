from sentry.api.permissions import (
    StaffPermission,
    SuperuserOrStaffFeatureFlaggedPermission,
    SuperuserPermission,
)
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.helpers.options import override_options


class PermissionsTest(DRFPermissionTestCase):
    superuser_permission = SuperuserPermission()
    staff_permission = StaffPermission()
    superuser_staff_flagged_permission = SuperuserOrStaffFeatureFlaggedPermission()

    def test_superuser_permission(self):
        assert self.superuser_permission.has_permission(self.superuser_request, None)

    def test_staff_permission(self):
        assert self.staff_permission.has_permission(self.staff_request, None)

    @override_options({"staff.ga-rollout": True})
    def test_superuser_or_staff_feature_flagged_permission_active_option(self):
        # With active superuser
        assert not self.superuser_staff_flagged_permission.has_permission(
            self.superuser_request, None
        )

        # With active staff
        assert self.superuser_staff_flagged_permission.has_permission(self.staff_request, None)

    def test_superuser_or_staff_feature_flagged_permission_inactive_option(self):
        # With active staff
        assert not self.superuser_staff_flagged_permission.has_permission(self.staff_request, None)

        # With active superuser
        assert self.superuser_staff_flagged_permission.has_permission(self.superuser_request, None)
