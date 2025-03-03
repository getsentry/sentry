from sentry.api.bases.organizationmember import MemberAndStaffPermission, MemberPermission
from sentry.api.permissions import SentryPermission
from tests.sentry.api.bases.test_organization import PermissionBaseTestCase


class MemberPermissionTest(PermissionBaseTestCase):
    def setUp(self):
        super().setUp()
        self.permission_cls: type[SentryPermission] = MemberPermission

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
        assert not self.has_object_perm("DELETE", self.org, user=member_user)

        self.org.flags.disable_member_invite = False
        self.org.save()
        assert self.has_object_perm("POST", self.org, user=member_user)

        self.org.flags.disable_member_invite = True
        self.org.save()
        assert not self.has_object_perm("POST", self.org, user=member_user)

    def test_org_admin(self):
        admin_user = self.create_user()
        self.create_member(user=admin_user, organization=self.org, role="admin")
        assert self.has_object_perm("GET", self.org, user=admin_user)
        assert not self.has_object_perm("PUT", self.org, user=admin_user)
        assert not self.has_object_perm("DELETE", self.org, user=admin_user)

        self.org.flags.disable_member_invite = False
        self.org.save()
        assert self.has_object_perm("POST", self.org, user=admin_user)

        self.org.flags.disable_member_invite = True
        self.org.save()
        assert not self.has_object_perm("POST", self.org, user=admin_user)

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

    def test_staff(self):
        staff_user = self.create_user(is_staff=True)

        assert self.has_object_perm("GET", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("PUT", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("POST", self.org, user=staff_user, is_staff=True)
        assert self.has_object_perm("DELETE", self.org, user=staff_user, is_staff=True)
