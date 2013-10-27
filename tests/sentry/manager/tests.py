# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock
import pytest

from django.utils import timezone
from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.interfaces import Interface
from sentry.manager import get_checksum_from_event
from sentry.models import (
    Event, Group, Project, GroupCountByMinute, ProjectCountByMinute,
    Team, EventMapping, User, AccessGroup
)
from sentry.utils.db import has_trending  # NOQA
from sentry.testutils import TestCase


class DummyInterface(Interface):
    def __init__(self, baz):
        self.baz = baz


class SentryManagerTest(TestCase):
    @mock.patch('sentry.signals.regression_signal.send')
    def test_broken_regression_signal(self, send):
        send.side_effect = Exception()

        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    @mock.patch.object(Group.objects, 'should_sample')
    def test_saves_event_mapping_when_sampled(self, should_sample):
        should_sample.return_value = True
        event_id = 'a' * 32

        event = Group.objects.from_kwargs(1, message='foo', event_id=event_id)
        group = event.group

        assert EventMapping.objects.filter(
            group=group, event_id=event_id).exists()

    def test_invalid_project(self):
        self.assertRaises(Project.DoesNotExist, Group.objects.from_kwargs, 2, message='foo')

    def test_valid_only_message(self):
        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.group.last_seen, event.datetime)
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    def test_valid_timestamp_without_tz(self):
        # TODO: this doesnt error, but it will throw a warning. What should we do?
        with self.Settings(USE_TZ=True):
            date = datetime.datetime.utcnow()
            event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
            self.assertEquals(event.message, 'foo')
            self.assertEquals(event.project_id, 1)
            self.assertEquals(event.datetime, date.replace(tzinfo=timezone.utc))

    def test_url_filter(self):
        event = Group.objects.from_kwargs(1, message='foo')
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='url').count(), 0)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
            }
        })
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='url').count(), 1)
        res = group.grouptag_set.filter(key='url').get()
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
            }
        })
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='url').count(), 1)
        res = group.grouptag_set.filter(key='url').get()
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 2)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com/2',
            }
        })
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='url').count(), 2)
        results = list(group.grouptag_set.filter(key='url').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 2)
        res = results[1]
        self.assertEquals(res.value, 'http://example.com/2')
        self.assertEquals(res.times_seen, 1)

    def test_server_name_filter(self):
        event = Group.objects.from_kwargs(1, message='foo')
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='server_name').count(), 0)

        event = Group.objects.from_kwargs(1, message='foo', server_name='foo')
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='server_name').count(), 1)
        res = group.grouptag_set.filter(key='server_name').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo', server_name='foo')
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='server_name').count(), 1)
        res = group.grouptag_set.filter(key='server_name').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)

        event = Group.objects.from_kwargs(1, message='foo', server_name='bar')
        group = event.group
        self.assertEquals(group.grouptag_set.filter(key='server_name').count(), 2)
        results = list(group.grouptag_set.filter(key='server_name').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)
        res = results[1]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    @mock.patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_list(self, add_tags):
        event = Group.objects.from_kwargs(1, message='foo', tags=[('foo', 'bar')])
        group = event.group
        add_tags.assert_called_once_with(group, [('foo', 'bar'), ('level', 'error'), ('logger', 'root')])

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    @mock.patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_dict(self, add_tags):
        event = Group.objects.from_kwargs(1, message='foo', tags={'foo': 'bar'})
        group = event.group
        add_tags.assert_called_once_with(group, [('foo', 'bar'), ('level', 'error'), ('logger', 'root')])

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    def test_platform_is_saved(self):
        event = Group.objects.from_kwargs(1, message='foo', platform='python')
        group = event.group
        self.assertEquals(group.platform, 'python')
        self.assertEquals(event.platform, 'python')

    def test_dupe_message_id(self):
        event = Group.objects.from_kwargs(1, event_id=1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)
        self.assertEquals(Event.objects.count(), 1)

        # ensure that calling it again doesnt raise a db error
        Group.objects.from_kwargs(1, event_id=1, message='foo')
        self.assertEquals(Event.objects.count(), 1)

    def test_does_update_groupcountbyminute(self):
        event = Group.objects.from_kwargs(1, message='foo')
        inst = GroupCountByMinute.objects.filter(group=event.group)
        self.assertTrue(inst.exists())
        inst = inst.get()
        self.assertEquals(inst.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo')
        inst = GroupCountByMinute.objects.get(group=event.group)
        self.assertEquals(inst.times_seen, 2)

    def test_does_update_projectcountbyminute(self):
        event = Group.objects.from_kwargs(1, message='foo')
        inst = ProjectCountByMinute.objects.filter(project=event.project)
        self.assertTrue(inst.exists())
        inst = inst.get()
        self.assertEquals(inst.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo')
        inst = ProjectCountByMinute.objects.get(project=event.project)
        self.assertEquals(inst.times_seen, 2)

    def test_updates_group(self):
        Group.objects.from_kwargs(1, message='foo', checksum='a' * 32)
        event = Group.objects.from_kwargs(1, message='foo bar', checksum='a' * 32)

        group = Group.objects.get(pk=event.group_id)

        self.assertEquals(group.times_seen, 2)
        self.assertEquals(group.last_seen.replace(microsecond=0), event.datetime.replace(microsecond=0))
        self.assertEquals(group.message, 'foo bar')

    def test_add_tags(self):
        event = Group.objects.from_kwargs(1, message='rrr')
        group = event.group
        Group.objects.add_tags(group, tags=(('foo', 'bar'), ('foo', 'baz'), ('biz', 'boz')))

        self.assertEquals(group.grouptag_set.filter(key='foo').count(), 2)
        results = list(group.grouptag_set.filter(key='foo').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)
        res = results[1]
        self.assertEquals(res.value, 'baz')
        self.assertEquals(res.times_seen, 1)

        self.assertEquals(group.grouptag_set.filter(key='biz').count(), 1)
        results = list(group.grouptag_set.filter(key='biz').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'boz')
        self.assertEquals(res.times_seen, 1)


@pytest.mark.skipif('not has_trending()')
class TrendsTest(TestCase):
    def test_accelerated_works_at_all(self):
        now = timezone.now() - datetime.timedelta(minutes=5)
        project = Project.objects.all()[0]
        group = Group.objects.create(status=0, project=project, message='foo', checksum='a' * 32)
        group2 = Group.objects.create(status=0, project=project, message='foo', checksum='b' * 32)
        GroupCountByMinute.objects.create(project=project, group=group, date=now, times_seen=50)
        GroupCountByMinute.objects.create(project=project, group=group2, date=now, times_seen=40)
        base_qs = Group.objects.filter(
            status=0,
        )

        results = list(Group.objects.get_accelerated([project.id], base_qs)[:25])
        self.assertEquals(results, [group, group2])


class GetChecksumFromEventTest(TestCase):
    @mock.patch('sentry.interfaces.Stacktrace.get_composite_hash')
    @mock.patch('sentry.interfaces.Http.get_composite_hash')
    def test_stacktrace_wins_over_http(self, http_comp_hash, stack_comp_hash):
        # this was a regression, and a very important one
        http_comp_hash.return_value = ['baz']
        stack_comp_hash.return_value = ['foo', 'bar']
        event = Event(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }],
                },
                'sentry.interfaces.Http': {
                    'url': 'http://example.com'
                },
            },
            message='Foo bar',
        )
        checksum = get_checksum_from_event(event)
        stack_comp_hash.assert_called_once_with(interfaces=event.interfaces)
        assert not http_comp_hash.called
        assert checksum == '3858f62230ac3c915f300c664312c63f'


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
