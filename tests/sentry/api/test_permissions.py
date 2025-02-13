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
    def test_safe_method(self):
        assert self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="GET"), None
        )
        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_unsafe_methods(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), None
            )

        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method=method), None
        )

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
    def test_safe_method_demo_mode_disabled(self):
        assert not self.user_permission.has_permission(
            self.make_request(self.readonly_user, method="GET"), None
        )
        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method="GET"), None
        )

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
    def test_unsafe_methods_demo_mode_disabled(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), None
            )

        assert self.user_permission.has_permission(
            self.make_request(self.normal_user, method=method), None
        )

        @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
        def test_determine_access(self):
            assert self.user_permission.determine_access(
                self.make_request(self.readonly_user, method="GET"), None
            )
            assert self.user_permission.determine_access(
                self.make_request(self.normal_user, method="GET"), None
            )

        @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
        def test_determine_access_disabled(self):
            assert not self.user_permission.determine_access(
                self.make_request(self.readonly_user, method="GET"), None
            )
            assert self.user_permission.determine_access(
                self.make_request(self.normal_user, method="GET"), None
            )

        @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
        def test_determine_access_superuser(self):
            assert not self.user_permission.determine_access(
                self.make_request(self.readonly_user, method="POST"), None
            )
            self.readonly_user.update(is_superuser=True)
            assert self.user_permission.determine_access(
                self.make_request(self.readonly_user, method="POST"), None
            )


class IsAuthenticatedPermissionsTest(DRFPermissionTestCase):
    user_permission = SentryIsAuthenticated()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user(id=1)
        self.readonly_user = self.create_user(id=2)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_has_permission(self):
        assert self.user_permission.has_permission(self.make_request(self.normal_user), None)
        assert not self.user_permission.has_permission(self.make_request(self.readonly_user), None)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_has_object_permission(self):
        assert self.user_permission.has_object_permission(
            self.make_request(self.normal_user), None, None
        )
        assert not self.user_permission.has_object_permission(
            self.make_request(self.readonly_user), None, None
        )
