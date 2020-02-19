from __future__ import absolute_import

import tempfile
from datetime import timedelta

from sentry.models import ExportedData, File
from sentry.testutils import TestCase


class DeleteExportedDataTest(TestCase):
    def setUp(self):
        super(DeleteExportedDataTest, self).setUp()
        self.user = self.create_user()
        self.organization = self.create_organization()
        self.data_export = ExportedData.objects.create(
            user=self.user, organization=self.organization, query_type=2, query_info={"env": "test"}
        )
        self.file1 = File.objects.create(
            name="tempfile-data-export", type="export.csv", headers={"Content-Type": "text/csv"}
        )
        self.file2 = File.objects.create(
            name="tempfile-data-export", type="export.csv", headers={"Content-Type": "text/csv"}
        )

    def test_delete_file(self):
        # Empty call should have no effect
        assert self.data_export.file is None
        self.data_export.delete_file()
        assert self.data_export.file is None
        # Real call should delete the file
        assert File.objects.filter(id=self.file1.id).exists()
        self.data_export.update(file=self.file1)
        assert isinstance(self.data_export.file, File)
        self.data_export.delete_file()
        assert not File.objects.filter(id=self.file1.id).exists()

    def test_delete(self):
        self.data_export.finalize_upload(file=self.file1)
        assert ExportedData.objects.filter(id=self.data_export.id).exists()
        assert File.objects.filter(id=self.file1.id).exists()
        self.data_export.delete()
        assert not ExportedData.objects.filter(id=self.data_export.id).exists()
        assert not File.objects.filter(id=self.file1.id).exists()

    def test_finalize_upload(self):
        TEST_STRING = "A bunch of test data..."
        DEFAULT_EXPIRATION = timedelta(weeks=4)  # Matches src/sentry/models/exporteddata.py
        # With default expiration
        with tempfile.TemporaryFile() as tf:
            tf.write(TEST_STRING)
            tf.seek(0)
            self.file1.putfile(tf)
        self.data_export.finalize_upload(file=self.file1)
        assert self.data_export.file.getfile().read() == TEST_STRING
        assert self.data_export.date_finished is not None
        assert self.data_export.date_expired is not None
        assert self.data_export.date_expired == self.data_export.date_finished + DEFAULT_EXPIRATION
        # With custom expiration
        with tempfile.TemporaryFile() as tf:
            tf.write(TEST_STRING + TEST_STRING)
            tf.seek(0)
            self.file2.putfile(tf)
        self.data_export.finalize_upload(file=self.file2, expiration=timedelta(weeks=2))
        assert self.data_export.file.getfile().read() == TEST_STRING + TEST_STRING
        # Ensure the first file is deleted
        assert not File.objects.filter(id=self.file1.id).exists()
        assert self.data_export.date_expired == self.data_export.date_finished + timedelta(weeks=2)
