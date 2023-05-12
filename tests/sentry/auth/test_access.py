from unittest.mock import Mock

from django.contrib.auth.models import AnonymousUser

from sentry.auth import access
from sentry.auth.access import Access, NoAccess
from sentry.models import (
    ApiKey,
    AuthIdentity,
    AuthProvider,
    ObjectStatus,
    Organization,
    TeamStatus,
    User,
    UserPermission,
    UserRole,
)
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import all_silo_test, exempt_from_silo_limits, no_silo_test


def silo_from_user(
    user,
    organization=None,
    scopes=None,
    is_superuser=False,
) -> Access:
    rpc_user_org_context = None
    if organization:
        rpc_user_org_context = organization_service.get_organization_by_id(
            id=organization.id, user_id=user.id
        )
    return access.from_user_and_rpc_user_org_context(
        user=user,
        rpc_user_org_context=rpc_user_org_context,
        is_superuser=is_superuser,
        scopes=scopes,
    )


def silo_from_request(request, organization: Organization = None, scopes=None) -> Access:
    rpc_user_org_context = None
    if organization:
        rpc_user_org_context = organization_service.get_organization_by_id(
            id=organization.id, user_id=request.user.id
        )
    return access.from_request_org_and_scopes(
        request=request, rpc_user_org_context=rpc_user_org_context, scopes=scopes
    )


class AccessFactoryTestCase(TestCase):
    def from_user(self, *args, **kwds):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return access.from_user(*args, **kwds)
        return silo_from_user(*args, **kwds)

    def from_request(self, *args, **kwds):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return access.from_request(*args, **kwds)
        return silo_from_request(*args, **kwds)

    @exempt_from_silo_limits()
    def create_api_key(self, organization: Organization, **kwds):
        return ApiKey.objects.create(organization_id=organization.id, **kwds)

    @exempt_from_silo_limits()
    def create_auth_provider(self, organization: Organization, **kwds):
        return AuthProvider.objects.create(organization_id=organization.id, **kwds)

    @exempt_from_silo_limits()
    def create_auth_identity(self, auth_provider: AuthProvider, user: User, **kwds):
        return AuthIdentity.objects.create(auth_provider=auth_provider, user=user, **kwds)


