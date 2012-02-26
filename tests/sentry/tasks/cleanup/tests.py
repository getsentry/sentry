# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from sentry.models import Event, Group, MessageCountByMinute, \
  MessageFilterValue
from sentry.tasks.cleanup import cleanup
from tests.base import TestCase


class SentryCleanupTest(TestCase):
    fixtures = ['tests/fixtures/cleanup.json']

    def test_simple(self):
        cleanup(days=1)

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_logger(self):
        cleanup(days=1, logger='sentry')

        self.assertEquals(Event.objects.count(), 8)
        for message in Event.objects.all():
            self.assertNotEquals(message.logger, 'sentry')
        self.assertEquals(Group.objects.count(), 3)
        for message in Group.objects.all():
            self.assertNotEquals(message.logger, 'sentry')

        cleanup(days=1, logger='awesome')

        self.assertEquals(Event.objects.count(), 4)
        for message in Event.objects.all():
            self.assertNotEquals(message.logger, 'awesome')
        self.assertEquals(Group.objects.count(), 2)
        for message in Group.objects.all():
            self.assertNotEquals(message.logger, 'awesome')

        cleanup(days=1, logger='root')

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_server_name(self):
        cleanup(days=1, server='dcramer.local')

        self.assertEquals(Event.objects.count(), 2)
        for message in Event.objects.all():
            self.assertNotEquals(message.server_name, 'dcramer.local')
        self.assertEquals(Group.objects.count(), 1)

        cleanup(days=1, server='node.local')

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_level(self):
        cleanup(days=1, level=logging.ERROR)

        self.assertEquals(Event.objects.count(), 1)
        for message in Event.objects.all():
            self.assertNotEquals(message.level, logging.ERROR)
        self.assertEquals(Group.objects.count(), 1)

        cleanup(days=1, level=logging.DEBUG)

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)
