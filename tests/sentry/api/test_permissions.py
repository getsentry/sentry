# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.permissions import has_perm
from sentry.constants import MEMBER_USER, MEMBER_ADMIN
from sentry.testutils import TestCase


class TeamPermissionTest(TestCase):
    def test_basic_user(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        assert not has_perm(team, user, None, MEMBER_USER)
        assert not has_perm(team, user, None, MEMBER_ADMIN)

    def test_owner(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        assert has_perm(team, owner, None, MEMBER_USER)
        assert has_perm(team, owner, None, MEMBER_ADMIN)

    def test_team_member(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        team.member_set.create(user=user, type=MEMBER_USER)
        assert has_perm(team, user, None, MEMBER_USER)
        assert not has_perm(team, user, None, MEMBER_ADMIN)

    def test_team_admin(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        team.member_set.create(user=user, type=MEMBER_ADMIN)
        assert has_perm(team, user, None, MEMBER_USER)
        assert has_perm(team, user, None, MEMBER_ADMIN)

    def test_project_key(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        key = self.create_project_key(project=project, user=owner)
        assert has_perm(team, owner, key, MEMBER_USER)
        assert not has_perm(team, owner, key, MEMBER_ADMIN)


class ProjectPermissionTest(TestCase):
    def test_basic_user(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        assert not has_perm(project, user, None, MEMBER_USER)
        assert not has_perm(project, user, None, MEMBER_ADMIN)

    def test_owner(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        assert has_perm(project, owner, None, MEMBER_USER)
        assert has_perm(project, owner, None, MEMBER_ADMIN)

    def test_team_member(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        team.member_set.create(user=user, type=MEMBER_USER)
        assert has_perm(project, user, None, MEMBER_USER)
        assert not has_perm(project, user, None, MEMBER_ADMIN)

    def test_team_admin(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        team.member_set.create(user=user, type=MEMBER_ADMIN)
        assert has_perm(project, user, None, MEMBER_USER)
        assert has_perm(project, user, None, MEMBER_ADMIN)

    def test_project_key(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        key = self.create_project_key(project=project, user=owner)
        assert has_perm(project, owner, key, MEMBER_USER)
        assert not has_perm(project, owner, key, MEMBER_ADMIN)


class GroupPermissionTest(TestCase):
    def test_basic_user(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        group = self.create_group(project=project)
        assert not has_perm(group, user, None, MEMBER_USER)
        assert not has_perm(group, user, None, MEMBER_ADMIN)

    def test_owner(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        group = self.create_group(project=project)
        assert has_perm(group, owner, None, MEMBER_USER)
        assert has_perm(group, owner, None, MEMBER_ADMIN)

    def test_team_member(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        team.member_set.create(user=user, type=MEMBER_USER)
        group = self.create_group(project=project)
        assert has_perm(group, user, None, MEMBER_USER)
        assert not has_perm(group, user, None, MEMBER_ADMIN)

    def test_team_admin(self):
        user = self.create_user(is_superuser=False, email='bar@example.com')
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        team.member_set.create(user=user, type=MEMBER_ADMIN)
        group = self.create_group(project=project)
        assert has_perm(group, user, None, MEMBER_USER)
        assert has_perm(group, user, None, MEMBER_ADMIN)

    def test_project_key(self):
        owner = self.create_user(email='foo@example.com')
        team = self.create_team(owner=owner)
        project = self.create_project(team=team)
        key = self.create_project_key(project=project, user=owner)
        group = self.create_group(project=project)
        assert has_perm(group, owner, key, MEMBER_USER)
        assert not has_perm(group, owner, key, MEMBER_ADMIN)
