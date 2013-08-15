# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from mock import Mock
from django.utils import timezone
from sentry.interfaces import Stacktrace
from sentry.models import Alert, Event, Group, AccessGroup
from sentry.plugins.sentry_mail.models import MailPlugin
from sentry.testutils import TestCase, fixture


class MailPluginTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin.get_sendable_users', Mock(return_value=[]))
    def test_should_notify_no_sendable_users(self):
        assert not self.plugin.should_notify(group=Mock(), event=Mock())

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_renders_interfaces(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_email_html.return_value = 'foo bar'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'hello world'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_renders_interfaces_with_utf8(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_email_html.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'hello world'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_renders_interfaces_with_utf8_fix_issue_422(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_email_html.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.message = 'Soubor ji\xc5\xbe existuje'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify_users(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_does_email(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        event = Event(
            group=group,
            message='hello world',
            logger='root',
            project=self.project,
            datetime=group.last_seen,
        )

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify_users(group, event)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('fail_silently'), False)
        self.assertEquals(kwargs.get('project'), self.project)
        assert kwargs.get('subject') == u"[{0}] ERROR: hello world".format(self.project.name)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_multiline_error(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        event = Event(
            group=group,
            message='hello world\nfoo bar',
            logger='root',
            project=self.project,
            datetime=group.last_seen,
        )

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify_users(group, event)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u"[{0}] ERROR: hello world".format(self.project.name)

    def test_get_emails_for_users(self):
        from sentry.models import UserOption, User

        project = self.project

        user = User.objects.create(username='foo', email='foo@example.com')
        user2 = User.objects.create(username='baz', email='baz@example.com')
        user3 = User.objects.create(username='bar', email='bar@example.com')

        result = sorted(self.plugin.get_emails_for_users([user.pk, user2.pk, user3.pk]))
        assert result == sorted([user.email, user2.email, user3.email])

        UserOption.objects.create(
            key='alert_email', value='foobaz@example.com', user=user2)
        UserOption.objects.create(
            key='mail:email', value='foobar@example.com', user=user3, project=project)

        result = sorted(self.plugin.get_emails_for_users(
            [user.pk, user2.pk, user3.pk], project=project))
        assert result == sorted([user.email, 'foobar@example.com', 'foobaz@example.com'])

    def test_get_sendable_users(self):
        from sentry.models import Project, UserOption, User

        user = User.objects.create(username='foo', email='foo@example.com', is_active=True)
        user2 = User.objects.create(username='baz', email='baz@example.com', is_active=True)
        user3 = User.objects.create(username='baz2', email='bar@example.com', is_active=True)

        # user with inactive account
        User.objects.create(username='bar', email='bar@example.com', is_active=False)
        # user not in any groups
        User.objects.create(username='bar2', email='bar@example.com', is_active=True)

        project = Project.objects.create(name='Test', slug='test', owner=user)
        project.team.member_set.get_or_create(user=user)
        project.team.member_set.get_or_create(user=user2)

        ag = AccessGroup.objects.create(team=project.team)
        ag.members.add(user3)
        ag.projects.add(project)

        # all members
        assert (sorted(set([user.pk, user2.pk, user3.pk])) ==
                sorted(self.plugin.get_sendable_users(project)))

        # disabled user2
        UserOption.objects.create(key='mail:alert', value=0, project=project, user=user2)

        assert user2.pk not in self.plugin.get_sendable_users(project)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_on_alert(self, _send_mail):
        alert = Alert.objects.create(message='This is a test alert', project=self.project)

        self.plugin.on_alert(alert=alert)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u"[{0}] ALERT: {1}".format(
            self.project.name, alert.message)
