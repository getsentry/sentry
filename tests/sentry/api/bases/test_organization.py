from __future__ import absolute_import

from mock import Mock

from sentry.api.bases.organization import OrganizationPermission
from sentry.models import ApiKey, OrganizationMemberType, ProjectKey
from sentry.testutils import TestCase


class OrganizationPermissionBase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        super(OrganizationPermissionBase, self).setUp()

    def has_object_perm(self, auth, user, obj, method='GET'):
        perm = OrganizationPermission()
        request = Mock()
        request.auth = auth
        request.user = user
        request.method = method
        return perm.has_object_permission(request, None, obj)


class OrganizationPermissionTest(OrganizationPermissionBase):
    def test_regular_user(self):
        user = self.create_user()
        assert not self.has_object_perm(None, user, self.org)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm(None, user, self.org)

    def test_org_member_with_global_access(self):
        user = self.create_user()
        om = self.create_member(
            user=user,
            organization=self.org,
            type=OrganizationMemberType.MEMBER,
            has_global_access=True,
        )
        assert self.has_object_perm(None, user, self.org, 'GET')
        assert not self.has_object_perm(None, user, self.org, 'POST')

    def test_org_member_without_global_access(self):
        user = self.create_user()
        om = self.create_member(
            user=user,
            organization=self.org,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
        )
        assert self.has_object_perm(None, user, self.org, 'GET')
        assert not self.has_object_perm(None, user, self.org, 'POST')

    def test_project_key(self):
        key = ProjectKey.objects.create(
            project=self.create_project(
                team=self.create_team(organization=self.org),
            ),
        )
        assert not self.has_object_perm(key, None, self.org)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert self.has_object_perm(key, None, self.org)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
        )
        assert not self.has_object_perm(key, None, self.org)
