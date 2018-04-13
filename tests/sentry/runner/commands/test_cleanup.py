# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from django.conf import settings

from sentry.models import Event, Group
from sentry.tagstore.models import GroupTagKey, GroupTagValue, TagValue
from sentry.runner.commands.cleanup import cleanup
from sentry.testutils import CliTestCase

ALL_MODELS = (Event, Group, GroupTagKey, GroupTagValue, TagValue)


class SentryCleanupTest(CliTestCase):
    fixtures = ['tests/fixtures/cleanup.json']

    if settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.legacy.LegacyTagStorage'):
        fixtures += ['tests/fixtures/cleanup-tagstore-legacy.json']
    elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.v2'):
        fixtures += ['tests/fixtures/cleanup-tagstore-v2.json']
    elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.multi'):
        fixtures += ['tests/fixtures/cleanup-tagstore-legacy.json',
                     'tests/fixtures/cleanup-tagstore-v2.json']
    elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.snuba'):
        pass
    else:
        raise NotImplementedError

    command = cleanup

    @pytest.mark.skipif(
        settings.SENTRY_TAGSTORE == 'sentry.tagstore.v2.V2TagStorage',
        reason='Cleanup is temporarily disabled for tagstore v2'
    )
    def test_simple(self):
        rv = self.invoke('--days=1')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0

    @pytest.mark.skipif(
        settings.SENTRY_TAGSTORE == 'sentry.tagstore.v2.V2TagStorage',
        reason='Cleanup is temporarily disabled for tagstore v2'
    )
    def test_project(self):
        orig_counts = {}
        for model in ALL_MODELS:
            count = model.objects.count()
            assert count > 0
            orig_counts[model] = count

        rv = self.invoke('--days=1', '--project=2')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == orig_counts[model]

        rv = self.invoke('--days=1', '--project=1')
        assert rv.exit_code == 0, rv.output

        for model in ALL_MODELS:
            assert model.objects.count() == 0
