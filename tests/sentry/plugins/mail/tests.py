# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import datetime
from mock import Mock
from sentry.interfaces import Stacktrace
from sentry.models import Event, Group
from sentry.plugins.sentry_mail import MailProcessor

from tests.base import TestCase


class MailProcessorTest(TestCase):
    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.MailProcessor.get_send_to', Mock(return_value=[]))
    def test_should_mail_no_send_to(self):
        p = MailProcessor()
        self.assertFalse(p.should_mail(group=Mock(), event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_mail_not_min_level(self):
        p = MailProcessor(min_level=2)
        group = Mock(spec=Group)
        group.level = 1
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_mail_not_included(self):
        p = MailProcessor(min_level=None, include_loggers=['foo'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_mail_excluded(self):
        p = MailProcessor(min_level=None, exclude_loggers=['root'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.MailProcessor.get_send_to', Mock(return_value=['foo@example.com']))
    def test_should_mail_match(self):
        p = MailProcessor(min_level=None)
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertTrue(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.plugins.sentry_mail.MailProcessor._send_mail')
    def test_mail_members_renders_interfaces(self, _send_mail):
        group = Mock(spec=Group)
        group.first_seen = datetime.datetime.now()
        group.get_absolute_url.return_value = '/example'
        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_string.return_value = 'foo bar'
        stacktrace.get_title.return_value = 'Stacktrace'
        event = Event()
        event.message = 'hello world'
        event.logger = 'root'
        event.site = None
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            p = MailProcessor(send_to=['foo@example.com'])
            p.mail_members(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_string.assert_called_once_with(event)

    def test_send_to(self):
        Mock = mock.Mock
        with mock.patch('sentry.models.ProjectOption.objects.get_value') as get_value:
            opts = {}
            get_value.side_effect = lambda p, k, d: opts.get(k, d)

            admins = ['admin@fake.com']
            member_emails = ['test@fake.com', 'member@fake.com']
            project_emails = ['member@fake.com', 'new@fake.com']

            project = Mock()
            project.member_set = Mock()
            project.member_set.values_list.return_value = member_emails

            with mock.patch('sentry.plugins.sentry_mail.settings') as settings:
                settings.ADMINS = admins

                # member emails without admins
                p = MailProcessor()
                self.assertEqual(sorted(set(member_emails)),
                                 sorted(p.get_send_to(project)))

                # member emails with members
                p = MailProcessor()
                opts = {'mail:send_to_admins': True}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(member_emails + admins)),
                                 sorted(p.get_send_to(project)))

                # project emails without members
                p = MailProcessor()
                opts = {'mail:send_to': ','.join(project_emails),
                        'mail:send_to_members': False}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(project_emails)),
                                 sorted(p.get_send_to(project)))

                # project emails with members
                p = MailProcessor()
                opts = {'mail:send_to': ','.join(project_emails),
                        'mail:send_to_members': False,
                        'mail:send_to_admins': True}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(project_emails + admins)),
                                 sorted(p.get_send_to(project)))

                # project emails with members and admins
                p = MailProcessor()
                opts = {'mail:send_to': ','.join(project_emails),
                        'mail:send_to_members': True,
                        'mail:send_to_admins': True}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(project_emails + admins + member_emails)),
                                 sorted(p.get_send_to(project)))
