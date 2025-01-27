from sentry.api.bases.project import ProjectAndStaffPermission, ProjectPermission
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.requests import drf_request_from_request
from sentry.users.services.user.serial import serialize_rpc_user


class ProjectPermissionBase(TestCase):
    def setUp(self):
        super().setUp()
        self.permission_cls = ProjectPermission

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None, is_staff=None):
        perm = self.permission_cls()
        request = self.make_request(
            user=user, auth=auth, method=method, is_superuser=is_superuser, is_staff=is_staff
        )
        drf_request = drf_request_from_request(request)
        return perm.has_permission(drf_request, None) and perm.has_object_permission(
            drf_request, None, obj
        )


class ProjectPermissionTest(ProjectPermissionBase):
    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.project, user=user, is_superuser=True)

    def test_member_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[team])
        # if `allow_joinleave` is True, members should be able to GET a project even if
        # it has no teams
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self):
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])
        user = self.create_user(is_superuser=False)
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(team, member, role="admin")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_admin_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="admin", teams=[team])
        # if `allow_joinleave` is True, admins can act on teams
        # they don't have access to
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="admin", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="manager", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="manager", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_if_project_has_no_teams(self):
        project = self.create_project(organization=self.organization, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="manager")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_owner_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="owner", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="owner", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_if_project_has_no_teams(self):
        project = self.create_project(organization=self.organization, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="owner")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.organization, scope_list=["project:read"])
        assert self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_without_org_access(self):
        key = self.create_api_key(
            organization=self.create_organization(), scope_list=["project:read"]
        )
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_without_access(self):
        key = self.create_api_key(organization=self.organization)
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.organization, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.organization, scope_list=["project:write"])
        assert self.has_object_perm("GET", self.project, auth=key)
        assert self.has_object_perm("POST", self.project, auth=key)
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_project_no_team_sentry_app_installed(self):
        project = self.create_project(teams=[self.team])
        self.team.delete()
        other_org = self.create_organization()
        sentry_app = self.create_sentry_app(
            name="my_app",
            organization=other_org,
            scopes=("project:write",),
            webhook_url="http://example.com",
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        assert self.has_object_perm("GET", project, user=sentry_app.proxy_user)
        assert self.has_object_perm("POST", project, user=sentry_app.proxy_user)
        assert self.has_object_perm("PUT", project, user=sentry_app.proxy_user)
        assert not self.has_object_perm("DELETE", project, user=sentry_app.proxy_user)

    def test_project_no_team_sentry_app_not_installed(self):
        project = self.create_project(teams=[self.team])
        self.team.delete()
        other_org = self.create_organization()
        sentry_app = self.create_sentry_app(
            name="my_app",
            organization=other_org,
            scopes=("project:write",),
            webhook_url="http://example.com",
        )
        # install on other org
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=other_org, user=self.user
        )

        assert not self.has_object_perm("GET", project, user=sentry_app.proxy_user)
        assert not self.has_object_perm("POST", project, user=sentry_app.proxy_user)
        assert not self.has_object_perm("PUT", project, user=sentry_app.proxy_user)
        assert not self.has_object_perm("DELETE", project, user=sentry_app.proxy_user)


class ProjectPermissionNoJoinLeaveTest(ProjectPermissionBase):
    def setUp(self):
        super().setUp()
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization)

    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.project, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.project, user=user, is_superuser=True)

    def test_member_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[team])
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role(self):
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])
        user = self.create_user(is_superuser=False)
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(team, member, role="admin")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_admin_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="admin", teams=[team])
        # if `allow_joinleave` is False, admins can't act on teams that
        # they don't have access to
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="admin", teams=[self.team]
        )
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="manager", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="manager", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_if_project_has_no_teams(self):
        project = self.create_project(organization=self.organization, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="manager")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_owner_without_team_membership(self):
        team = self.create_team(organization=self.organization)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="owner", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="owner", teams=[self.team]
        )
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_if_project_has_no_teams(self):
        project = self.create_project(organization=self.organization, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="owner")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.organization, scope_list=["project:read"])
        assert self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_without_org_access(self):
        key = self.create_api_key(
            organization=self.create_organization(), scope_list=["project:read"]
        )
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_without_access(self):
        key = self.create_api_key(organization=self.organization)
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.organization, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.organization, scope_list=["project:write"])
        assert self.has_object_perm("GET", self.project, auth=key)
        assert self.has_object_perm("POST", self.project, auth=key)
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)


class ProjectAndStaffPermissionTest(ProjectPermissionBase):
    def setUp(self):
        super().setUp()
        self.permission_cls = ProjectAndStaffPermission

    def test_member_without_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member")
        # if `allow_joinleave` is True, members should be able to GET a project even if it has no teams
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        assert self.has_object_perm("GET", self.project, user=superuser, is_superuser=True)
        assert self.has_object_perm("POST", self.project, user=superuser, is_superuser=True)
        assert self.has_object_perm("PUT", self.project, user=superuser, is_superuser=True)
        assert self.has_object_perm("DELETE", self.project, user=superuser, is_superuser=True)

    def test_staff(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        assert self.has_object_perm("GET", self.project, user=staff_user, is_staff=True)
        assert self.has_object_perm("POST", self.project, user=staff_user, is_staff=True)
        assert self.has_object_perm("PUT", self.project, user=staff_user, is_staff=True)
        assert self.has_object_perm("DELETE", self.project, user=staff_user, is_staff=True)

    def test_staff_passes_2FA(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        request = self.make_request(user=serialize_rpc_user(staff_user), is_staff=True)
        drf_request = drf_request_from_request(request)
        permission = self.permission_cls()

        self.organization.flags.require_2fa = True
        self.organization.save()

        assert not permission.is_not_2fa_compliant(
            request=drf_request, organization=self.organization
        )
