from unittest.mock import MagicMock, patch

from django.db import IntegrityError

from sentry.data_export.base import ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.data_export.tasks import assemble_download, merge_export_blobs
from sentry.exceptions import InvalidSearchQuery
from sentry.models.files.file import File
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.testutils.cases import OurLogTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
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


class AssembleDownloadTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.event = self.store_event(
            data={
                "tags": {"foo": "bar"},
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=3).isoformat(),
                "environment": "dev",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "tags": {"foo": "bar2"},
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=2).isoformat(),
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "tags": {"foo": "bar2"},
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=1).isoformat(),
                "environment": "prod",
            },
            project_id=self.project.id,
        )

    def test_task_persistent_name(self) -> None:
        assert assemble_download.name == "sentry.data_export.tasks.assemble_download"

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_issue_by_tag_batched(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_no_error_on_retry(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_issue_by_tag_missing_key(self, emailer: MagicMock) -> None:
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
    def test_issue_by_tag_missing_project(self, emailer: MagicMock) -> None:
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
    def test_issue_by_tag_missing_issue(self, emailer: MagicMock) -> None:
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

    @patch("sentry.tagstore.backend.get_tag_key")
    @patch("sentry.utils.snuba.raw_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_issue_by_tag_outside_retention(
        self, emailer: MagicMock, mock_query: MagicMock, mock_get_tag_key: MagicMock
    ) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header = f.read().strip()
        assert header == b"value,times_seen,last_seen,first_seen"

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_batched(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_discover_respects_selected_environment(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_discover_respects_selected_environment_multiple(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_discover_missing_environment(self, emailer: MagicMock) -> None:
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
    def test_discover_missing_project(self, emailer: MagicMock) -> None:
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
    def test_discover_export_file_too_large(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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
    def test_discover_export_too_many_rows(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
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

    @patch("sentry.search.events.builder.base.raw_snql_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_outside_retention(self, emailer: MagicMock, mock_query: MagicMock) -> None:
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
    def test_discover_invalid_search_query(self, emailer: MagicMock, mock_query: MagicMock) -> None:
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

    @patch("sentry.search.events.builder.base.raw_snql_query")
    def test_retries_on_recoverable_snuba_errors(self, mock_query: MagicMock) -> None:
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
            assemble_download(de.id)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None
        with file.getfile() as f:
            header, row = f.read().strip().split(b"\r\n")

    @patch("sentry.search.events.builder.base.raw_snql_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_snuba_error(self, emailer: MagicMock, mock_query: MagicMock) -> None:
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["title"], "query": ""},
        )

        mock_query.side_effect = QueryIllegalTypeOfArgument("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Argument to function is wrong type."

        # unicode
        mock_query.side_effect = QueryIllegalTypeOfArgument("\xfc")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Invalid query. Argument to function is wrong type."

        mock_query.side_effect = SnubaError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Please try again."

        # unicode
        mock_query.side_effect = SnubaError("\xfc")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Please try again."

        mock_query.side_effect = RateLimitExceeded("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryMemoryLimitExceeded("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryExecutionTimeMaximum("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = QueryTooManySimultaneous("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == TIMEOUT_ERROR_MESSAGE

        mock_query.side_effect = DatasetSelectionError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryConnectionFailed("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QuerySizeExceeded("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = QueryExecutionError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = SchemaValidationError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

        mock_query.side_effect = UnqualifiedQueryError("test")
        with self.tasks():
            assemble_download(de.id)
        error = emailer.call_args[1]["message"]
        assert error == "Internal error. Your query failed to run."

    @patch("sentry.data_export.models.ExportedData.finalize_upload")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_discover_integrity_error(self, emailer: MagicMock, finalize_upload: MagicMock) -> None:
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
    def test_discover_sort(self, emailer: MagicMock) -> None:
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
        file = de._get_file()
        assert isinstance(file, File)
        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            header, raw1, raw2, raw3 = f.read().strip().split(b"\r\n")
        assert header == b"environment"

        assert raw1.startswith(b"prod")
        assert raw2.startswith(b"prod")
        assert raw3.startswith(b"dev")

        assert emailer.called


class AssembleDownloadLargeTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project()
        self.data = load_data("transaction")

    @patch("sentry.data_export.tasks.MAX_BATCH_SIZE", 200)
    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_discover_large_batch(self, emailer: MagicMock) -> None:
        """
        Each row in this export requires exactly 13 bytes, with batch_size=3 and
        MAX_BATCH_SIZE=200, this means that each batch can export 6 batch fragments,
        each containing 3 rows for a total of 3 * 6 * 13 = 234 bytes per batch before
        it stops the current batch and starts another. This runs for 2 batches and
        during the 3rd batch, it will finish exporting all 50 rows.
        """
        for i in range(50):
            event = self.data.copy()
            event.update(
                {
                    "transaction": f"/event/{i:03d}/",
                    "timestamp": before_now(minutes=1, seconds=i).isoformat(),
                    "start_timestamp": before_now(minutes=1, seconds=i + 1).isoformat(),
                }
            )
            self.store_event(event, project_id=self.project.id)
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
        file = de._get_file()
        assert isinstance(file, File)

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_character_escape(self, emailer: MagicMock) -> None:
        strings = [
            "SyntaxError: Unexpected token '\u0003', \"\u0003WM�\u0000\u0000\u0000\u0000��\"... is not valid JSON"
        ]
        for string in strings:
            event = self.data.copy()
            event.update(
                {
                    "transaction": string,
                    "timestamp": before_now(minutes=1, seconds=0).isoformat(),
                    "start_timestamp": before_now(minutes=1, seconds=1).isoformat(),
                }
            )
            self.store_event(event, project_id=self.project.id)
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.DISCOVER,
            query_info={"project": [self.project.id], "field": ["transaction"], "query": ""},
        )
        with self.tasks():
            assemble_download(de.id, batch_size=3)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        file = de._get_file()
        assert isinstance(file, File)

        assert emailer.called


class AssembleDownloadExploreTest(TestCase, SnubaTestCase, SpanTestCase, OurLogTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_spans_dataset_called_correctly(self, emailer: MagicMock) -> None:
        spans = [
            self.create_span(
                {"description": "test_span"},
                start_ts=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            )
        ]
        self.store_spans(spans)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["id", "description"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b"id,description"
        assert b"test_span" in lines[1]

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_logs_dataset_called_correctly(self, emailer: MagicMock) -> None:
        logs = [
            self.create_ourlog(
                {"body": "test log message", "severity_text": "INFO"},
                timestamp=before_now(minutes=10),
                attributes={"custom.field": "test_value"},
            )
        ]
        self.store_ourlogs(logs)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["log.body", "severity_text"],
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        de = ExportedData.objects.get(id=de.id)
        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        with file.getfile() as f:
            content = f.read().strip()
        assert b"log.body,severity_text" in content

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_datasets_isolation(self, emailer: MagicMock) -> None:
        spans = [
            self.create_span(
                {"description": "isolation_test_span"},
                start_ts=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            )
        ]
        self.store_spans(spans)

        logs = [
            self.create_ourlog(
                {"body": "isolation test log", "severity_text": "DEBUG"},
                timestamp=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            )
        ]
        self.store_ourlogs(logs)

        # Test spans dataset export
        de_spans = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["id", "description"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de_spans.id, batch_size=1)

        de_spans = ExportedData.objects.get(id=de_spans.id)
        assert de_spans.date_finished is not None

        # Verify spans export contains span data but not log data
        file_spans = de_spans._get_file()
        assert isinstance(file_spans, File)
        with file_spans.getfile() as f:
            content_spans = f.read().strip()

        assert b"id,description" in content_spans
        assert b"isolation_test_span" in content_spans
        assert b"isolation test log" not in content_spans

        # Test logs dataset export
        de_logs = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["log.body", "severity_text"],
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de_logs.id, batch_size=1)

        de_logs = ExportedData.objects.get(id=de_logs.id)
        assert de_logs.date_finished is not None

        # Verify logs export contains log data but not span data
        file_logs = de_logs._get_file()
        assert isinstance(file_logs, File)
        with file_logs.getfile() as f:
            content_logs = f.read().strip()

        assert b"log.body,severity_text" in content_logs
        assert b"isolation test log" in content_logs
        assert b"isolation_test_span" not in content_logs

        assert emailer.call_count == 2

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_batched(self, emailer: MagicMock) -> None:
        spans = [
            self.create_span(
                {"description": "first_span", "sentry_tags": {"transaction": "txn1"}},
                start_ts=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            ),
            self.create_span(
                {"description": "second_span", "sentry_tags": {"transaction": "txn2"}},
                start_ts=before_now(minutes=9),
                project=self.project,
                organization=self.org,
            ),
            self.create_span(
                {"description": "third_span", "sentry_tags": {"transaction": "txn3"}},
                start_ts=before_now(minutes=8),
                project=self.project,
                organization=self.org,
            ),
        ]
        self.store_spans(spans)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["id", "description"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None

        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b"id,description"
        # Should have data rows with our spans
        assert len(lines) >= 2  # header + at least one data row
        assert b"first_span" in content or b"second_span" in content or b"third_span" in content

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_respects_selected_environment(self, emailer: MagicMock) -> None:
        self.create_environment(name="prod", organization=self.org)

        # Create log data
        logs = [
            self.create_ourlog(
                {"body": "production log", "severity_text": "ERROR"},
                timestamp=before_now(minutes=10),
                attributes={"environment": "prod"},
                organization=self.org,
                project=self.project,
            )
        ]
        self.store_ourlogs(logs)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "environment": "prod",
                "field": ["log.body", "severity_text"],
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None

        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b"log.body,severity_text"
        # Should have data rows with our logs
        assert len(lines) >= 2
        assert b"production log" in content
        assert b"ERROR" in content

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_explore_missing_environment(self, emailer: MagicMock) -> None:
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "environment": "fake_environment",
                "field": ["span_id"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        error = emailer.call_args[1]["message"]
        assert error == "Requested environment does not exist"

    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_explore_missing_project(self, emailer: MagicMock) -> None:
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [-1],
                "field": ["span_id"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id)

        error = emailer.call_args[1]["message"]
        assert error == "Requested project does not exist"

    @patch("sentry.data_export.tasks.MAX_FILE_SIZE", 55)
    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_export_file_too_large(self, emailer: MagicMock) -> None:
        spans = [
            self.create_span(
                {"description": "test", "sentry_tags": {"transaction": "test_txn"}},
                start_ts=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            )
            for _ in range(5)
        ]
        self.store_spans(spans)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["id", "description"],
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=1)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None

        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        # Verify CSV content
        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b""
        # raising ExportDataFileTooBig returns 0
        assert len(lines) >= 1

        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_export_too_many_rows(self, emailer: MagicMock) -> None:
        logs = [
            self.create_ourlog(
                {"body": f"test log {i}", "severity_text": "INFO"},
                timestamp=before_now(minutes=10 - i),
                organization=self.org,
                project=self.project,
            )
            for i in range(5)
        ]
        self.store_ourlogs(logs)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["log.body", "severity_text"],
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        # Limit export to 2 rows
        with self.tasks():
            assemble_download(de.id, export_limit=2)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None

        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "text/csv"}
        assert file.size is not None
        assert file.checksum is not None

        # Verify CSV content respects row limit
        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b"log.body,severity_text"
        assert len(lines) == 3  # header + up to 2 data rows
        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_sort(self, emailer: MagicMock) -> None:
        spans = [
            self.create_span(
                {"description": "span_alpha", "sentry_tags": {"transaction": "zeta_txn"}},
                start_ts=before_now(minutes=10),
                project=self.project,
                organization=self.org,
            ),
            self.create_span(
                {"description": "span_beta", "sentry_tags": {"transaction": "alpha_txn"}},
                start_ts=before_now(minutes=9),
                project=self.project,
                organization=self.org,
            ),
        ]
        self.store_spans(spans)

        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["id", "description", "transaction"],
                "sort": ["transaction"],  # Sort by description descending
                "query": "",
                "dataset": "spans",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        with self.tasks():
            assemble_download(de.id, batch_size=5)

        de = ExportedData.objects.get(id=de.id)
        file = de._get_file()
        assert isinstance(file, File)

        # Convert raw csv to list of line-strings
        with file.getfile() as f:
            content = f.read().strip()

        lines = content.split(b"\r\n")
        assert lines[0] == b"id,description,transaction"
        assert b"alpha_txn" in lines[1]
        assert b"zeta_txn" in lines[2]

        assert emailer.called

    @patch("sentry.snuba.ourlogs.OurLogs.run_table_query")
    @patch("sentry.data_export.models.ExportedData.email_failure")
    def test_explore_outside_retention(
        self, emailer: MagicMock, mock_logs_query: MagicMock
    ) -> None:
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": ["log.body"],
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(minutes=5).isoformat(),
            },
        )

        mock_logs_query.side_effect = QueryOutsideRetentionError("test")
        with self.tasks():
            assemble_download(de.id)

        error = emailer.call_args[1]["message"]
        assert error == "Invalid date range. Please try a more recent date range."

        # Test with unicode error
        mock_logs_query.side_effect = QueryOutsideRetentionError("\xfc")
        with self.tasks():
            assemble_download(de.id)

        error = emailer.call_args[1]["message"]
        assert error == "Invalid date range. Please try a more recent date range."


class MergeExportBlobsTest(TestCase, SnubaTestCase):
    def test_task_persistent_name(self) -> None:
        assert merge_export_blobs.name == "sentry.data_export.tasks.merge_blobs"
