# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.management import call_command

from sentry.models import Event, Group, GroupTagValue, TagValue, TagKey
from sentry.testutils import TestCase

ALL_MODELS = (Event, Group, GroupTagValue, TagValue, TagKey)


class SentryCleanupTest(TestCase):
    fixtures = ['tests/fixtures/cleanup.json']

    def test_simple(self):
        call_command('cleanup', days=1)

        for model in ALL_MODELS:
            assert model.objects.count() == 0

    def test_project(self):
        orig_counts = {}
        for model in ALL_MODELS:
            orig_counts[model] = model.objects.count()

        call_command('cleanup', days=1, project=2)

        for model in ALL_MODELS:
            assert model.objects.count() == orig_counts[model]

        call_command('cleanup', days=1, project=1)

        for model in ALL_MODELS:
            assert model.objects.count() == 0
