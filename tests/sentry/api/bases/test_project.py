from __future__ import absolute_import

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
        request = self.make_request(user=user, auth=auth, method=method)
        if is_superuser:
            request.superuser.set_logged_in(request.user)
        return (
            perm.has_permission(request, None) and perm.has_object_permission(request, None, obj)
        )


class ProjectPermissionTest(ProjectPermissionBase):
    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm('GET', self.project, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm('GET', self.project, user=user, is_superuser=True)

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
        self.create_member(user=user, organization=self.org, role='member', teams=[self.team])
        assert self.has_object_perm('GET', self.project, user=user)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['project:read'],
        )
        assert self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
            scope_list=['project:read'],
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['team:read'],
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['project:read'],
        )
        assert not self.has_object_perm('PUT', self.project, auth=key)

    def test_admin_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='admin',
            teams=[team],
        )
        # if `allow_joinleave` is True, admins can act on teams
        # they don't have access to
        assert self.has_object_perm('POST', self.project, user=user)

    def test_admin_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='admin',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)

    def test_manager_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='manager',
            teams=[team],
        )
        # managers should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', self.project, user=user)

    def test_manager_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='manager',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)

    def test_owner_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='owner',
            teams=[team],
        )
        # owners should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', self.project, user=user)

    def test_owner_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)


class ProjectPermissionNoJoinLeaveTest(ProjectPermissionBase):
    def setUp(self):
        super(ProjectPermissionNoJoinLeaveTest, self).setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org)

    def test_regular_user(self):
        user = self.create_user(is_superuser=False)
        assert not self.has_object_perm('GET', self.project, user=user)

    def test_superuser(self):
        user = self.create_user(is_superuser=True)
        assert self.has_object_perm('GET', self.project, user=user, is_superuser=True)

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
        self.create_member(user=user, organization=self.org, role='member', teams=[self.team])
        assert self.has_object_perm('GET', self.project, user=user)

    def test_api_key_with_org_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['project:read'],
        )
        assert self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_org_access(self):
        key = ApiKey.objects.create(
            organization=self.create_organization(),
            scope_list=['project:read'],
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_without_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['team:read'],
        )
        assert not self.has_object_perm('GET', self.project, auth=key)

    def test_api_key_with_wrong_access_for_method(self):
        key = ApiKey.objects.create(
            organization=self.org,
            scope_list=['project:read'],
        )
        assert not self.has_object_perm('PUT', self.project, auth=key)

    def test_admin_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='admin',
            teams=[team],
        )
        # if `allow_joinleave` is False, admins can't act on teams
        # they don't have access to
        assert not self.has_object_perm('POST', self.project, user=user)

    def test_admin_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='admin',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)

    def test_manager_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='manager',
            teams=[team],
        )
        # managers should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', self.project, user=user)

    def test_manager_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='manager',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)

    def test_owner_without_team_access(self):
        team = self.create_team(organization=self.org)
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='owner',
            teams=[team],
        )
        # owners should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', self.project, user=user)

    def test_owner_with_team_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        assert self.has_object_perm('POST', self.project, user=user)

    def test_manager_when_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='manager',
        )
        # managers should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', project, user=user)

    def test_owner_when_project_has_no_teams(self):
        project = self.create_project(organization=self.org, teams=[])
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.org,
            role='owner',
        )
        # owners should be able to act on teams/projects they
        # don't have access to
        assert self.has_object_perm('POST', project, user=user)
