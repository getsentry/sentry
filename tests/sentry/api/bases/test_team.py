from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.team import TeamPermission
from sentry.models import ApiKey, ProjectKey
from sentry.testutils import TestCase


class TeamPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization(flags=0)
        self.team = self.create_team(organization=self.org)
        super(TeamPermissionBase, self).setUp()

    def has_perm(self, method, obj, auth=None, user=None):
        perm = TeamPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        return perm.has_object_permission(request, None, obj)


class TeamPermissionTest(TeamPermissionBase):
    def test_get_regular_user(self):
        user = self.create_user()
        assert not self.has_perm('GET', self.team, user=user)

    def test_get_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_perm('GET', self.team, user=user)

    def test_get_without_team_membership(self):
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[],
        )
        assert not self.has_perm('GET', self.team, user=user)

    def test_get_with_team_membership(self):
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert self.has_perm('GET', self.team, user=user)

    def test_get_project_key(self):
        key = ProjectKey.objects.create(
            project=self.create_project(team=self.team),
        )
        assert not self.has_perm('GET', self.team, auth=key)

    def test_get_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert self.has_perm('GET', self.team, auth=key)

    def test_get_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
        )
        assert not self.has_perm('GET', self.team, auth=key)
