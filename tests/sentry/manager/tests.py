# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import (
    Group, Project, Team, User, AccessGroup, GroupTagValue
)
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
        Group.objects.add_tags(group, tags=(('foo', 'bar'), ('foo', 'baz'), ('biz', 'boz')))

        results = list(GroupTagValue.objects.filter(
            group=group, key='foo').order_by('id'))
        assert len(results) == 2
        res = results[0]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)
        res = results[1]
        self.assertEquals(res.value, 'baz')
        self.assertEquals(res.times_seen, 1)

        results = list(GroupTagValue.objects.filter(
            group=group, key='biz').order_by('id'))
        assert len(results) == 1
        res = results[0]
        self.assertEquals(res.value, 'boz')
        self.assertEquals(res.times_seen, 1)


class ProjectManagerTest(TestCase):
    def setUp(self):
        self.project = Project.objects.get()
        self.project.update(public=True)
        self.project2 = Project.objects.create(name='Test', slug='test', owner=self.user, public=False)

    @mock.patch('sentry.models.Team.objects.get_for_user', mock.Mock(return_value={}))
    def test_does_not_include_public_projects(self):
        self.user.is_superuser = False
        project_list = Project.objects.get_for_user(self.user)
        assert project_list == []

        project_list = Project.objects.get_for_user(self.user, MEMBER_USER)
        assert project_list == []

    @mock.patch('sentry.models.Team.objects.get_for_user')
    def test_does_not_include_private_projects(self, get_for_user):
        self.user.is_superuser = False
        get_for_user.return_value = {self.project2.team.id: self.project2.team}
        project_list = Project.objects.get_for_user(self.user)
        get_for_user.assert_called_once_with(self.user, None, access_groups=False)
        assert project_list == [self.project2]

        get_for_user.reset_mock()
        project_list = Project.objects.get_for_user(self.user, MEMBER_USER)
        get_for_user.assert_called_once_with(self.user, MEMBER_USER, access_groups=False)
        assert project_list == [self.project2]


class TeamManagerTest(TestCase):
    def test_simple(self):
        user = User.objects.create(username='foo')
        user2 = User.objects.create(username='bar')
        user3 = User.objects.create(username='baz')
        team = Team.objects.create(name='Test', owner=user)
        group = AccessGroup.objects.create(name='Test', type=MEMBER_USER, team=team)
        group.members.add(user2)

        result = Team.objects.get_for_user(user, access=MEMBER_OWNER)
        assert result == {team.slug: team}

        result = Team.objects.get_for_user(user2, access=MEMBER_OWNER)
        assert result == {}

        result = Team.objects.get_for_user(user2, access=MEMBER_USER)
        assert result == {team.slug: team}

        result = Team.objects.get_for_user(user3, access=MEMBER_OWNER)
        assert result == {}
