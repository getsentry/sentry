from datetime import timedelta
from functools import cached_property
from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.base import SessionBase
from django.db.models import F
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from sentry.api.bases.organization import (
    NoProjects,
    OrganizationAndStaffPermission,
    OrganizationEndpoint,
    OrganizationPermission,
)
from sentry.api.exceptions import (
    MemberDisabledOverLimit,
    ResourceDoesNotExist,
    SsoRequired,
    SuperuserRequired,
    TwoFactorRequired,
)
from sentry.api.permissions import SentryPermission
from sentry.api.utils import MAX_STATS_PERIOD
from sentry.auth.access import NoAccess, from_request
from sentry.auth.authenticators.totp import TotpInterface
from sentry.constants import ALL_ACCESS_PROJECTS_SLUG
from sentry.models.apikey import ApiKey
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.users.services.user.service import user_service


class MockSuperUser:
    @property
    def is_active(self):
        return True


class PermissionBaseTestCase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        # default to the organization permission class
        self.permission_cls: type[SentryPermission] = OrganizationPermission
        super().setUp()

    def has_object_perm(
        self,
        method,
        obj,
        auth=None,
        user=None,
        is_superuser=None,
        is_staff=None,
    ) -> bool:
        result_with_org_rpc = None
        result_with_org_context_rpc = None
        if isinstance(obj, Organization):
            organization_context = organization_service.get_organization_by_id(
                id=obj.id, user_id=user.id if user else None
            )
            assert organization_context is not None
            result_with_org_context_rpc = self.has_object_perm(
                method, organization_context, auth, user, is_superuser, is_staff
            )
            result_with_org_rpc = self.has_object_perm(
                method, organization_context.organization, auth, user, is_superuser, is_staff
            )
        perm = self.permission_cls()
        if user is not None:
            user = user_service.get_user(user.id)  # Replace with region silo APIUser

        request = self.make_request(
            user=user, auth=auth, method=method, is_superuser=is_superuser, is_staff=is_staff
        )
        drf_request = drf_request_from_request(request)
        result_with_obj = perm.has_permission(
            drf_request, APIView()
        ) and perm.has_object_permission(drf_request, APIView(), obj)
        if result_with_org_rpc is not None:
            return bool(result_with_obj and result_with_org_rpc and result_with_org_context_rpc)
        return result_with_obj


