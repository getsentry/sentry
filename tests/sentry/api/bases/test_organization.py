from datetime import timedelta
from functools import cached_property
from unittest import mock

import pytest
from django.db.models import F
from django.test import RequestFactory
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.exceptions import PermissionDenied

from sentry.api.bases.organization import NoProjects, OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import (
    MemberDisabledOverLimit,
    ResourceDoesNotExist,
    SuperuserRequired,
    TwoFactorRequired,
)
from sentry.api.utils import MAX_STATS_PERIOD
from sentry.auth.access import NoAccess, from_request
from sentry.auth.authenticators import TotpInterface
from sentry.constants import ALL_ACCESS_PROJECTS, ALL_ACCESS_PROJECTS_SLUG
from sentry.models import ApiKey, Organization, OrganizationMember
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils import TestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test


class MockSuperUser:
    @property
    def is_active(self):
        return True


class OrganizationPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        super().setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = OrganizationPermission()
        if user is not None:
            user = user_service.get_user(user.id)  # Replace with region silo APIUser
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        return perm.has_permission(request, None) and perm.has_object_permission(request, None, obj)


@region_silo_test(stable=True)
class OrganizationPermissionTest(OrganizationPermissionBase):
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
        with exempt_from_silo_limits():
            key = ApiKey.objects.create(organization=self.org, scope_list=["org:read"])
        assert self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_without_org_access(self):
        with exempt_from_silo_limits():
            key = ApiKey.objects.create(
                organization=self.create_organization(), scope_list=["org:read"]
            )
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_without_access(self):
        with exempt_from_silo_limits():
            key = ApiKey.objects.create(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access(self):
        with exempt_from_silo_limits():
            key = ApiKey.objects.create(organization=self.org, scope_list=["team:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        with exempt_from_silo_limits():
            key = ApiKey.objects.create(organization=self.org, scope_list=["org:read"])
        assert not self.has_object_perm("PUT", self.org, auth=key)

    def test_org_requires_2fa_with_superuser(self):
        self.org_require_2fa()
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.org, user=user, is_superuser=True)

    def test_org_requires_2fa_with_enrolled_user(self):
        self.org_require_2fa()
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member")

        with exempt_from_silo_limits():
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

    @mock.patch("sentry.api.utils.get_cached_organization_member")
    def test_member_limit_error(self, mock_get_org_member):
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
        assert mock_get_org_member.call_count == 1

    @mock.patch("sentry.api.utils.get_cached_organization_member")
    def test_member_limit_with_superuser(self, mock_get_org_member):
        user = self.create_user(is_superuser=True)
        self.create_member(
            user=user,
            organization=self.org,
            role="member",
            flags=OrganizationMember.flags["member-limit:restricted"],
        )
        assert self.has_object_perm("GET", self.org, user=user, is_superuser=True)
        assert mock_get_org_member.call_count == 0

    @mock.patch("sentry.api.utils.get_cached_organization_member")
    def test_member_limit_sentry_app(self, mock_get_org_member):
        app = self.create_internal_integration(
            name="integration", organization=self.org, scopes=("org:admin",)
        )
        assert self.has_object_perm("GET", self.org, user=app.proxy_user)
        assert mock_get_org_member.call_count == 0


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
        request.session = {}
        if active_superuser:
            request.superuser = MockSuperUser()
        if user is None:
            user = self.user
        request.user = user
        request.access = from_request(request, self.org)
        return request


@region_silo_test(stable=True)
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
        request.session = {}
        request.access = NoAccess()
        result = self.endpoint.get_projects(request, self.org)
        assert [] == result

        request.user = None
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

    @mock.patch("sentry.api.bases.organization.OrganizationEndpoint._get_projects_by_id")
    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint.get_requested_project_ids_unchecked"
    )
    def test_get_projects_no_slug_fallsback_to_ids(
        self, mock_get_project_ids_unchecked, mock__get_projects_by_id
    ):
        project_slugs = [""]
        request = self.build_request(projectSlug=project_slugs)
        mock_project_ids = set()
        mock_get_project_ids_unchecked.return_value = mock_project_ids

        self.endpoint.get_projects(
            request,
            self.org,
        )

        mock_get_project_ids_unchecked.assert_called_with(request)
        mock__get_projects_by_id.assert_called_with(
            mock_project_ids,
            request,
            self.org,
            False,
            False,
        )

    @mock.patch("sentry.api.bases.organization.OrganizationEndpoint._get_projects_by_id")
    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint.get_requested_project_ids_unchecked"
    )
    def test_get_projects_by_slugs_grabs_project_ids(
        self, mock_get_project_ids_unchecked, mock__get_projects_by_id
    ):
        project_slugs = [self.project_1.slug]
        request = self.build_request(projectSlug=project_slugs)

        self.endpoint.get_projects(
            request,
            self.org,
        )

        assert not mock_get_project_ids_unchecked.called
        mock__get_projects_by_id.assert_called_with(
            set({self.project_1.id}),
            request,
            self.org,
            False,
            False,
        )

    @mock.patch("sentry.api.bases.organization.OrganizationEndpoint._get_projects_by_id")
    @mock.patch(
        "sentry.api.bases.organization.OrganizationEndpoint.get_requested_project_ids_unchecked"
    )
    def test_get_projects_by_slugs_all(
        self, mock_get_project_ids_unchecked, mock__get_projects_by_id
    ):
        project_slugs = ALL_ACCESS_PROJECTS_SLUG
        request = self.build_request(projectSlug=project_slugs)

        self.endpoint.get_projects(
            request,
            self.org,
        )

        assert not mock_get_project_ids_unchecked.called
        mock__get_projects_by_id.assert_called_with(
            ALL_ACCESS_PROJECTS,
            request,
            self.org,
            False,
            False,
        )

    def test_get_projects_by_slugs_no_projects_with_slug(self):
        project_slugs = ["hello"]
        request = self.build_request(projectSlug=project_slugs)

        assert not self.endpoint.get_projects(request, self.org)


@region_silo_test(stable=True)
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


@region_silo_test(stable=True)
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
