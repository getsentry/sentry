# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Event, Group, GroupTagValue, TagValue, TagKey
from sentry.runner.commands.cleanup import cleanup
from sentry.testutils import CliTestCase

ALL_MODELS = (Event, Group, GroupTagValue, TagValue, TagKey)


class SentryCleanupTest(CliTestCase):
    fixtures = ['tests/fixtures/cleanup.json']
    command = cleanup

    def test_simple(self):
        rv = self.invoke('--days=1')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0

    def test_project(self):
        orig_counts = {}
        for model in ALL_MODELS:
            orig_counts[model] = model.objects.count()

        rv = self.invoke('--days=1', '--project=2')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == orig_counts[model]

        rv = self.invoke('--days=1', '--project=1')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0
