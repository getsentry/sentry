from unittest.mock import patch

from django.db import IntegrityError

from sentry.data_export.base import ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.data_export.tasks import assemble_download, merge_export_blobs
from sentry.exceptions import InvalidSearchQuery
from sentry.models import File
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data
from sentry.utils.snuba import (
    DatasetSelectionError,
    QueryConnectionFailed,
    QueryExecutionError,
    QueryExecutionTimeMaximum,
    QueryIllegalTypeOfArgument,
    QueryMemoryLimitExceeded,
    QueryOutsideRetentionError,
    QuerySizeExceeded,
    QueryTooManySimultaneous,
    RateLimitExceeded,
    SchemaValidationError,
    SnubaError,
    UnqualifiedQueryError,
)


@region_silo_test(stable=True)
class AssembleDownloadTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.event = self.store_event(
            data={
                "tags": {"foo": "bar"},
                "fingerprint": ["group-1"],
                "timestamp": iso_format(before_now(minutes=3)),
                "environment": "dev",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "tags": {"foo": "bar2"},
                "fingerprint": ["group-1"],
                "timestamp": iso_format(before_now(minutes=2)),
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "tags": {"foo": "bar2"},
                "fingerprint": ["group-1"],
                "timestamp": iso_format(before_now(minutes=1)),
                "environment": "prod",
            },
            project_id=self.project.id,
        )

    def test_task_persistent_name(self):
        assert assemble_download.name == "sentry.data_export.tasks.assemble_download"

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_issue_by_tag_batched(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [self.project.id], "group": self.event.group_id, "key": "foo"},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2 = f.read().strip().split(b"\r\n")
        assert header == b"value,times_seen,last_seen,first_seen"

        raw1, raw2 = sorted([raw1, raw2])
        assert raw1.startswith(b"bar,1,")
        assert raw2.startswith(b"bar2,2,")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_no_error_on_retry(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [self.project.id], "group": self.event.group_id, "key": "foo"},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
            # rerunning the export should not be problematic and produce the same results
            # this can happen when a batch is interrupted and has to be retried
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2 = f.read().strip().split(b"\r\n")
        assert header == b"value,times_seen,last_seen,first_seen"

        raw1, raw2 = sorted([raw1, raw2])
        assert raw1.startswith(b"bar,1,")
        assert raw2.startswith(b"bar2,2,")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_issue_by_tag_missing_key(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [self.project.id], "group": self.event.group_id, "key": "bar"},
        )
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Requested key does not exist"

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_issue_by_tag_missing_project(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [-1], "group": self.event.group_id, "key": "user"},
        )
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Requested project does not exist"

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_issue_by_tag_missing_issue(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [self.project.id], "group": -1, "key": "user"},
        )
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Requested issue does not exist"

    @patch("sentry.tagstore.get_tag_key")
    @patch("sentry.utils.snuba.raw_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_issue_by_tag_outside_retention(self, emailer, mock_query, mock_get_tag_key):
        """
        When an issues by tag query goes outside the retention range, it returns 0 results.
        This gives us an empty CSV with just the headers.
        """
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.ISSUES_BY_TAG,
            query_info={"project": [self.project.id], "group": self.event.group_id, "key": "foo"},
        )

        mock_query.side_effect = QueryOutsideRetentionError("test")
        with self.tasks():
            assemble_download(de.id)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header = f.read().strip()
        assert header == b"value,times_seen,last_seen,first_seen"

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_batched(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2, raw3 = f.read().strip().split(b"\r\n")
        assert header == b"title"

        assert raw1.startswith(b"<unlabeled event>")
        assert raw2.startswith(b"<unlabeled event>")
        assert raw3.startswith(b"<unlabeled event>")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_respects_selected_environment(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={
                "project": [self.project.id],
                "environment": "prod",
                "field": ["title"],
                "query": "",
            },
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2 = f.read().strip().split(b"\r\n")
        assert header == b"title"

        assert raw1.startswith(b"<unlabeled event>")
        assert raw2.startswith(b"<unlabeled event>")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_respects_selected_environment_multiple(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={
                "project": [self.project.id],
                "environment": ["prod", "dev"],
                "field": ["title"],
                "query": "",
            },
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2, raw3 = f.read().strip().split(b"\r\n")
        assert header == b"title"

        assert raw1.startswith(b"<unlabeled event>")
        assert raw2.startswith(b"<unlabeled event>")
        assert raw3.startswith(b"<unlabeled event>")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_missing_environment(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={
                "project": [self.project.id],
                "environment": "fake",
                "field": ["title"],
                "query": "",
            },
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        error = emailer.call_args[1]["message"]
        assert error == "Requested environment does not exist"

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_missing_project(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [-1], "group": self.event.group_id, "key": "user"},
        )
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Requested project does not exist"

    @patch("sentry.data_export.tasks.MAX_BATCH_SIZE", 35)
    @patch("sentry.data_export.tasks.MAX_FILE_SIZE", 55)
    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_export_file_too_large(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        # capping MAX_FILE_SIZE forces the last batch to be dropped, leaving 2 rows
        with file.getfile() as f:
            header, raw1, raw2 = f.read().strip().split(b"\r\n")
        assert header == b"title"

        assert raw1.startswith(b"<unlabeled event>")
        assert raw2.startswith(b"<unlabeled event>")

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_export_too_many_rows(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        with self.tasks():
            assemble_download(de.id, export_limit=2)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        # capping MAX_FILE_SIZE forces the last batch to be dropped, leaving 2 rows
        with file.getfile() as f:
            header, raw1, raw2 = f.read().strip().split(b"\r\n")
        assert header == b"title"

        assert raw1.startswith(b"<unlabeled event>")
        assert raw2.startswith(b"<unlabeled event>")

        assert emailer.called

    @patch("sentry.search.events.builder.discover.raw_snql_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_outside_retention(self, emailer, mock_query):
        """
        When a discover query goes outside the retention range, email the user they should
        use a more recent date range.
        """
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )

        mock_query.side_effect = QueryOutsideRetentionError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid date range. Please try a more recent date range."

        # unicode
        mock_query.side_effect = QueryOutsideRetentionError("\xfc")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid date range. Please try a more recent date range."

    @patch("sentry.snuba.discover.query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_invalid_search_query(self, emailer, mock_query):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )

        mock_query.side_effect = InvalidSearchQuery("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Please fix the query and try again."

        # unicode
        mock_query.side_effect = InvalidSearchQuery("\xfc")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Please fix the query and try again."

    @patch("sentry.search.events.builder.discover.raw_snql_query")
    def test_retries_on_recoverable_snuba_errors(self, mock_query):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        mock_query.side_effect = [
            QueryMemoryLimitExceeded("test"),
            {
                "data": [{"count": 3}],
                "meta": [{"name": "count", "type": "UInt64"}],
            },
        ]
        with self.tasks():
            assemble_download(de.id, count_down=0)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)
        file = de._get_file()
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        with file.getfile() as f:
            header, row = f.read().strip().split(b"\r\n")

    @patch("sentry.search.events.builder.discover.raw_snql_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_snuba_error(self, emailer, mock_query):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )

        mock_query.side_effect = QueryIllegalTypeOfArgument("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Argument to function is wrong type."

        # unicode
        mock_query.side_effect = QueryIllegalTypeOfArgument("\xfc")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Argument to function is wrong type."

        mock_query.side_effect = SnubaError("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Please try again."

        # unicode
        mock_query.side_effect = SnubaError("\xfc")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Please try again."

        mock_query.side_effect = RateLimitExceeded("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryMemoryLimitExceeded("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryExecutionTimeMaximum("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryTooManySimultaneous("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = DatasetSelectionError("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryConnectionFailed("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QuerySizeExceeded("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryExecutionError("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = SchemaValidationError("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = UnqualifiedQueryError("test")
        with self.tasks():
            assemble_download(de.id, count_down=0)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

    @patch("sentry.data_export.models.ExportedData.finalize_upload")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_integrity_error(self, emailer, finalize_upload):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        finalize_upload.side_effect = IntegrityError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Failed to save the assembled file."

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_sort(self, emailer):
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={
                "project": [self.project.id],
                "field": ["environment"],
                "sort": "-environment",
                "query": "",
            },
        )
        with self.tasks():
            assemble_download(de.id, batch_size=1)
        de = ExportedData.objects.get(id=de.id)
        # Convert raw csv to list of line-strings
        with de._get_file().getfile() as f:
            header, raw1, raw2, raw3 = f.read().strip().split(b"\r\n")
        assert header == b"environment"

        assert raw1.startswith(b"prod")
        assert raw2.startswith(b"prod")
        assert raw3.startswith(b"dev")

        assert emailer.called


@region_silo_test(stable=True)
class AssembleDownloadLargeTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project()
        data = load_data("transaction")
        for i in range(50):
            event = data.copy()
            event.update(
                {
                    "transaction": f"/event/{i:03d}/",
                    "timestamp": iso_format(before_now(minutes=1, seconds=i)),
                    "start_timestamp": iso_format(before_now(minutes=1, seconds=i + 1)),
                }
            )
            self.store_event(event, project_id=self.project.id)

    @patch("sentry.data_export.tasks.MAX_BATCH_SIZE", 200)
    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_large_batch(self, emailer):
        """
        Each row in this export requires exactly 13 bytes, with batch_size=3 and
        MAX_BATCH_SIZE=200, this means that each batch can export 6 batch fragments,
        each containing 3 rows for a total of 3 * 6 * 13 = 234 bytes per batch before
        it stops the current batch and starts another. This runs for 2 batches and
        during the 3rd batch, it will finish exporting all 50 rows.
        """
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=3)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        assert isinstance(de._get_file(), File)

        assert emailer.called


class MergeExportBlobsTest(TestCase, SnubaTestCase):
    def test_task_persistent_name(self):
        assert merge_export_blobs.name == "sentry.data_export.tasks.merge_blobs"
