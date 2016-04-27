from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.project import ProjectPermission
from sentry.models import ApiKey
from sentry.testutils import TestCase


class ProjectPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)
        super(ProjectPermissionBase, self).setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = ProjectPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        request.is_superuser = lambda: is_superuser if is_superuser is not None else user.is_superuser
        return (
            perm.has_permission(request, None) and
            perm.has_object_permission(request, None, obj)
        )


class ProjectPermissionTest(ProjectPermissionBase):
    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm('GET', self.project, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm('GET', self.project, user=user)

    def test_member_for_project_read(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert self.has_object_perm('GET', self.project, user=user)

    def test_member_for_project_write(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert not self.has_object_perm('POST', self.project, user=user)

    def test_member_for_project_delete(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert not self.has_object_perm('DELETE', self.project, user=user)

    def test_member_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team]
        )
        assert self.has_object_perm('GET', self.project, user=user)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scopes=getattr(ApiKey.scopes, 'project:read'),
        )
        assert self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
            scopes=getattr(ApiKey.scopes, 'project:read'),
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scopes=0,
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scopes=getattr(ApiKey.scopes, 'team:read'),
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scopes=getattr(ApiKey.scopes, 'project:read'),
        )
        assert not self.has_object_perm('PUT', self.project, auth=key)
