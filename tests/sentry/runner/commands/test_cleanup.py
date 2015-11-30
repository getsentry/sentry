# -*- coding: utf-8 -*-

from __future__ import absolute_import

from click.testing import CliRunner
from exam import fixture

from sentry.models import Event, Group, GroupTagValue, TagValue, TagKey
from sentry.runner.commands.cleanup import cleanup
from sentry.testutils import TestCase

ALL_MODELS = (Event, Group, GroupTagValue, TagValue, TagKey)


class SentryCleanupTest(TestCase):
    fixtures = ['tests/fixtures/cleanup.json']

    runner = fixture(CliRunner)

    def test_simple(self):
        rv = self.runner.invoke(cleanup, ['--days=1'])
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0

    def test_project(self):
        orig_counts = {}
        for model in ALL_MODELS:
            orig_counts[model] = model.objects.count()

        rv = self.runner.invoke(cleanup, ['--days=1', '--project=2'])
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == orig_counts[model]

        rv = self.runner.invoke(cleanup, ['--days=1', '--project=1'])
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0
