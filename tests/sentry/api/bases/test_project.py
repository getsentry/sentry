from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.project import ProjectPermission
from sentry.models import ApiKey, ProjectKey
from sentry.testutils import TestCase


class ProjectPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)
        super(ProjectPermissionBase, self).setUp()

    def has_object_perm(self, auth, user, obj, method='GET'):
        perm = ProjectPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        return perm.has_object_permission(request, None, obj)


class ProjectPermissionTest(ProjectPermissionBase):
    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm(None, user, self.project)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm(None, user, self.project)

    def test_member_for_project_read(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert self.has_object_perm(None, user, self.project)

    def test_member_for_project_write(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert not self.has_object_perm(None, user, self.project, method='POST')

    def test_member_for_project_delete(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team],
        )
        assert not self.has_object_perm(None, user, self.project, method='DELETE')

    def test_member_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
            teams=[self.team]
        )
        assert self.has_object_perm(None, user, self.project)

    def test_project_key_with_project_access(self):
        key = ProjectKey.objects.create(
            project=self.project,
        )
        assert self.has_object_perm(key, None, self.project)

    def test_project_key_without_project_access(self):
        key = ProjectKey.objects.create(
            project=self.create_project(organization=self.org),
        )
        assert not self.has_object_perm(key, None, self.project)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert self.has_object_perm(key, None, self.project)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
        )
        assert not self.has_object_perm(key, None, self.project)