class OrganizationPermissionTest(PermissionBaseTestCase):
    def org_require_2fa(self):
        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        assert self.org.flags.require_2fa.is_set is True

    def test_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm("GET", self.org, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=user, is_superuser=True)

    def test_org_member(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")
        assert self.has_object_perm("GET", self.org, user=user)
        assert not self.has_object_perm("POST", self.org, user=user)

    def test_api_key_with_org_access(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(organization_id=self.org.id, scope_list=["org:read"])
        assert self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_without_org_access(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(
                organization_id=self.create_organization().id, scope_list=["org:read"]
            )
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_without_access(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(organization_id=self.org.id)
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(organization_id=self.org.id, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(organization_id=self.org.id, scope_list=["org:read"])
        assert not self.has_object_perm("PUT", self.org, auth=key)

    def test_org_requires_2fa_with_superuser(self):
        self.org_require_2fa()
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=user, is_superuser=True)

    def test_org_requires_2fa_with_enrolled_user(self):
        self.org_require_2fa()
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")

        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(user)
        assert self.has_object_perm("GET", self.org, user=user)

    def test_org_requires_2fa_with_unenrolled_user(self):
        self.org_require_2fa()
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")

        with pytest.raises(TwoFactorRequired):
            self.has_object_perm("GET", self.org, user=user)

    def test_org_requires_2fa_with_superuser_not_active(self):
        self.org_require_2fa()
        user = self.create_user(is_superuser=True)
        self.create_member(user=user, organization=self.org, role="member")
        with pytest.raises(SuperuserRequired):
            assert self.has_object_perm("GET", self.org, user=user)

    def test_member_limit_error(self):
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.org,
            role="member",
            flags=OrganizationMember.flags["member-limit:restricted"],
        )

        with pytest.raises(MemberDisabledOverLimit) as excinfo:
            self.has_object_perm("GET", self.org, user=user)

        assert excinfo.value.detail == {
            "detail": {
                "code": "member-disabled-over-limit",
                "message": "Organization over member limit",
                "extra": {"next": f"/organizations/{self.org.slug}/disabled-member/"},
            }
        }

    def test_member_limit_with_superuser(self):
        user = self.create_user(is_superuser=True)
        self.create_member(
            user=user,
            organization=self.org,
            role="member",
            flags=OrganizationMember.flags["member-limit:restricted"],
        )
        assert self.has_object_perm("GET", self.org, user=user, is_superuser=True)

    def test_member_limit_sentry_app(self):
        app = self.create_internal_integration(
            name="integration", organization=self.org, scopes=("org:admin",)
        )
        assert self.has_object_perm("GET", self.org, user=app.proxy_user)

    def test_sso_required(self):
        user = self.create_user()
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth_provider = AuthProvider.objects.create(
                organization_id=self.org.id, provider="dummy"
            )
            AuthIdentity.objects.create(auth_provider=auth_provider, user=user)
        self.create_member(user=user, organization=self.org, role="member")

        with pytest.raises(SsoRequired):
            assert self.has_object_perm("GET", self.org, user=user)
        with pytest.raises(SsoRequired):
            assert not self.has_object_perm("POST", self.org, user=user)


class OrganizationAndStaffPermissionTest(PermissionBaseTestCase):
    def setUp(self):
        super().setUp()
        self.permission_cls = OrganizationAndStaffPermission

    def test_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm("GET", self.org, user=user)

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=superuser, is_superuser=True)

    def test_staff(self):
        staff_user = self.create_user(is_staff=True)
        assert self.has_object_perm("GET", self.org, user=staff_user, is_staff=True)

    def test_staff_passes_2FA(self):
        staff_user = self.create_user(is_staff=True)
        request = self.make_request(user=serialize_rpc_user(staff_user), is_staff=True)
        drf_request = drf_request_from_request(request)
        permission = self.permission_cls()
        self.org.flags.require_2fa = True
        self.org.save()

        assert not permission.is_not_2fa_compliant(request=drf_request, organization=self.org)


class BaseOrganizationEndpointTest(TestCase):
    @cached_property
    def endpoint(self):
        return OrganizationEndpoint()

    @cached_property
    def user(self):
        return self.create_user("tester@test.com")

    @cached_property
    def member(self):
        return self.create_user("member@test.com")

    @cached_property
    def owner(self):
        return self.create_user("owner@test.com")

    @cached_property
    def org(self):
        org = self.create_organization("test", self.owner)
        org.flags.allow_joinleave = False
        org.save()
        return org

    def build_request(self, user=None, active_superuser=False, **params):
        request = RequestFactory().get("/", params)
        request.session = SessionBase()
        if active_superuser:
            request.superuser = MockSuperUser()
        if user is None:
            user = self.user
        request.user = user
        request.auth = None
        request.access = from_request(request, self.org)
        return request


class GetProjectIdsTest(BaseOrganizationEndpointTest):
    def setUp(self):
        self.team_1 = self.create_team(organization=self.org)
        self.team_2 = self.create_team(organization=self.org)
        self.team_3 = self.create_team(organization=self.org)
        self.create_team_membership(user=self.member, team=self.team_2)
        self.project_1 = self.create_project(
            organization=self.org, teams=[self.team_1, self.team_3], slug="foo"
        )
        self.project_2 = self.create_project(
            organization=self.org, teams=[self.team_2, self.team_3], slug="bar"
        )

    def run_test(
        self,
        expected_projects,
        user=None,
        project_ids=None,
        include_all_accessible=False,
        active_superuser=False,
    ):
        request_args = {}
        if project_ids:
            request_args["project"] = project_ids

        result = self.endpoint.get_projects(
            self.build_request(user=user, active_superuser=active_superuser, **request_args),
            self.org,
            include_all_accessible=include_all_accessible,
        )
        assert {p.id for p in expected_projects} == {p.id for p in result}

    def test_no_ids_no_teams(self):
        # Should get nothing if not part of the org
        self.run_test([])
        # Should get everything if super user
        self.run_test([self.project_1, self.project_2], user=self.user, active_superuser=True)

        # owner does not see projects they aren't members of if not included in query params
        self.run_test([], user=self.owner)

        # owner sees projects they have access to if they're included as query params
        self.run_test(
            [self.project_1, self.project_2],
            user=self.owner,
            project_ids=[self.project_1.id, self.project_2.id],
        )
        # Should get everything if org is public and ids are specified
        self.org.flags.allow_joinleave = True
        self.org.save()
        self.run_test(
            [self.project_1, self.project_2],
            user=self.member,
            project_ids=[self.project_1.id, self.project_2.id],
        )
        self.run_test([], include_all_accessible=False)

    def test_no_ids_teams(self):
        membership = self.create_team_membership(user=self.user, team=self.team_1)
        self.run_test([self.project_1])
        membership.delete()
        self.create_team_membership(user=self.user, team=self.team_3)
        self.run_test([self.project_1, self.project_2])

    def test_ids_no_teams(self):
        with pytest.raises(PermissionDenied):
            self.run_test([], project_ids=[self.project_1.id])

        self.run_test(
            [self.project_1], user=self.user, project_ids=[self.project_1.id], active_superuser=True
        )

        # owner should see project if they explicitly request it, even if the don't
        # have membership
        self.run_test([self.project_1], user=self.owner, project_ids=[self.project_1.id])

        self.org.flags.allow_joinleave = True
        self.org.save()
        self.run_test([self.project_1], user=self.member, project_ids=[self.project_1.id])

        self.org.flags.allow_joinleave = False
        self.org.save()
        with pytest.raises(PermissionDenied):
            self.run_test([self.project_1], user=self.member, project_ids=[self.project_1.id])

    def test_ids_teams(self):
        membership = self.create_team_membership(user=self.user, team=self.team_1)
        self.run_test([self.project_1], project_ids=[self.project_1.id])
        with pytest.raises(PermissionDenied):
            self.run_test([], project_ids=[self.project_2.id])
        membership.delete()
        self.create_team_membership(user=self.user, team=self.team_3)
        self.run_test(
            [self.project_1, self.project_2], project_ids=[self.project_1.id, self.project_2.id]
        )

    def test_none_user(self):
        request = RequestFactory().get("/")
        request.session = SessionBase()
        request.access = NoAccess()
        request.auth = None
        result = self.endpoint.get_projects(request, self.org)
        assert [] == result

        request.user = AnonymousUser()
        result = self.endpoint.get_projects(request, self.org)
        assert [] == result

    def test_all_accessible_sigil_value_no_open_join(self):
        assert self.org.flags.allow_joinleave.number == 0, "precondition not met"

        self.create_team_membership(user=self.user, team=self.team_1)
        self.run_test([self.project_1], project_ids=[-1])

    def test_all_accessible_sigil_value_allow_joinleave(self):
        self.org.flags.allow_joinleave = True
        self.org.save()

        # With membership on only one team you get all projects
        self.create_team_membership(user=self.user, team=self.team_1)
        self.run_test([self.project_1, self.project_2], project_ids=[-1])

    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint._filter_projects_by_permissions"
    )
    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint.get_requested_project_ids_unchecked"
    )
    def test_get_projects_no_slug_fallsback_to_ids(
        self, mock_get_project_ids_unchecked, mock__filter_projects_by_permissions
    ):
        project_slugs = [""]
        request = self.build_request(projectSlug=project_slugs)
        mock_get_project_ids_unchecked.return_value = {self.project_1.id}

        def side_effect(
            projects,
            **kwargs,
        ):
            return projects

        mock__filter_projects_by_permissions.side_effect = side_effect

        self.endpoint.get_projects(
            request,
            self.org,
        )

        mock_get_project_ids_unchecked.assert_called_with(request)
        mock__filter_projects_by_permissions.assert_called_with(
            projects=[self.project_1],
            request=request,
            filter_by_membership=False,
            force_global_perms=False,
            include_all_accessible=False,
        )

    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint._filter_projects_by_permissions"
    )
    def test_get_projects_by_slugs(self, mock__filter_projects_by_permissions):
        project_slugs = [self.project_1.slug]
        request = self.build_request(projectSlug=project_slugs)

        def side_effect(
            projects,
            **kwargs,
        ):
            return projects

        mock__filter_projects_by_permissions.side_effect = side_effect
        self.endpoint.get_projects(
            request,
            self.org,
        )

        mock__filter_projects_by_permissions.assert_called_with(
            projects=[self.project_1],
            request=request,
            filter_by_membership=False,
            force_global_perms=False,
            include_all_accessible=False,
        )

    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint._filter_projects_by_permissions"
    )
    def test_get_projects_by_slugs_all(self, mock__filter_projects_by_permissions):
        project_slugs = ALL_ACCESS_PROJECTS_SLUG
        request = self.build_request(projectSlug=project_slugs)

        def side_effect(
            projects,
            **kwargs,
        ):
            return projects

        mock__filter_projects_by_permissions.side_effect = side_effect

        response = self.endpoint.get_projects(
            request,
            self.org,
        )

        mock__filter_projects_by_permissions.assert_called_with(
            projects=[self.project_1, self.project_2],
            request=request,
            filter_by_membership=False,
            force_global_perms=False,
            include_all_accessible=True,
        )
        assert len(response) == 2
        assert self.project_1 in response
        assert self.project_2 in response

    def test_get_projects_by_slugs_no_projects_with_slug(self):
        project_slugs = ["hello"]
        request = self.build_request(projectSlug=project_slugs)

        with pytest.raises(PermissionDenied):
            self.endpoint.get_projects(request, self.org)


