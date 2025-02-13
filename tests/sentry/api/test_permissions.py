from sentry.api.permissions import (
    ReadOnlyPermission,
    SentryIsAuthenticated,
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


class ReadonlyPermissionsTest(DRFPermissionTestCase):
    user_permission = ReadOnlyPermission()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user(id=1)
        self.readonly_user = self.create_user(id=2)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_readonly_user_has_permission(self):
        assert self.user_permission.has_permission(self.make_request(self.readonly_user), None)

    def test_readonly_user_has_object_permission(self):
        assert not self.user_permission.has_object_permission(
            self.make_request(self.readonly_user), None, None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_get_method(self):
        assert self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="GET"), None
        )
        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_post_method(self):
        assert not self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="POST"), None
        )

        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_put_method(self):
        assert not self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="PUT"), None
        )

        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_delete_method(self):
        assert not self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="DELETE"), None
        )

        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )


class IsAuthenticatedPermissionsTest(DRFPermissionTestCase):
    user_permission = SentryIsAuthenticated()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user(id=1)
        self.readonly_user = self.create_user(id=2)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_normal_user_has_permission(self):
        assert self.user_permission.has_permission(self.make_request(self.normal_user), None)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_readonly_user_has_no_permission(self):
        assert not self.user_permission.has_permission(self.make_request(self.readonly_user), None)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_normal_user_has_object_permission(self):
        assert self.user_permission.has_object_permission(
            self.make_request(self.normal_user), None, None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_readonly_user_has_no_object_permission(self):
        assert not self.user_permission.has_object_permission(
            self.make_request(self.readonly_user), None, None
        )
