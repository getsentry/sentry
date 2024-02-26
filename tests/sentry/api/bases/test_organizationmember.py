from unittest import mock

from sentry.api.bases.organizationmember import MemberAndStaffPermission, MemberPermission
from sentry.auth.staff import is_active_staff
from sentry.testutils.silo import region_silo_test
from tests.sentry.api.bases.test_organization import PermissionBaseTestCase


@region_silo_test
class MemberPermissionTest(PermissionBaseTestCase):
    def setUp(self):
        super().setUp()
        self.permission_cls = MemberPermission

    def test_user_not_in_org(self):
        random_user = self.create_user()
        assert not self.has_object_perm("GET", self.org, user=random_user)
        assert not self.has_object_perm("PUT", self.org, user=random_user)
        assert not self.has_object_perm("POST", self.org, user=random_user)
        assert not self.has_object_perm("DELETE", self.org, user=random_user)

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("PUT", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("POST", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("DELETE", self.org, user=superuser, is_superuser=True)

    def test_org_member(self):
        member_user = self.create_user()
        self.create_member(user=member_user, organization=self.org, role="member")
        assert self.has_object_perm("GET", self.org, user=member_user)
        assert not self.has_object_perm("PUT", self.org, user=member_user)
        assert not self.has_object_perm("POST", self.org, user=member_user)
        assert not self.has_object_perm("DELETE", self.org, user=member_user)

    def test_org_admin(self):
        admin_user = self.create_user()
        self.create_member(user=admin_user, organization=self.org, role="admin")
        assert self.has_object_perm("GET", self.org, user=admin_user)
        assert not self.has_object_perm("PUT", self.org, user=admin_user)
        assert not self.has_object_perm("POST", self.org, user=admin_user)
        assert not self.has_object_perm("DELETE", self.org, user=admin_user)

    def test_org_manager(self):
        manager_user = self.create_user()
        self.create_member(user=manager_user, organization=self.org, role="manager")
        assert self.has_object_perm("GET", self.org, user=manager_user)
        assert self.has_object_perm("PUT", self.org, user=manager_user)
        assert self.has_object_perm("POST", self.org, user=manager_user)
        assert self.has_object_perm("DELETE", self.org, user=manager_user)

    def test_org_owner(self):
        owner_user = self.create_user()
        self.create_member(user=owner_user, organization=self.org, role="owner")
        assert self.has_object_perm("GET", self.org, user=owner_user)
        assert self.has_object_perm("PUT", self.org, user=owner_user)
        assert self.has_object_perm("POST", self.org, user=owner_user)
        assert self.has_object_perm("DELETE", self.org, user=owner_user)


@region_silo_test
class OrganizationAndStaffPermissionTest(PermissionBaseTestCase):
    def setUp(self):
        super().setUp()
        self.permission_cls = MemberAndStaffPermission

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("PUT", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("POST", self.org, user=superuser, is_superuser=True)
        assert self.has_object_perm("DELETE", self.org, user=superuser, is_superuser=True)

    @mock.patch("sentry.api.permissions.is_active_staff", wraps=is_active_staff)
    def test_staff(self, mock_is_active_staff):
        staff_user = self.create_user(is_staff=True)

        assert self.has_object_perm("GET", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("PUT", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("POST", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("DELETE", self.org, user=staff_user, is_staff=True)
        # ensure we fail the scope check and call is_active_staff
        assert mock_is_active_staff.call_count == 12
