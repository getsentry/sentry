from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.organization import OrganizationPermission
from sentry.models import ApiKey, ProjectKey
from sentry.testutils import TestCase


class OrganizationPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        super(OrganizationPermissionBase, self).setUp()

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        perm = OrganizationPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        request.is_superuser = lambda: is_superuser if is_superuser is not None else user.is_superuser
        return perm.has_object_permission(request, None, obj)


class OrganizationPermissionTest(OrganizationPermissionBase):
    def test_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm('GET', self.org, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm('GET', self.org, user=user)

    def test_org_member(self):
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.org,
            role='member',
        )
        assert self.has_object_perm('GET', self.org, user=user)
        assert not self.has_object_perm('POST', self.org, user=user)

    def test_project_key(self):
        key = ProjectKey.objects.create(
            project=self.create_project(
                team=self.create_team(organization=self.org),
            ),
        )
        assert not self.has_object_perm('GET', self.org, auth=key)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert self.has_object_perm('GET', self.org, auth=key)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
        )
        assert not self.has_object_perm('GET', self.org, auth=key)
