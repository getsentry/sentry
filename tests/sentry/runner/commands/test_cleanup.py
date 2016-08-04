# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.core.files.base import ContentFile
from django.utils import timezone

from sentry.models import Event, Group, GroupTagValue, TagValue, TagKey, FileBlob
from sentry.runner.commands.cleanup import cleanup, cleanup_unused_files
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

    def test_cleanup(self):
        fileobj_old = ContentFile('foo')
        fileobj_new = ContentFile('bar')
        file_old = FileBlob.from_file(fileobj_old)
        file_new = FileBlob.from_file(fileobj_new)
        file_old.timestamp = timezone.now() - timedelta(days=100)
        file_new.timestamp = timezone.now()
        file_old.save()
        file_new.save()

        cleanup_unused_files()

        assert file_old not in FileBlob.objects.all()
        assert file_new in FileBlob.objects.all()
        assert 1 == len(FileBlob.objects.all())