@all_silo_test(stable=True)
class FromUserTest(AccessFactoryTestCase):
    def test_no_access(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        user = self.create_user()

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert not result.sso_is_valid
            assert not result.requires_sso
            assert not result.scopes
            assert not result.has_team_access(team)
            assert not result.has_team_scope(team, "project:read")
            assert not result.has_project_access(project)
            assert not result.has_projects_access([project])
            assert not result.has_project_scope(project, "project:read")
            assert not result.has_project_membership(project)
            assert not result.permissions

    def test_no_deleted_projects(self):
        user = self.create_user()
        organization = self.create_organization(owner=self.user)

        team = self.create_team(organization=organization)
        self.create_member(organization=organization, user=user, role="owner", teams=[team])
        deleted_project = self.create_project(
            organization=organization, status=ObjectStatus.PENDING_DELETION, teams=[team]
        )

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.has_project_access(deleted_project) is False
            assert result.has_project_membership(deleted_project) is False
            assert len(result.project_ids_with_team_membership) == 0

    def test_no_deleted_teams(self):
        user = self.create_user()
        organization = self.create_organization(owner=self.user)

        team = self.create_team(organization=organization)
        deleted_team = self.create_team(
            organization=organization, status=TeamStatus.PENDING_DELETION
        )
        self.create_member(
            organization=organization, user=user, role="owner", teams=[team, deleted_team]
        )

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.has_team_access(team) is True
            assert result.has_team_access(deleted_team) is False
            assert result.team_ids_with_membership == frozenset({team.id})

    def test_unique_projects(self):
        user = self.create_user()
        organization = self.create_organization(owner=self.user)

        team = self.create_team(organization=organization)
        other_team = self.create_team(organization=organization)
        self.create_member(
            organization=organization, user=user, role="owner", teams=[team, other_team]
        )
        project = self.create_project(organization=organization, teams=[team, other_team])

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.has_project_access(project)
            assert len(result.project_ids_with_team_membership) == 1

    def test_mixed_access(self):
        user = self.create_user()
        organization = self.create_organization(flags=0)  # disable default allow_joinleave
        team = self.create_team(organization=organization)
        team_no_access = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        project_no_access = self.create_project(organization=organization, teams=[team_no_access])
        self.create_member(organization=organization, user=user, teams=[team])
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.has_project_access(project)
            assert not result.has_project_access(project_no_access)
            assert not result.has_projects_access([project, project_no_access])

    def test_owner_all_teams(self):
        user = self.create_user()
        organization = self.create_organization(owner=self.user)
        member = self.create_member(organization=organization, user=user, role="owner")
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.sso_is_valid
            assert not result.requires_sso
            assert result.scopes == member.get_scopes()
            assert result.has_team_access(team)
            assert result.has_team_scope(team, "project:read")
            assert result.has_project_access(project)
            assert result.has_projects_access([project])
            assert result.has_project_scope(project, "project:read")
            assert result.has_any_project_scope(project, ["project:read", "project:admin"])

            # owners should have access but not membership
            assert result.has_project_membership(project) is False

    def test_member_no_teams_closed_membership(self):
        user = self.create_user()
        organization = self.create_organization(
            owner=self.user, flags=0  # disable default allow_joinleave
        )
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.sso_is_valid
            assert not result.requires_sso
            assert result.scopes == member.get_scopes()
            assert not result.has_team_access(team)
            assert not result.has_team_scope(team, "project:read")
            assert not result.has_project_access(project)
            assert not result.has_projects_access([project])
            assert not result.has_project_scope(project, "project:read")
            assert not result.has_any_project_scope(project, ["project:read", "project:admin"])
            assert not result.has_project_membership(project)

    def test_member_no_teams_open_membership(self):
        user = self.create_user()
        organization = self.create_organization(
            owner=self.user, flags=Organization.flags.allow_joinleave
        )
        member = self.create_member(organization=organization, user=user, role="member", teams=())
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.sso_is_valid
            assert not result.requires_sso
            assert result.scopes == member.get_scopes()
            assert result.has_team_access(team)
            assert result.has_team_scope(team, "project:read")
            assert result.has_project_access(project)
            assert result.has_projects_access([project])
            assert result.has_project_scope(project, "project:read")
            assert not result.has_project_scope(project, "project:write")
            assert result.has_any_project_scope(project, ["project:read", "project:write"])
            assert not result.has_any_project_scope(project, ["project:write", "project:admin"])
            assert not result.has_project_membership(project)

    def test_team_restricted_org_member_access(self):
        user = self.create_user()
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        member = self.create_member(organization=organization, user=user, teams=[team])
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.sso_is_valid
            assert not result.requires_sso
            assert result.scopes == member.get_scopes()
            assert result.has_team_access(team)
            assert result.has_team_scope(team, "project:read")
            assert result.has_project_access(project)
            assert result.has_projects_access([project])
            assert result.has_project_scope(project, "project:read")
            assert not result.has_project_scope(project, "project:write")
            assert result.has_any_project_scope(project, ["project:read", "project:write"])
            assert not result.has_any_project_scope(project, ["project:write", "project:admin"])
            assert result.has_project_membership(project)

    @with_feature("organizations:team-roles")
    def test_has_project_scope_from_team_role(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        team_other = self.create_team(organization=organization)
        project_other = self.create_project(organization=organization, teams=[team_other])

        # Team Contributor
        user = self.create_user()
        member = self.create_member(organization=organization, user=user)
        self.create_team_membership(team, member, role="contributor")

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            # Does not have scopes from org-role
            assert not result.has_scope("team:admin")
            assert not result.has_scope("team:write")
            assert not result.has_scope("project:admin")
            assert not result.has_scope("project:write")

            # Has scopes from team-role
            assert not result.has_team_scope(team, "team:admin")
            assert not result.has_team_scope(team, "team:write")
            assert result.has_team_scope(team, "team:read")
            assert not result.has_project_scope(project, "project:admin")
            assert not result.has_project_scope(project, "project:write")
            assert result.has_project_scope(project, "project:read")

        # Team Admin
        user = self.create_user()
        member = self.create_member(organization=organization, user=user)
        self.create_team_membership(team, member, role="admin")

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]
        for result in results:
            # Does not have scopes from org-role
            assert not result.has_scope("team:admin")
            assert not result.has_scope("team:write")
            assert not result.has_scope("project:admin")
            assert not result.has_scope("project:write")

            # Has scopes from team-role
            assert result.has_team_scope(team, "team:admin")
            assert result.has_team_scope(team, "team:write")
            assert result.has_team_scope(team, "team:read")
            assert result.has_project_scope(project, "project:admin")
            assert result.has_project_scope(project, "project:write")
            assert result.has_project_scope(project, "project:read")

            # Does not have scope from other team
            assert not result.has_team_scope(team_other, "team:admin")
            assert not result.has_team_scope(team_other, "team:write")
            assert result.has_team_scope(team_other, "team:read")
            assert not result.has_project_scope(project_other, "project:admin")
            assert not result.has_project_scope(project_other, "project:write")
            assert result.has_project_scope(project_other, "project:read")

    def test_get_organization_roles_from_teams(self):
        user = self.create_user()
        organization = self.create_organization()
        owner_team = self.create_team(organization=organization, org_role="owner")
        admin_team = self.create_team(organization=organization, org_role="admin")
        self.create_member(organization=organization, user=user, teams=[owner_team, admin_team])

        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert "owner" in result.roles
            assert "member" in result.roles
            assert "admin" in result.roles

    def test_unlinked_sso(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        ap = self.create_auth_provider(organization=organization, provider="dummy")
        self.create_auth_identity(auth_provider=ap, user=user)
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert not result.sso_is_valid
            assert result.requires_sso

    def test_unlinked_sso_with_owner_from_team(self):
        organization = self.create_organization()
        ap = self.create_auth_provider(organization=organization, provider="dummy")
        user = self.create_user()
        owner_team = self.create_team(organization=organization)
        self.create_member(organization=organization, user=user, teams=[owner_team])
        self.create_auth_identity(auth_provider=ap, user=user)
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert not result.sso_is_valid
            assert result.requires_sso

    def test_unlinked_sso_with_no_owners(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        self.create_auth_provider(organization=organization, provider="dummy")
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert not result.sso_is_valid
            assert not result.requires_sso

    def test_sso_without_link_requirement(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        self.create_auth_provider(
            organization=organization, provider="dummy", flags=AuthProvider.flags.allow_unlinked
        )
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result.sso_is_valid
            assert not result.requires_sso

    def test_anonymous_user(self):
        user = self.create_user()
        anon_user = AnonymousUser()
        organization = self.create_organization(owner=user)
        # TODO: make test work with from_request
        result = self.from_user(anon_user, organization)
        assert result is access.DEFAULT

    def test_inactive_user(self):
        user = self.create_user(is_active=False)
        organization = self.create_organization(owner=user)
        request = self.make_request(user=user)
        results = [self.from_user(user, organization), self.from_request(request, organization)]

        for result in results:
            assert result is access.DEFAULT

    def test_superuser_permissions(self):
        user = self.create_user(is_superuser=True)
        with exempt_from_silo_limits():
            UserPermission.objects.create(user=user, permission="test.permission")

        result = self.from_user(user)
        assert not result.has_permission("test.permission")

        result = self.from_user(user, is_superuser=True)
        assert result.has_permission("test.permission")

    @with_feature("organizations:team-roles")
    def test_enforce_upper_bound_scope(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        team_other = self.create_team(organization=organization)
        project_other = self.create_project(organization=organization, teams=[team_other])

        # Team Admin
        user = self.create_user()
        member = self.create_member(organization=organization, user=user)
        self.create_team_membership(team, member, role="admin")

        request = self.make_request(user=user)

        results = [
            self.from_user(user, organization, scopes=["org:read", "team:admin"]),
            self.from_request(request, organization, scopes=["org:read", "team:admin"]),
        ]
        for result in results:
            # Does not have scopes from org-role
            assert not result.has_scope("org:admin")
            assert not result.has_scope("org:write")
            assert result.has_scope("org:read")
            assert not result.has_scope("team:admin")  # Org-member do not have team:admin scope
            assert not result.has_scope("team:read")
            assert not result.has_scope("team:write")
            assert not result.has_scope("project:admin")
            assert not result.has_scope("project:write")
            assert not result.has_scope("project:read")

            # Has scopes from team-role
            assert result.has_team_scope(team, "team:admin")  # From being a team-admin
            assert not result.has_team_scope(team, "team:write")
            assert not result.has_team_scope(team, "team:read")
            assert not result.has_project_scope(project, "project:admin")
            assert not result.has_project_scope(project, "project:write")
            assert not result.has_project_scope(project, "project:read")

            # Does not have scope from other team
            assert not result.has_team_scope(team_other, "team:admin")
            assert not result.has_team_scope(team_other, "team:write")
            assert not result.has_team_scope(team_other, "team:read")
            assert not result.has_project_scope(project_other, "project:admin")
            assert not result.has_project_scope(project_other, "project:write")
            assert not result.has_project_scope(project_other, "project:read")


@all_silo_test(stable=True)
class FromRequestTest(AccessFactoryTestCase):
    def setUp(self) -> None:
        self.superuser = self.create_user(is_superuser=True)
        UserPermission.objects.create(user=self.superuser, permission="test.permission")

        self.org = self.create_organization()
        AuthProvider.objects.create(organization_id=self.org.id)

        self.team1 = self.create_team(organization=self.org)
        self.project1 = self.create_project(organization=self.org, teams=[self.team1])
        self.team2 = self.create_team(organization=self.org)
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])

        super().setUp()

    def test_superuser(self):
        request = self.make_request(user=self.superuser, is_superuser=False)
        result = self.from_request(request)
        assert not result.has_permission("test.permission")

        request = self.make_request(user=self.superuser, is_superuser=True)
        result = self.from_request(request)
        assert result.has_permission("test.permission")

    def test_superuser_in_organization(self):
        self.create_member(
            user=self.superuser, organization=self.org, role="admin", teams=[self.team1]
        )

        def assert_memberships(result: Access) -> None:
            assert result.role == "admin"

            assert result.team_ids_with_membership == frozenset({self.team1.id})
            assert result.has_team_access(self.team1)
            assert result.project_ids_with_team_membership == frozenset({self.project1.id})
            assert result.has_project_access(self.project1)
            assert result.has_project_membership(self.project1)
            assert not result.has_project_membership(self.project2)

            # Even if not superuser, still has these because of role.is_global
            assert result.has_global_access
            assert result.has_team_access(self.team2)
            assert result.has_project_access(self.project2)

        request = self.make_request(self.superuser, is_superuser=False)
        result = self.from_request(request, self.org)
        assert_memberships(result)
        assert not result.has_permission("test.permission")

        request = self.make_request(user=self.superuser, is_superuser=True)
        result = self.from_request(request, self.org)
        assert_memberships(result)
        assert result.has_permission("test.permission")
        assert result.requires_sso
        assert not result.sso_is_valid

    def test_superuser_with_organization_without_membership(self):
        request = self.make_request(user=self.superuser, is_superuser=True)
        result = self.from_request(request, self.org)
        assert result.has_permission("test.permission")

        assert not result.requires_sso
        assert result.sso_is_valid
        assert result.team_ids_with_membership == frozenset()
        assert result.has_team_access(self.team1)
        assert result.project_ids_with_team_membership == frozenset()
        assert result.has_project_access(self.project1)

    def test_member_role_in_organization_closed_membership(self):
        # disable default allow_joinleave
        with exempt_from_silo_limits():
            self.org.update(flags=0)
        member_user = self.create_user(is_superuser=False)
        self.create_member(
            user=member_user, organization=self.org, role="member", teams=[self.team1]
        )

        request = self.make_request(member_user, is_superuser=False)
        result = self.from_request(request, self.org)

        assert result.role == "member"
        assert result.team_ids_with_membership == frozenset({self.team1.id})
        assert result.has_team_access(self.team1)
        assert result.project_ids_with_team_membership == frozenset({self.project1.id})
        assert result.has_project_access(self.project1)
        assert result.has_project_membership(self.project1)
        assert not result.has_project_membership(self.project2)

        # member_user should not have visibility to other teams or projects
        assert not result.has_global_access
        assert not result.has_team_access(self.team2)
        assert not result.has_project_access(self.project2)

    def test_member_role_in_organization_open_membership(self):
        with exempt_from_silo_limits():
            self.org.flags.allow_joinleave = True
            self.org.save()
        member_user = self.create_user(is_superuser=False)
        self.create_member(
            user=member_user, organization=self.org, role="member", teams=[self.team1]
        )

        request = self.make_request(member_user, is_superuser=False)
        result = self.from_request(request, self.org)

        assert result.role == "member"
        assert result.team_ids_with_membership == frozenset({self.team1.id})
        assert result.has_team_access(self.team1)
        assert result.project_ids_with_team_membership == frozenset({self.project1.id})
        assert result.has_project_access(self.project1)
        assert result.has_project_membership(self.project1)
        assert not result.has_project_membership(self.project2)

        # member_user should have visibility to other teams or projects
        assert result.has_global_access
        assert result.has_team_access(self.team2)
        assert result.has_project_access(self.project2)

    def test_with_valid_auth(self):
        user = self.create_user()
        organization = self.create_organization()

        member_team = self.create_team(organization=organization)
        member_project = self.create_project(organization=organization, teams=[member_team])
        non_member_team = self.create_team(organization=organization)
        non_member_project = self.create_project(organization=organization, teams=[non_member_team])
        self.create_member(user=user, organization=organization, role="admin", teams=[member_team])

        request = self.make_request()
        request.auth = self.create_api_key(organization=organization, allowed_origins="*")
        result = self.from_request(request, organization)

        assert result.team_ids_with_membership == frozenset({})
        assert result.has_team_access(member_team)
        assert result.has_team_access(non_member_team)
        assert result.project_ids_with_team_membership == frozenset({})
        assert result.has_project_access(member_project)
        assert result.has_project_access(non_member_project)
        assert result.has_project_membership(member_project) is False
        assert result.has_project_membership(non_member_project) is False
        assert result.has_global_access

    def test_with_invalid_auth(self):
        self.create_user()
        organization = self.create_organization()
        other_organization = self.create_organization()

        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])

        request = self.make_request()
        # Using an API key for another org should be invalid
        request.auth = self.create_api_key(organization=other_organization, allowed_origins="*")
        result = self.from_request(request, organization)

        assert result == NoAccess()

        assert result.team_ids_with_membership == frozenset({})
        assert result.has_team_access(team) is False
        assert result.project_ids_with_team_membership == frozenset({})
        assert result.has_project_access(project) is False
        assert result.has_project_membership(project) is False
        assert result.has_global_access is False


@all_silo_test(stable=True)
class FromSentryAppTest(AccessFactoryTestCase):
    def setUp(self):
        super().setUp()

        # Partner's normal Sentry account.
        self.user = self.create_user("integration@example.com")

        self.org = self.create_organization()
        self.org2 = self.create_organization()
        self.out_of_scope_org = self.create_organization()

        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org2)
        self.out_of_scope_team = self.create_team(organization=self.out_of_scope_org)

        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.out_of_scope_project = self.create_project(
            organization=self.out_of_scope_org, teams=[self.out_of_scope_team]
        )

        self.sentry_app = self.create_sentry_app(name="SlowDB", organization=self.org)
        self.out_of_scope_sentry_app = self.create_sentry_app(
            name="Other App", organization=self.out_of_scope_org
        )

        self.proxy_user = self.sentry_app.proxy_user
        self.out_of_scope_proxy_user = self.out_of_scope_sentry_app.proxy_user

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.install2 = self.create_sentry_app_installation(
            organization=self.org2, slug=self.sentry_app.slug, user=self.user
        )

    def test_has_access(self):
        request = self.make_request(user=self.proxy_user)
        result = self.from_request(request, self.org)
        assert result.has_global_access
        assert result.has_team_access(self.team)
        assert result.team_ids_with_membership == frozenset({self.team.id})
        assert result.scopes == frozenset()
        assert result.has_project_access(self.project)
        assert result.has_project_membership(self.project)
        assert not result.has_project_access(self.out_of_scope_project)
        assert not result.permissions

    def test_no_access_due_to_no_app(self):
        user = self.create_user("integration2@example.com")
        request = self.make_request(user=user)
        result = self.from_request(request, self.org)
        assert not result.has_team_access(self.team)
        assert not result.has_team_access(self.team2)
        assert not result.has_team_access(self.out_of_scope_team)
        assert not result.has_project_access(self.project)
        assert not result.has_project_access(self.out_of_scope_project)

    def test_no_access_due_to_no_installation_unowned(self):
        request = self.make_request(user=self.proxy_user)
        result = self.from_request(request, self.out_of_scope_org)
        assert not result.has_team_access(self.team)
        assert not result.has_team_access(self.team2)
        assert not result.has_team_access(self.out_of_scope_team)
        assert not result.has_project_access(self.project)
        assert not result.has_project_access(self.out_of_scope_project)

    def test_no_access_due_to_no_installation_owned(self):
        request = self.make_request(user=self.out_of_scope_proxy_user)
        result = self.from_request(request, self.out_of_scope_org)
        assert not result.has_team_access(self.team)
        assert not result.has_team_access(self.team2)
        assert not result.has_team_access(self.out_of_scope_team)
        assert not result.has_project_access(self.project)
        assert not result.has_project_access(self.out_of_scope_project)

    def test_no_access_due_to_invalid_user(self):
        request = self.make_request(user=self.out_of_scope_proxy_user)
        result = self.from_request(request, self.org)
        assert not result.has_team_access(self.team)
        assert not result.has_team_access(self.team2)
        assert not result.has_team_access(self.out_of_scope_team)
        assert not result.has_project_access(self.project)
        assert not result.has_project_access(self.out_of_scope_project)

    def test_no_deleted_projects(self):
        self.create_member(organization=self.org, user=self.user, role="owner", teams=[self.team])
        deleted_project = self.create_project(
            organization=self.org, status=ObjectStatus.PENDING_DELETION, teams=[self.team]
        )
        request = self.make_request(user=self.proxy_user)
        result = self.from_request(request, self.org)
        assert result.has_project_access(deleted_project) is False
        assert result.has_project_membership(deleted_project) is False

    def test_no_deleted_teams(self):
        deleted_team = self.create_team(organization=self.org, status=TeamStatus.PENDING_DELETION)
        self.create_member(
            organization=self.org, user=self.user, role="owner", teams=[self.team, deleted_team]
        )
        request = self.make_request(user=self.proxy_user)
        result = self.from_request(request, self.org)
        assert result.has_team_access(deleted_team) is False

    def test_has_app_scopes(self):
        app_with_scopes = self.create_sentry_app(name="ScopeyTheApp", organization=self.org)
        with exempt_from_silo_limits():
            app_with_scopes.update(scope_list=["team:read", "team:write"])
        self.create_sentry_app_installation(
            organization=self.org, slug=app_with_scopes.slug, user=self.user
        )

        request = self.make_request(user=app_with_scopes.proxy_user)
        result = self.from_request(request, self.org)
        assert result.scopes == frozenset({"team:read", "team:write"})
        assert result.has_scope("team:read") is True
        assert result.has_scope("team:write") is True
        assert result.has_scope("team:admin") is False


