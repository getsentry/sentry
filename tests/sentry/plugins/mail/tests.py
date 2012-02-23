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

                # member emails with admins
                p = MailProcessor()
                opts = {'mail:send_to_admins': True}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(member_emails + admins)),
                                 sorted(p.get_send_to(project)))

                # project emails without admins
                p = MailProcessor()
                opts = {'mail:send_to': ','.join(project_emails)}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(project_emails)),
                                 sorted(p.get_send_to(project)))

                # project emails with admins
                p = MailProcessor()
                opts = {'mail:send_to': ','.join(project_emails),
                        'mail:send_to_admins': True}
                p._send_mail('', '', project=project)
                self.assertEqual(sorted(set(project_emails + admins)),
                                 sorted(p.get_send_to(project)))
