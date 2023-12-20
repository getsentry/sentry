from sentry.api.bases.project import ProjectPermission
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


class ProjectPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)
        super().setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = ProjectPermission()
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        return perm.has_permission(request, None) and perm.has_object_permission(request, None, obj)


@region_silo_test
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
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="member", teams=[team])
        # if `allow_joinleave` is True, members should be able to GET a project even if
        # it has no teams
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self):
        team = self.create_team(organization=self.org)
        project = self.create_project(organization=self.org, teams=[team])
        user = self.create_user(is_superuser=False)
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(team, member, role="admin")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_admin_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="admin", teams=[team])
        # if `allow_joinleave` is True, admins can act on teams
        # they don't have access to
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_if_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_owner_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_if_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
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
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:write"])
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
            slug=sentry_app.slug, organization=self.org, user=self.user
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


@region_silo_test
class ProjectPermissionNoJoinLeaveTest(ProjectPermissionBase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)

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
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="member", teams=[team])
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_member_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role(self):
        team = self.create_team(organization=self.org)
        project = self.create_project(organization=self.org, teams=[team])
        user = self.create_user(is_superuser=False)
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(team, member, role="admin")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_admin_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="admin", teams=[team])
        # if `allow_joinleave` is False, admins can't act on teams that
        # they don't have access to
        assert not self.has_object_perm("GET", self.project, user=user)
        assert not self.has_object_perm("POST", self.project, user=user)
        assert not self.has_object_perm("PUT", self.project, user=user)
        assert not self.has_object_perm("DELETE", self.project, user=user)

    def test_admin_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_manager_if_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="manager")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_owner_without_team_membership(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner", teams=[team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_with_team_membership(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.project, user=user)
        assert self.has_object_perm("POST", self.project, user=user)
        assert self.has_object_perm("PUT", self.project, user=user)
        assert self.has_object_perm("DELETE", self.project, user=user)

    def test_owner_if_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.org, role="owner")
        assert self.has_object_perm("GET", project, user=user)
        assert self.has_object_perm("POST", project, user=user)
        assert self.has_object_perm("PUT", project, user=user)
        assert self.has_object_perm("DELETE", project, user=user)

    def test_api_key_with_org_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
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
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.project, auth=key)
        assert not self.has_object_perm("POST", self.project, auth=key)
        assert not self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = self.create_api_key(organization=self.org, scope_list=["project:write"])
        assert self.has_object_perm("GET", self.project, auth=key)
        assert self.has_object_perm("POST", self.project, auth=key)
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert not self.has_object_perm("DELETE", self.project, auth=key)
