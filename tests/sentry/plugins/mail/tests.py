# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core import mail
from django.utils import timezone
from exam import fixture
from mock import Mock

from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import AccessGroup, Alert, Event, Group, Rule
from sentry.plugins import Notification
from sentry.plugins.sentry_mail.models import MailPlugin
from sentry.testutils import TestCase


class MailPluginTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin.get_sendable_users', Mock(return_value=[]))
    def test_should_notify_no_sendable_users(self):
        assert not self.plugin.should_notify(group=Mock(), event=Mock())

    def test_simple_notification(self):
        group = self.create_group(message='Hello world')
        event = self.create_event(group=group, message='Hello world')

        rule = Rule.objects.create(project=self.project, label='my rule')

        notification = Notification(event=event, rule=rule)

        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify(notification)

        msg = mail.outbox[0]
        assert msg.subject == '[Sentry] [foo Bar] ERROR: Hello world'
        print dir(msg)
        assert 'my rule' in msg.alternatives[0][0]

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
        event.project = self.project
        event.message = 'hello world'
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        notification = Notification(event=event)

        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify(notification)

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
        event.project = self.project
        event.message = 'Soubor ji\xc5\xbe existuje'
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        notification = Notification(event=event)

        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify(notification)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_does_email(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message='hello world',
            logger='root',
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
        )

        notification = Notification(event=event)

        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify(notification)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('project'), self.project)
        self.assertEquals(kwargs.get('group'), group)
        assert kwargs.get('subject') == u"[{0} {1}] ERROR: hello world".format(
            self.team.name, self.project.name)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_multiline_error(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message='hello world\nfoo bar',
            logger='root',
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
        )

        notification = Notification(event=event)

        with self.settings(SENTRY_URL_PREFIX='http://example.com'):
            self.plugin.notify(notification)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u"[{0} {1}] ERROR: hello world".format(
            self.team.name, self.project.name)

    def test_get_sendable_users(self):
        from sentry.models import UserOption, User

        user = self.create_user(email='foo@example.com', is_active=True)
        user2 = self.create_user(email='baz@example.com', is_active=True)
        user3 = self.create_user(email='baz2@example.com', is_active=True)

        # user with inactive account
        self.create_user(email='bar@example.com', is_active=False)
        # user not in any groups
        self.create_user(email='bar2@example.com', is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        project = self.create_project(name='Test', team=team)
        organization.member_set.get_or_create(user=user)
        organization.member_set.get_or_create(user=user2)

        ag = AccessGroup.objects.create(team=team)
        ag.members.add(user3)
        ag.projects.add(project)

        # all members
        assert (sorted(set([user.pk, user2.pk, user3.pk])) ==
                sorted(self.plugin.get_sendable_users(project)))

        # disabled user2
        UserOption.objects.create(key='mail:alert', value=0,
                                  project=project, user=user2)

        assert user2.pk not in self.plugin.get_sendable_users(project)

        user4 = User.objects.create(username='baz4', email='bar@example.com',
                                    is_active=True)
        organization.member_set.get_or_create(user=user4)

        assert user4.pk in self.plugin.get_sendable_users(project)

        # disabled by default user4
        uo1 = UserOption.objects.create(key='subscribe_by_default', value='0',
                                  project=project, user=user4)

        assert user4.pk not in self.plugin.get_sendable_users(project)

        uo1.delete()

        UserOption.objects.create(key='subscribe_by_default', value=u'0',
                                  project=project, user=user4)

        assert user4.pk not in self.plugin.get_sendable_users(project)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_on_alert(self, _send_mail):
        alert = Alert.objects.create(message='This is a test alert', project=self.project)

        self.plugin.on_alert(alert=alert)

        _send_mail.assert_called_once()
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u"[{0} {1}] ALERT: {2}".format(
            self.team.name, self.project.name, alert.message)
