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
    def test_should_mail_no_send_to(self):
        p = MailProcessor(send_to=())
        self.assertFalse(p.should_mail(group=Mock(), event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    def test_should_mail_not_min_level(self):
        p = MailProcessor(send_to=['foo@exampe.com'], min_level=2)
        group = Mock(spec=Group)
        group.level = 1
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    def test_should_mail_not_included(self):
        p = MailProcessor(send_to=['foo@exampe.com'], min_level=None, include_loggers=['foo'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    def test_should_mail_excluded(self):
        p = MailProcessor(send_to=['foo@exampe.com'], min_level=None, exclude_loggers=['root'])
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertFalse(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    def test_should_mail_match(self):
        p = MailProcessor(send_to=['foo@exampe.com'], min_level=None)
        group = Mock(spec=Group)
        group.level = 5
        group.logger = 'root'
        self.assertTrue(p.should_mail(group=group, event=Mock()))

    @mock.patch('sentry.plugins.sentry_mail.MailProcessor._send_mail')
    def test_mail_admins_renders_interfaces(self, _send_mail):
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
            p.mail_admins(group, event)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_string.assert_called_once_with(event)
