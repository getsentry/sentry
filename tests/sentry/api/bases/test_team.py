from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.team import TeamPermission
from sentry.models import ApiKey, OrganizationMemberType, ProjectKey
from sentry.testutils import TestCase


class TeamPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        super(TeamPermissionBase, self).setUp()

    def has_object_perm(self, auth, user, obj, method='GET'):
        perm = TeamPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        return perm.has_object_permission(request, None, obj)


class TeamPermissionTest(TeamPermissionBase):
    def test_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm(None, user, self.team)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm(None, user, self.team)

    def test_org_member_without_team_access(self):
        user = self.create_user()
        om = self.create_member(
            user=user,
            organization=self.org,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )
        assert not self.has_object_perm(None, user, self.team)

    def test_org_member_with_global_access(self):
        user = self.create_user()
        om = self.create_member(
            user=user,
            organization=self.org,
            type=OrganizationMemberType.MEMBER,
            has_global_access=True,
        )
        assert self.has_object_perm(None, user, self.team)

    def test_org_member_with_team_access(self):
        user = self.create_user()
        om = self.create_member(
            user=user,
            organization=self.org,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
            teams=[self.team],
        )
        assert self.has_object_perm(None, user, self.team)

    def test_project_key(self):
        key = ProjectKey.objects.create(
            project=self.create_project(team=self.team),
        )
        assert not self.has_object_perm(key, None, self.team)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert self.has_object_perm(key, None, self.team)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
        )
        assert not self.has_object_perm(key, None, self.team)
