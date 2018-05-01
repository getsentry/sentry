# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry import tagstore
from sentry.models import Group, Project, Team, User
from sentry.testutils import TestCase


class SentryManagerTest(TestCase):
    def test_valid_only_message(self):
        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.group.last_seen, event.datetime)
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    def test_add_tags(self):
        event = Group.objects.from_kwargs(1, message='rrr')
        group = event.group
        environment = self.create_environment()

        with self.tasks():
            Group.objects.add_tags(
                group,
                environment,
                tags=[
                    ('foo', 'bar'),
                    ('foo', 'baz'),
                    ('biz', 'boz'),
                ],
            )

        results = sorted(
            tagstore.get_group_tag_values(
                group.project_id,
                group.id,
                environment_id=None,
                key='foo',
            ),
            key=lambda x: x.value,
        )
        assert len(results) == 2
        res = results[0]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)
        res = results[1]
        self.assertEquals(res.value, 'baz')
        self.assertEquals(res.times_seen, 1)

        results = tagstore.get_group_tag_values(
            group.project_id,
            group.id,
            environment_id=None,
            key='biz'
        )
        assert len(results) == 1
        res = results[0]
        self.assertEquals(res.value, 'boz')
        self.assertEquals(res.times_seen, 1)


class TeamManagerTest(TestCase):
    def test_simple(self):
        user = User.objects.create(username='foo')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(
            organization=org,
            user=user,
        )
        assert result == [team]

    def test_invalid_scope(self):
        user = User.objects.create(username='foo')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(
            organization=org,
            user=user,
            scope='idontexist',
        )
        assert result == []

    def test_valid_scope(self):
        user = User.objects.create(username='foo')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(
            organization=org,
            user=user,
            scope='project:read',
        )
        assert result == [team]

    def test_user_no_access(self):
        user = User.objects.create(username='foo')
        user2 = User.objects.create(username='bar')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(
            organization=org,
            user=user2,
        )
        assert result == []

    def test_with_projects(self):
        user = User.objects.create(username='foo')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        self.create_member(organization=org, user=user, teams=[team])
        project = self.create_project(teams=[team], name='foo')
        project2 = self.create_project(teams=[team], name='bar')
        result = Team.objects.get_for_user(
            organization=org,
            user=user,
            with_projects=True,
        )
        assert result == [(team, [project2, project])]


class ProjectManagerTest(TestCase):
    def test_simple(self):
        user = User.objects.create(username='foo')
        org = self.create_organization()
        team = self.create_team(organization=org, name='Test')
        project = self.create_project(teams=[team], name='foo')
        project2 = self.create_project(teams=[team], name='baz')

        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=True,
        )
        assert result == [project2, project]

        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=False,
        )
        assert result == []

        self.create_member(organization=org, user=user, teams=[team])

        # check again after creating member
        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=True,
        )
        assert result == [project2, project]

        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=False,
        )
        assert result == [project2, project]

        # test with scope user doesn't have
        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=False,
            scope='project:write',
        )
        assert result == []

        # check with scope they do have
        result = Project.objects.get_for_user(
            team=team,
            user=user,
            _skip_team_check=False,
            scope='project:read',
        )
        assert result == [project2, project]
