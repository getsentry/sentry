# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from sentry.plugins.sentry_mail import MailProcessor

from tests.base import TestCase


class MailProcessorTest(TestCase):
    def test_should_mail(self):
        Mock = mock.Mock
        with mock.patch('sentry.models.ProjectOption.objects.get_value') as get_value:
            get_value.side_effect = lambda p, k, d: d

            # no admins
            p = MailProcessor(send_to=())
            self.assertFalse(p.should_mail(group=Mock(), event=Mock()))

            # not min level
            p = MailProcessor(send_to=['foo@exampe.com'], min_level=2)
            group = Mock()
            group.level = 1
            self.assertFalse(p.should_mail(group=group, event=Mock()))

            # not in inclusion
            p = MailProcessor(send_to=['foo@exampe.com'], min_level=None, include_loggers=['foo'])
            group = Mock()
            group.level = 5
            group.logger = 'root'
            self.assertFalse(p.should_mail(group=group, event=Mock()))

            # in exclusion
            p = MailProcessor(send_to=['foo@exampe.com'], min_level=None, exclude_loggers=['root'])
            group = Mock()
            group.level = 5
            group.logger = 'root'
            self.assertFalse(p.should_mail(group=group, event=Mock()))

            # in exclusion
            p = MailProcessor(send_to=['foo@exampe.com'], min_level=None)
            group = Mock()
            group.level = 5
            group.logger = 'root'
            self.assertTrue(p.should_mail(group=group, event=Mock()))
