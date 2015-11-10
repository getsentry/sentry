from __future__ import absolute_import

from django.conf import settings
from django.core.files.base import ContentFile

from sentry.models import FileBlob
from sentry.testutils import TestCase


class FileBlobTest(TestCase):
    def test_from_file(self):
        fileobj = ContentFile("foo bar")

        my_file1 = FileBlob.from_file(fileobj)

        assert my_file1.path
        assert my_file1.storage == settings.SENTRY_FILESTORE

        my_file2 = FileBlob.from_file(fileobj)
        assert my_file1 == my_file2
