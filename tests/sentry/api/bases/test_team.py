from sentry.api.bases.team import TeamPermission
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


class TeamPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        super().setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = TeamPermission()
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        return perm.has_permission(request, None) and perm.has_object_permission(request, None, obj)


@region_silo_test
class TeamPermissionTest(TeamPermissionBase):
    def test_get_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_get_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.team, user=user, is_superuser=True)

    def test_member_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self):
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(self.team, member, role="admin")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin")
        # if `allow_joinleave` is True, admins can act on teams
        # they don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_org_access(self):
        key = self.create_api_key(organization=self.create_organization(), scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_access(self):
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:write"])
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert self.has_object_perm("POST", self.team, auth=key)
        assert self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)


@region_silo_test
class TeamPermissionNoJoinLeaveTest(TeamPermissionBase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)

    def test_get_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_get_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.team, user=user, is_superuser=True)

    def test_member_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self):
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(self.team, member, role="admin")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin")
        # if `allow_joinleave` is False, admins can't act on teams
        # they don't have access to
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager")
        # managers should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner")
        # owners should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_org_access(self):
        key = self.create_api_key(organization=self.create_organization(), scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_access(self):
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:write"])
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert self.has_object_perm("POST", self.team, auth=key)
        assert self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)
