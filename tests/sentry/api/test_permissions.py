# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.permissions import has_perm
from sentry.constants import MEMBER_USER, MEMBER_ADMIN
from sentry.models import OrganizationMemberType
from sentry.testutils import TestCase


class BasePermissionTest(TestCase):
    def setUp(self):
        super(BasePermissionTest, self).setUp()
        self.nonmember = self.create_user(is_superuser=False, email='a@example.com')
        self.admin = self.create_user(is_superuser=False, email='b@example.com')
        self.member = self.create_user(is_superuser=False, email='c@example.com')
        self.organization = self.create_organization(owner=self.admin)
        self.team = self.create_team(organization=self.organization, name='a')

        self.organization.member_set.get_or_create(
            user=self.member, type=OrganizationMemberType.MEMBER)
        self.organization.member_set.get_or_create(
            user=self.admin, type=OrganizationMemberType.OWNER)


class TeamPermissionTest(BasePermissionTest):
    def test_basic_user(self):
        assert not has_perm(self.team, self.nonmember, None, MEMBER_USER)
        assert not has_perm(self.team, self.nonmember, None, MEMBER_ADMIN)

    def test_admin(self):
        assert has_perm(self.team, self.admin, None, MEMBER_USER)
        assert has_perm(self.team, self.admin, None, MEMBER_ADMIN)

    def test_member(self):
        assert has_perm(self.team, self.member, None, MEMBER_USER)
        assert not has_perm(self.team, self.member, None, MEMBER_ADMIN)


class ProjectPermissionTest(BasePermissionTest):
    def setUp(self):
        super(ProjectPermissionTest, self).setUp()
        self.project = self.create_project(team=self.team, name='a')
        self.key = self.create_project_key(project=self.project, user=self.member)

    def test_basic_user(self):
        assert not has_perm(self.project, self.nonmember, None, MEMBER_USER)
        assert not has_perm(self.project, self.nonmember, None, MEMBER_ADMIN)

    def test_admin(self):
        assert has_perm(self.project, self.admin, None, MEMBER_USER)
        assert has_perm(self.project, self.admin, None, MEMBER_ADMIN)

    def test_member(self):
        assert has_perm(self.project, self.member, None, MEMBER_USER)
        assert not has_perm(self.project, self.member, None, MEMBER_ADMIN)

    def test_project_key(self):
        assert has_perm(self.project, self.member, self.key, MEMBER_USER)
        assert not has_perm(self.project, self.member, self.key, MEMBER_ADMIN)


class GroupPermissionTest(BasePermissionTest):
    def setUp(self):
        super(GroupPermissionTest, self).setUp()
        self.project = self.create_project(team=self.team, name='a')
        self.key = self.create_project_key(project=self.project, user=self.member)
        self.group = self.create_group(project=self.project)

    def test_basic_user(self):
        assert not has_perm(self.group, self.nonmember, None, MEMBER_USER)
        assert not has_perm(self.group, self.nonmember, None, MEMBER_ADMIN)

    def test_admin(self):
        assert has_perm(self.group, self.admin, None, MEMBER_USER)
        assert has_perm(self.group, self.admin, None, MEMBER_ADMIN)

    def test_member(self):
        assert has_perm(self.group, self.member, None, MEMBER_USER)
        assert not has_perm(self.group, self.member, None, MEMBER_ADMIN)

    def test_project_key(self):
        assert has_perm(self.group, self.nonmember, self.key, MEMBER_USER)
        assert not has_perm(self.group, self.nonmember, self.key, MEMBER_ADMIN)
