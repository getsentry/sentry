from __future__ import absolute_import

from sentry.api.bases.team import TeamPermission
from sentry.models import ApiKey
from sentry.testutils import TestCase


class TeamPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization(flags=0)
        self.team = self.create_team(organization=self.org)
        super(TeamPermissionBase, self).setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = TeamPermission()
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        return perm.has_permission(request, None) and perm.has_object_permission(request, None, obj)


class TeamPermissionTest(TeamPermissionBase):
    def test_get_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm("GET", self.team, user=user)

    def test_get_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm("GET", self.team, user=user, is_superuser=True)

    def test_get_without_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        assert not self.has_object_perm("GET", self.team, user=user)

    def test_get_with_team_membership(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org, role="member", teams=[self.team])
        assert self.has_object_perm("GET", self.team, user=user)

    def test_get_api_key_with_org_access(self):
        key = ApiKey.objects.create(organization=self.org, scope_list=["team:read"])
        assert self.has_object_perm("GET", self.team, auth=key)

    def test_get_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(), scope_list=["team:read"]
        )
        assert not self.has_object_perm("GET", self.team, auth=key)

    def test_api_key_without_access(self):
        key = ApiKey.objects.create(organization=self.org)
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access(self):
        key = ApiKey.objects.create(organization=self.org, scope_list=["project:read"])
        assert not self.has_object_perm("GET", self.org, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = ApiKey.objects.create(organization=self.org, scope_list=["team:read"])
        assert not self.has_object_perm("PUT", self.project, auth=key)