@no_silo_test(stable=True)
class DefaultAccessTest(TestCase):
    def test_no_access(self):
        result = access.DEFAULT
        assert result.sso_is_valid
        assert not result.scopes
        assert not result.has_team_access(Mock())
        assert not result.has_team_scope(Mock(), "project:read")
        assert not result.has_project_access(Mock())
        assert not result.has_projects_access([Mock()])
        assert not result.has_project_scope(Mock(), "project:read")
        assert not result.has_project_membership(Mock())
        assert not result.permissions


@no_silo_test(stable=True)
class SystemAccessTest(TestCase):
    def test_system_access(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        result = access.SystemAccess()
        assert not result.sso_is_valid
        assert not result.requires_sso
        assert result.has_project_access(project)
        assert result.has_any_project_scope(project, "project:read")
        assert not result.has_team_membership(team)
        assert result.has_scope("project:read")
        assert result.has_team_access(team)


@no_silo_test(stable=True)
class GetPermissionsForUserTest(TestCase):
    def test_combines_roles_and_perms(self):
        user = self.user

        UserPermission.objects.create(user=user, permission="test.permission")
        role = UserRole.objects.create(name="test.role", permissions=["test.permission-role"])
        role.users.add(user)

        assert sorted(access.get_permissions_for_user(user.id)) == sorted(
            ["test.permission", "test.permission-role"]
        )