class GetEnvironmentsTest(BaseOrganizationEndpointTest):
    def setUp(self):
        self.project = self.create_project(organization=self.org)
        self.env_1 = self.create_environment(project=self.project)
        self.env_2 = self.create_environment(project=self.project)

    def run_test(self, expected_envs, env_names=None):
        request_args = {}
        if env_names:
            request_args["environment"] = env_names
        result = self.endpoint.get_environments(self.build_request(**request_args), self.org)
        assert {e.name for e in expected_envs} == {e.name for e in result}

    def test_no_params(self):
        self.run_test([])

    def test_valid_params(self):
        self.run_test([self.env_1], [self.env_1.name])
        self.run_test([self.env_1, self.env_2], [self.env_1.name, self.env_2.name])

    def test_invalid_params(self):
        with pytest.raises(ResourceDoesNotExist):
            self.run_test([], ["fake"])
        with pytest.raises(ResourceDoesNotExist):
            self.run_test([self.env_1, self.env_2], ["fake", self.env_2.name])


class GetFilterParamsTest(BaseOrganizationEndpointTest):
    def setUp(self):
        self.team_1 = self.create_team(organization=self.org)
        self.project_1 = self.create_project(organization=self.org, teams=[self.team_1])
        self.project_2 = self.create_project(organization=self.org, teams=[self.team_1])
        self.env_1 = self.create_environment(project=self.project_1)
        self.env_2 = self.create_environment(project=self.project_1)

    def run_test(
        self,
        expected_projects,
        expected_envs=None,
        expected_teams=None,
        expected_start=None,
        expected_end=None,
        env_names=None,
        user=None,
        date_filter_optional=False,
        project_ids=None,
        start=None,
        end=None,
        stats_period=None,
        active_superuser=False,
    ):
        request_args = {}
        if env_names:
            request_args["environment"] = env_names
        if project_ids:
            request_args["project"] = project_ids
        if start and end:
            request_args["start"] = start
            request_args["end"] = end
        if stats_period:
            request_args["statsPeriod"] = stats_period

        result = self.endpoint.get_filter_params(
            self.build_request(user=user, active_superuser=active_superuser, **request_args),
            self.org,
            date_filter_optional=date_filter_optional,
        )

        assert {p.id for p in expected_projects} == set(result["project_id"])
        assert expected_start == result["start"]
        assert expected_end == result["end"]
        if expected_envs:
            assert {e.name for e in expected_envs} == set(result["environment"])
        else:
            assert "environment" not in result

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params(self):
        with pytest.raises(NoProjects):
            self.run_test([])
        self.run_test(
            expected_projects=[self.project_1, self.project_2],
            expected_start=timezone.now() - MAX_STATS_PERIOD,
            expected_end=timezone.now(),
            user=self.user,
            active_superuser=True,
        )
        self.run_test(
            expected_projects=[self.project_1, self.project_2],
            expected_start=None,
            expected_end=None,
            user=self.user,
            date_filter_optional=True,
            active_superuser=True,
        )

    def test_params(self):
        start = timezone.now() - timedelta(days=3)
        end = timezone.now()
        self.create_team_membership(user=self.user, team=self.team_1)
        self.run_test(
            expected_projects=[self.project_1, self.project_2],
            project_ids=[self.project_1.id, self.project_2.id],
            expected_envs=[self.env_1, self.env_2],
            env_names=[self.env_1.name, self.env_2.name],
            expected_start=start,
            expected_end=end,
            start=start.replace(tzinfo=None).isoformat(),
            end=end.replace(tzinfo=None).isoformat(),
        )

        with freeze_time("2018-12-11 03:21:34"):
            self.run_test(
                expected_projects=[self.project_1, self.project_2],
                project_ids=[self.project_1.id, self.project_2.id],
                expected_envs=[self.env_1, self.env_2],
                env_names=[self.env_1.name, self.env_2.name],
                expected_start=timezone.now() - timedelta(days=2),
                expected_end=timezone.now(),
                stats_period="2d",
            )
