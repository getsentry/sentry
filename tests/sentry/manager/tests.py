# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import (
    Group, Team, User, AccessGroup, GroupTagValue
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

        with self.settings(CELERY_ALWAYS_EAGER=True):
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


class TeamManagerTest(TestCase):
    def test_simple(self):
        user = User.objects.create(username='foo')
        user2 = User.objects.create(username='bar')
        user3 = User.objects.create(username='baz')
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, name='Test')
        group = AccessGroup.objects.create(name='Test', type=MEMBER_USER, team=team)
        group.members.add(user2)

        result = Team.objects.get_for_user(
            organization=org,
            user=user,
            access=MEMBER_OWNER,
        )
        assert result == [team]

        result = Team.objects.get_for_user(
            organization=org,
            user=user2,
            access=MEMBER_OWNER,
        )
        assert result == []

        result = Team.objects.get_for_user(
            organization=org,
            user=user,
            access=MEMBER_USER,
        )
        assert result == [team]

        result = Team.objects.get_for_user(
            organization=org,
            user=user3,
            access=MEMBER_OWNER,
        )
        assert result == []
