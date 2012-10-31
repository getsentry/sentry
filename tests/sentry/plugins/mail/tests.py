# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from mock import Mock
from django.utils import timezone
from sentry.interfaces import Stacktrace
from sentry.models import Event, Group, Project
from sentry.plugins.sentry_mail.models import MailProcessor

from tests.base import TestCase


class MailProcessorTest(TestCase):
    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_send_to', Mock(return_value=[]))
    def test_should_notify_no_send_to(self):
        p = MailProcessor()
        self.assertFalse(p.should_notify(group=Mock(), event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_notify_not_min_level(self):
        p = MailProcessor(min_level=2)
        group = Mock(spec=Group)
        group.level = 1
        self.assertFalse(p.should_notify(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_notify_not_included(self):
        p = MailProcessor(min_level=None, include_loggers=['foo'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_notify(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_notify_excluded(self):
        p = MailProcessor(min_level=None, exclude_loggers=['root'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_notify(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_notify_match(self):
        p = MailProcessor(min_level=None)
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertTrue(p.should_notify(group=group, event=Mock()))

    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor._send_mail')
    def test_notify_users_renders_interfaces(self, _send_mail):
        group = Group()
        group.first_seen = timezone.now()
        group.last_seen = group.first_seen
        group.id = 2
        group.project_id = 1

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_string.return_value = 'foo bar'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'hello world'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_string.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor._send_mail')
    def test_notify_users_renders_interfaces_with_utf8(self, _send_mail):
        group = Group()
        group.first_seen = timezone.now()
        group.last_seen = group.first_seen
        group.id = 2
        group.project_id = 1

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_string.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'hello world'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_string.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor._send_mail')
    def test_notify_users_renders_interfaces_with_utf8_fix_issue_422(self, _send_mail):
        group = Group()
        group.first_seen = timezone.now()
        group.last_seen = group.first_seen
        group.id = 2
        group.project_id = 1

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_string.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'Soubor ji\xc5\xbe existuje'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_string.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor._send_mail')
    def test_notify_users_does_email(self, _send_mail):
        project = Project(id=1, name='Project Name')

        group = Group()
        group.first_seen = timezone.now()
        group.last_seen = group.first_seen
        group.project = project
        group.id = 2

        event = Event()
        event.group = group
        event.message = 'hello world'
        event.logger = 'root'
        event.project = project
        event.date = group.last_seen

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.notify_users(group, event)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('fail_silently'), False)
        self.assertEquals(kwargs.get('project'), project)
        self.assertEquals(kwargs.get('subject'), u"[Project Name] ERROR: hello world")

    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor._send_mail')
    def test_multiline_error(self, _send_mail):
        project = Project(id=1, name='Project Name')

        group = Group()
        group.first_seen = timezone.now()
        group.last_seen = group.first_seen
        group.project = project
        group.id = 2

        event = Event()
        event.group = group
        event.message = 'hello world\nfoo bar'
        event.logger = 'root'
        event.project = project
        event.date = group.last_seen

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.notify_users(group, event)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('subject'), u"[Project Name] ERROR: hello world")

    @mock.patch('sentry.utils.cache.cache.get', mock.Mock(return_value=None))
    @mock.patch('sentry.models.ProjectOption.objects.get_value')
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_sendable_users')
    @mock.patch('sentry.plugins.sentry_mail.models.MailProcessor.get_emails_for_users')
    def test_send_to(self, get_emails_for_users, get_sendable_users, get_value):
        opts = {}

        admins = ['1']
        member_emails = ['2', '3']
        project_emails = ['2', '4']

        get_value.side_effect = lambda p, k, d: opts.get(k, d)
        get_emails_for_users.side_effect = lambda x: x
        get_sendable_users.return_value = member_emails

        project = mock.Mock()
        project.id = 1
        project.pk = project.id

        with self.Settings(SENTRY_ADMINS=admins):
            p = MailProcessor()
            # member emails without admins
            self.assertEqual(sorted(set(member_emails)),
                             sorted(p.get_send_to(project)))

            # member emails with members
            opts = {'mail:send_to_admins': True}
            self.assertEqual(sorted(set(member_emails + admins)),
                             sorted(p.get_send_to(project)))

            # project emails without members
            opts = {'mail:send_to': ','.join(project_emails),
                    'mail:send_to_members': False}
            self.assertEqual(sorted(set(project_emails)),
                             sorted(p.get_send_to(project)))

            # project emails with members
            opts = {'mail:send_to': ','.join(project_emails),
                    'mail:send_to_members': False,
                    'mail:send_to_admins': True}
            self.assertEqual(sorted(set(project_emails + admins)),
                             sorted(p.get_send_to(project)))

            # project emails with members and admins
            opts = {'mail:send_to': ','.join(project_emails),
                    'mail:send_to_members': True,
                    'mail:send_to_admins': True}
            self.assertEqual(sorted(set(project_emails + admins + member_emails)),
                             sorted(p.get_send_to(project)))

    def test_get_emails_for_users(self):
        from django.contrib.auth.models import User
        from sentry.models import UserOption

        user = User.objects.create(username='foo', email='foo@example.com')
        user2 = User.objects.create(username='baz', email='baz@example.com')

        p = MailProcessor()

        self.assertEquals(sorted(p.get_emails_for_users([user.pk, user2.pk])),
                          sorted([user.email, user2.email]))
        UserOption.objects.create(key='alert_email', value='foobaz@example.com', user=user2)

        self.assertEquals(sorted(p.get_emails_for_users([user.pk, user2.pk])),
                          sorted([user.email, 'foobaz@example.com']))

    def test_get_sendable_users(self):
        from django.contrib.auth.models import User
        from sentry.models import Project, UserOption

        user = User.objects.create(username='foo', email='foo@example.com', is_active=True)
        user2 = User.objects.create(username='baz', email='baz@example.com', is_active=True)
        user3 = User.objects.create(username='bar', email='bar@example.com', is_active=False)
        project = Project.objects.create(name='Test', slug='test', owner=user)
        project.team.member_set.get_or_create(user=user)
        project.team.member_set.get_or_create(user=user2)
        project.team.member_set.get_or_create(user=user3)

        p = MailProcessor()

        # all members
        self.assertEqual(sorted(set([user.pk, user2.pk])),
                         sorted(p.get_sendable_users(project)))

        # disabled user2
        UserOption.objects.create(key='mail:alert', value=0, project=project, user=user2)
        self.assertEqual(sorted(set([user.pk])),
                         sorted(p.get_sendable_users(project)))
