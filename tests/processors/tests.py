# -*- coding: utf-8 -*-

from __future__ import absolute_import, with_statement


from sentry.processors import Processor
from sentry.conf import settings

from tests.base import TestCase

from . import processor


class SentryProcessorsTest(TestCase):
    def setUp(self):
        self.orig_processors = settings.PROCESSORS
        Processor.objects.update((
            'tests.processors.processor.TestProcessor',
        ))
        processor.CALLED = 0

    def tearDown(self):
        settings.PROCESSORS = self.orig_processors
        Processor.objects.update(settings.PROCESSORS)

    def create_event(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)

    def test_processors_cache(self):
        # TODO: move these tests to base instance manager tests
        self.assertEqual(Processor.objects.cache, None)

        # ensure cache gets updated after all() is called
        self.assertEqual(len(Processor.objects.all()), 1)
        self.assertEqual(len(Processor.objects.cache), 1)

        Processor.objects.cache = None

        # ensure cache gets updated after create event
        self.create_event()
        self.assertEqual(len(Processor.objects.cache), 1)

    def test_processors_called(self):
        self.create_event()
        self.create_event()
        proc_list = Processor.objects.all()
        self.assertEqual(len(proc_list), 1)
        self.assertEqual(proc_list[0].called, 2)
