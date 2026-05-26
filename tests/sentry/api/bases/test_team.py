from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory
from rest_framework.views import APIView

from sentry.api.bases.team import TeamEndpoint, TeamPermission
from sentry.auth.access import from_request
from sentry.models.apitoken import ApiToken
from sentry.models.team import Team
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.requests import drf_request_from_request
from sentry.users.models.user import User
from sentry.viewer_context import ViewerContext, get_viewer_context, viewer_context_scope


class TeamPermissionBase(TestCase):
    def setUp(self) -> None:
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        super().setUp()

    def has_object_perm(
        self,
        method: str,
        obj: Team,
        auth: ApiToken | None = None,
        user: User | None = None,
        is_superuser: bool | None = None,
    ) -> bool:
        perm = TeamPermission()
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        drf_request = drf_request_from_request(request)
        return perm.has_permission(drf_request, APIView()) and perm.has_object_permission(
            drf_request, APIView(), obj
        )


class TeamEndpointViewerContextTest(TeamPermissionBase):
    def test_convert_args_enriches_viewer_context_with_organization(self) -> None:
        endpoint = TeamEndpoint()
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])
        raw_request = RequestFactory().get("/")
        raw_request.session = SessionBase()
        raw_request.user = self.user
        raw_request.auth = None
        raw_request.access = from_request(drf_request_from_request(raw_request), self.org)
        request = drf_request_from_request(raw_request)
        request._request.organization = None

        with viewer_context_scope(ViewerContext(user_id=self.user.id)):
            endpoint.convert_args(request, self.org.slug, self.team.slug)
            ctx = get_viewer_context()

        assert ctx is not None
        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.org.id


class TeamPermissionTest(TeamPermissionBase):
    def test_get_regular_user(self) -> None:
        user = self.create_user()
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_get_superuser(self) -> None:
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.team, user=user, is_superuser=True)

    def test_member_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_member_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self) -> None:
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(self.team, member, role="admin")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin")
        # if `allow_joinleave` is True, admins can act on teams
        # they don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_api_key_with_org_access(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_org_access(self) -> None:
        key = self.create_api_key(organization=self.create_organization(), scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_access(self) -> None:
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access_for_method(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["team:write"])
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert self.has_object_perm("POST", self.team, auth=key)
        assert self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)


class TeamPermissionNoJoinLeaveTest(TeamPermissionBase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)

    def test_get_regular_user(self) -> None:
        user = self.create_user()
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_get_superuser(self) -> None:
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("POST", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("PUT", self.team, user=user, is_superuser=True)
        assert self.has_object_perm("DELETE", self.team, user=user, is_superuser=True)

    def test_member_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_member_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    @with_feature("organizations:team-roles")
    def test_member_with_team_membership_and_team_role_admin(self) -> None:
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org, role="member")
        self.create_team_membership(self.team, member, role="admin")
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin")
        # if `allow_joinleave` is False, admins can't act on teams
        # they don't have access to
        assert not self.has_object_perm("GET", self.team, user=user)
        assert not self.has_object_perm("POST", self.team, user=user)
        assert not self.has_object_perm("PUT", self.team, user=user)
        assert not self.has_object_perm("DELETE", self.team, user=user)

    def test_admin_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="admin", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager")
        # managers should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_manager_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="manager", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_without_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner")
        # owners should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_owner_with_team_membership(self) -> None:
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="owner", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)
        assert self.has_object_perm("POST", self.team, user=user)
        assert self.has_object_perm("PUT", self.team, user=user)
        assert self.has_object_perm("DELETE", self.team, user=user)

    def test_api_key_with_org_access(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["team:read"])
        assert self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_org_access(self) -> None:
        key = self.create_api_key(organization=self.create_organization(), scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.team, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_without_access(self) -> None:
        key = self.create_api_key(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["project:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)
        assert not self.has_object_perm("POST", self.team, auth=key)
        assert not self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)

    def test_api_key_with_wrong_access_for_method(self) -> None:
        key = self.create_api_key(organization=self.org, scope_list=["team:write"])
        assert self.has_object_perm("PUT", self.project, auth=key)
        assert self.has_object_perm("POST", self.team, auth=key)
        assert self.has_object_perm("PUT", self.team, auth=key)
        assert not self.has_object_perm("DELETE", self.team, auth=key)
