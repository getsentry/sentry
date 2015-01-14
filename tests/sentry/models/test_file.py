from __future__ import absolute_import

from django.conf import settings
from django.core.files.base import ContentFile

from sentry.models import File
from sentry.testutils import TestCase


class FileTest(TestCase):
    def test_putfile(self):
        fileobj = ContentFile("foo bar")

        my_file = File(name='app.dsym', type='release.artifact')
        my_file.putfile(fileobj, commit=False)
        my_file.save()

        assert my_file.path
        assert my_file.storage == settings.SENTRY_FILESTORE

        with self.assertRaises(Exception):
            my_file.putfile(fileobj, commit=False)
