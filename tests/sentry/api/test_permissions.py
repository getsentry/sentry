from rest_framework.views import APIView

from sentry.api.permissions import (
    DemoSafePermission,
    SentryIsAuthenticated,
    StaffPermission,
    SuperuserOrStaffFeatureFlaggedPermission,
    SuperuserPermission,
)
from sentry.demo_mode.utils import READONLY_SCOPES
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.helpers.options import override_options


class PermissionsTest(DRFPermissionTestCase):
    superuser_permission = SuperuserPermission()
    staff_permission = StaffPermission()
    superuser_staff_flagged_permission = SuperuserOrStaffFeatureFlaggedPermission()

    def test_superuser_permission(self):
        assert self.superuser_permission.has_permission(self.superuser_request, APIView())

    def test_staff_permission(self):
        assert self.staff_permission.has_permission(self.staff_request, APIView())

    @override_options({"staff.ga-rollout": True})
    def test_superuser_or_staff_feature_flagged_permission_active_option(self):
        # With active superuser
        assert not self.superuser_staff_flagged_permission.has_permission(
            self.superuser_request, APIView()
        )

        # With active staff
        assert self.superuser_staff_flagged_permission.has_permission(self.staff_request, APIView())

    def test_superuser_or_staff_feature_flagged_permission_inactive_option(self):
        # With active staff
        assert not self.superuser_staff_flagged_permission.has_permission(
            self.staff_request, APIView()
        )

        # With active superuser
        assert self.superuser_staff_flagged_permission.has_permission(
            self.superuser_request, APIView()
        )


class IsAuthenticatedPermissionsTest(DRFPermissionTestCase):
    user_permission = SentryIsAuthenticated()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user(id=1)
        self.readonly_user = self.create_user(id=2)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_has_permission(self):
        assert self.user_permission.has_permission(self.make_request(self.normal_user), APIView())
        assert not self.user_permission.has_permission(
            self.make_request(self.readonly_user), APIView()
        )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_has_object_permission(self):
        assert self.user_permission.has_object_permission(
            self.make_request(self.normal_user), APIView(), None
        )
        assert not self.user_permission.has_object_permission(
            self.make_request(self.readonly_user), APIView(), None
        )


class DemoSafePermissionsTest(DRFPermissionTestCase):
    user_permission = DemoSafePermission()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user(
            id=1,
        )
        self.readonly_user = self.create_user(id=2)
        self.organization = self.create_organization(owner=self.normal_user)
        self.org_member_scopes = self.create_member(
            organization_id=self.organization.id, user_id=self.readonly_user.id
        ).get_scopes()

    def _get_rpc_context(self, user):
        rpc_context = organization_service.get_organization_by_id(
            id=self.organization.id, user_id=user.id
        )

        assert rpc_context
        return rpc_context

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_safe_methods(self):
        for method in ("GET", "HEAD", "OPTIONS"):
            assert self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), APIView()
            )
            assert self.user_permission.has_permission(
                self.make_request(self.normal_user, method=method), APIView()
            )

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_unsafe_methods(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), APIView()
            )
            assert self.user_permission.has_permission(
                self.make_request(self.normal_user, method=method), APIView()
            )

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
    def test_safe_method_demo_mode_disabled(self):
        for method in ("GET", "HEAD", "OPTIONS"):
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), APIView()
            )
            assert self.user_permission.has_permission(
                self.make_request(self.normal_user, method=method), APIView()
            )

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
    def test_unsafe_methods_demo_mode_disabled(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user, method=method), APIView()
            )
            assert self.user_permission.has_permission(
                self.make_request(self.normal_user, method=method), APIView()
            )

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [2]})
    def test_determine_access_disabled(self):
        self.user_permission.determine_access(
            request=self.make_request(self.normal_user),
            organization=self._get_rpc_context(self.normal_user),
        )

        readonly_rpc_context = self._get_rpc_context(self.readonly_user)

        self.user_permission.determine_access(
            request=self.make_request(self.readonly_user),
            organization=readonly_rpc_context,
        )

        assert readonly_rpc_context.member.scopes == list(self.org_member_scopes)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [2]})
    def test_determine_access(self):
        self.user_permission.determine_access(
            request=self.make_request(self.normal_user),
            organization=self._get_rpc_context(self.normal_user),
        )

        readonly_rpc_context = self._get_rpc_context(self.readonly_user)

        self.user_permission.determine_access(
            request=self.make_request(self.readonly_user),
            organization=readonly_rpc_context,
        )

        assert readonly_rpc_context.member.scopes == sorted(READONLY_SCOPES)

    @override_options({"demo-mode.enabled": False, "demo-mode.users": []})
    def test_determine_access_no_demo_users(self):
        self.user_permission.determine_access(
            request=self.make_request(self.normal_user),
            organization=self._get_rpc_context(self.normal_user),
        )

        readonly_rpc_context = self._get_rpc_context(self.readonly_user)

        self.user_permission.determine_access(
            request=self.make_request(self.readonly_user),
            organization=readonly_rpc_context,
        )

        assert readonly_rpc_context.member.scopes == list(self.org_member_scopes)
