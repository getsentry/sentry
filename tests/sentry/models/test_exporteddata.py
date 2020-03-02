from __future__ import absolute_import

import six
import json
import tempfile
from datetime import timedelta
from django.core import mail
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import ExportedData, File
from sentry.models.exporteddata import DEFAULT_EXPIRATION, ExportStatus
from sentry.testutils import TestCase
from sentry.utils.http import absolute_uri
from sentry.utils.compat.mock import patch


class ExportedDataTest(TestCase):
    TEST_STRING = "A bunch of test data..."

    def setUp(self):
        super(ExportedDataTest, self).setUp()
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

    def test_status_property(self):
        assert self.data_export.status == ExportStatus.Early
        self.data_export.update(
            date_expired=timezone.now() + timedelta(weeks=2),
            date_finished=timezone.now() - timedelta(weeks=2),
        )
        assert self.data_export.status == ExportStatus.Valid
        self.data_export.update(date_expired=timezone.now() - timedelta(weeks=1))
        assert self.data_export.status == ExportStatus.Expired

    def test_date_expired_string_property(self):
        assert self.data_export.date_expired_string is None
        current_time = timezone.now()
        self.data_export.update(date_expired=current_time)
        assert isinstance(self.data_export.date_expired_string, six.binary_type)

    def test_payload_property(self):
        assert isinstance(self.data_export.payload, dict)
        keys = self.data_export.query_info.keys() + ["export_type"]
        assert sorted(self.data_export.payload.keys()) == sorted(keys)

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
        # The ExportedData should be unaffected
        assert ExportedData.objects.filter(id=self.data_export.id).exists()
        assert ExportedData.objects.get(id=self.data_export.id).file is None

    def test_delete(self):
        self.data_export.finalize_upload(file=self.file1)
        assert ExportedData.objects.filter(id=self.data_export.id).exists()
        assert File.objects.filter(id=self.file1.id).exists()
        self.data_export.delete()
        assert not ExportedData.objects.filter(id=self.data_export.id).exists()
        assert not File.objects.filter(id=self.file1.id).exists()

    def test_finalize_upload(self):
        # With default expiration
        with tempfile.TemporaryFile() as tf:
            tf.write(self.TEST_STRING)
            tf.seek(0)
            self.file1.putfile(tf)
        self.data_export.finalize_upload(file=self.file1)
        assert self.data_export.file.getfile().read() == self.TEST_STRING
        assert self.data_export.date_finished is not None
        assert self.data_export.date_expired is not None
        assert self.data_export.date_expired == self.data_export.date_finished + DEFAULT_EXPIRATION
        # With custom expiration
        with tempfile.TemporaryFile() as tf:
            tf.write(self.TEST_STRING + self.TEST_STRING)
            tf.seek(0)
            self.file2.putfile(tf)
        self.data_export.finalize_upload(file=self.file2, expiration=timedelta(weeks=2))
        assert self.data_export.file.getfile().read() == self.TEST_STRING + self.TEST_STRING
        # Ensure the first file is deleted
        assert not File.objects.filter(id=self.file1.id).exists()
        assert self.data_export.date_expired == self.data_export.date_finished + timedelta(weeks=2)

    def test_email_success(self):
        # Shouldn't send if ExportedData is incomplete
        with self.tasks():
            self.data_export.email_success()
        assert len(mail.outbox) == 0
        # Should send one email if complete
        self.data_export.finalize_upload(file=self.file1)
        with self.tasks():
            self.data_export.email_success()
        assert len(mail.outbox) == 1

    @patch("sentry.utils.email.MessageBuilder")
    def test_email_success_content(self, builder):
        self.data_export.finalize_upload(file=self.file1)
        with self.tasks():
            self.data_export.email_success()
        expected_url = absolute_uri(
            reverse(
                "sentry-data-export-details", args=[self.organization.slug, self.data_export.id]
            )
        )
        expected_email_args = {
            "subject": "Your Download is Ready!",
            "context": {"url": expected_url, "expiration": self.data_export.date_expired_string},
            "template": "sentry/emails/data-export-success.txt",
            "html_template": "sentry/emails/data-export-success.html",
        }
        builder.assert_called_with(**expected_email_args)

    def test_email_failure(self):
        with self.tasks():
            self.data_export.email_failure(self.TEST_STRING)
        assert len(mail.outbox) == 1
        assert not ExportedData.objects.filter(id=self.data_export.id).exists()

    @patch("sentry.utils.email.MessageBuilder")
    def test_email_failure_content(self, builder):
        with self.tasks():
            self.data_export.email_failure(self.TEST_STRING)
        expected_email_args = {
            "subject": "Unable to Export Data",
            "type": "organization.export-data",
            "context": {
                "error_message": self.TEST_STRING,
                "payload": json.dumps(self.data_export.payload, indent=2, sort_keys=True),
            },
            "template": "sentry/emails/data-export-failure.txt",
            "html_template": "sentry/emails/data-export-failure.html",
        }
        builder.assert_called_with(**expected_email_args)
