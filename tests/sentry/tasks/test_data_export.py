from __future__ import absolute_import

import six

from sentry.models import ExportedData, File
from sentry.tasks.data_export import assemble_download, get_file_name, DataExportError
from sentry.testutils import TestCase, SnubaTestCase
from sentry.utils.compat.mock import patch


class AssembleDownloadTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(AssembleDownloadTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project()
        self.event = self.store_event(
            data={"tags": {"foo": "bar"}, "fingerprint": ["group-1"]}, project_id=self.project.id
        )
        self.store_event(
            data={"tags": {"foo": "bar2"}, "fingerprint": ["group-1"]}, project_id=self.project.id
        )
        self.store_event(
            data={"tags": {"foo": "bar2"}, "fingerprint": ["group-1"]}, project_id=self.project.id
        )

    def test_task_persistent_name(self):
        assert assemble_download.name == "sentry.tasks.data_export.assemble_download"

    def test_get_file_name(self):
        file_name = get_file_name("TESTING", "proj1_user1_test", "ext")
        assert file_name == "TESTING-proj1_user1_test.ext"
        file_name = get_file_name("TESTING", "proj1_user1_test")
        assert file_name == "TESTING-proj1_user1_test.csv"

    def test_issue_by_tag(self):
        de1 = ExportedData.objects.create(
            user=self.user,
            organization=self.org,
            query_type=0,
            query_info={
                "project_id": self.project.id,
                "group_id": self.event.group_id,
                "key": "user",
            },
        )
        with self.tasks():
            assemble_download(de1.id)
        de1 = ExportedData.objects.get(id=de1.id)
        assert de1.date_finished is not None
        assert de1.date_expired is not None
        assert de1.file is not None
        f1 = de1.file
        assert isinstance(f1, File)
        assert f1.headers == {"Content-Type": "text/csv"}
        raw1 = f1.getfile().read()
        assert raw1 == "value,id,email,username,ip_address,times_seen,last_seen,first_seen\r\n"
        de2 = ExportedData.objects.create(
            user=self.user,
            organization=self.org,
            query_type=0,
            query_info={
                "project_id": self.project.id,
                "group_id": self.event.group_id,
                "key": "foo",
            },
        )
        with self.tasks():
            assemble_download(de2.id)
        de2 = ExportedData.objects.get(id=de2.id)
        # Convert raw csv to list of line-strings
        header, raw1, raw2 = de2.file.getfile().read().strip().split("\r\n")
        assert header == "value,times_seen,last_seen,first_seen"

        raw1, raw2 = sorted([raw1, raw2])
        assert raw1.startswith("bar,1,")
        assert raw2.startswith("bar2,2,")

    @patch("sentry.models.ExportedData.email_failure")
    def test_issue_by_tag_errors(self, emailer):
        de1 = ExportedData.objects.create(
            user=self.user,
            organization=self.org,
            query_type=0,
            query_info={"project_id": -1, "group_id": self.event.group_id, "key": "user"},
        )
        with self.tasks():
            assemble_download(de1.id)
        error = emailer.call_args[1]["message"]
        assert isinstance(error, DataExportError)
        assert six.text_type(error) == u"Requested project does not exist"
        de2 = ExportedData.objects.create(
            user=self.user,
            organization=self.org,
            query_type=0,
            query_info={"project_id": self.project.id, "group_id": -1, "key": "user"},
        )
        with self.tasks():
            assemble_download(de2.id)
        error = emailer.call_args[1]["message"]
        assert isinstance(error, DataExportError)
        assert six.text_type(error) == u"Requested issue does not exist"
