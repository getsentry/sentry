from typing import Any, Iterable, cast
from unittest.mock import MagicMock, patch

from django.db import IntegrityError
from django.http import StreamingHttpResponse
from django.urls import reverse

from sentry.data_export.base import ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.data_export.tasks import (
    assemble_download,
    merge_export_blobs,
    recoverable_retry_countdown,
)
from sentry.data_export.writers import OutputMode
from sentry.exceptions import InvalidSearchQuery
from sentry.models.files.file import File
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.testutils.cases import OurLogTestCase, SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json
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

    def test_recoverable_retry_countdown_exponential_backoff(self) -> None:
        assert recoverable_retry_countdown(3) == 30
        assert recoverable_retry_countdown(2) == 60
        assert recoverable_retry_countdown(1) == 120
        assert recoverable_retry_countdown(0) == 240

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

        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(user=self.user, organization=self.org, teams=[self.team])

    def _store_explore_logs_jsonl_rich_field_fixture(
        self,
    ) -> tuple[str, str, dict[str, dict[str, object]], frozenset[str]]:
        """
        Two wide logs rows + Snuba ingest. Returns (start_iso, end_iso, expected_rows_by_user_agent, ignore_keys).
        """
        shared_attrs = {
            "environment": "prod",
            "origin": "auto.log.stdlib",
            "sdk.name": "sentry.python.django",
            "sdk.version": "2.47.0",
            "tags[code.line.number,number]": 148,
            "tags[process.pid,number]": 6639,
        }
        logs = [
            self.create_ourlog(
                {
                    "body": "api.access.alpha",
                    "severity_text": "info",
                    "severity_number": 9,
                },
                timestamp=before_now(minutes=10),
                organization=self.org,
                project=self.project,
                attributes={
                    **shared_attrs,
                    "method": "GET",
                    "path": "/api/0/projects/acme/issues/",
                    "user_agent": "python-requests/2.32.5",
                    "logger.name": "sentry.access.api",
                    "response": "200",
                    "rate_limited": "False",
                    "payload_size": 981,
                },
            ),
            self.create_ourlog(
                {
                    "body": "api.access.beta",
                    "severity_text": "info",
                    "severity_number": 9,
                },
                timestamp=before_now(minutes=8),
                organization=self.org,
                project=self.project,
                attributes={
                    **shared_attrs,
                    "method": "POST",
                    "path": "/api/0/internal/rpc/",
                    "user_agent": "curl/8.0",
                    "logger.name": "sentry.access.api",
                    "response": "201",
                    "rate_limited": "False",
                    "payload_size": 2048,
                },
            ),
        ]
        self.store_eap_items(logs)

        expected_rows: list[dict[str, object]] = [
            {
                "sdk.name": "sentry.python.django",
                "user_agent": "python-requests/2.32.5",
                "method": "GET",
                "path": "/api/0/projects/acme/issues/",
                "sdk.version": "2.47.0",
                "tags[code.line.number,number]": 148.0,
                "logger.name": "sentry.access.api",
                "origin": "auto.log.stdlib",
                "message": "api.access.alpha",
                "rate_limited": "False",
                "severity": "info",
                "environment": "prod",
                "severity_number": 9.0,
                "payload_size": 981.0,
                "tags[process.pid,number]": 6639.0,
                "response": "200",
            },
            {
                "sdk.name": "sentry.python.django",
                "user_agent": "curl/8.0",
                "method": "POST",
                "path": "/api/0/internal/rpc/",
                "sdk.version": "2.47.0",
                "tags[code.line.number,number]": 148.0,
                "logger.name": "sentry.access.api",
                "origin": "auto.log.stdlib",
                "message": "api.access.beta",
                "rate_limited": "False",
                "severity": "info",
                "environment": "prod",
                "payload_size": 2048.0,
                "tags[process.pid,number]": 6639.0,
                "severity_number": 9.0,
                "response": "201",
            },
        ]
        expected_rows_by_agent = {str(row["user_agent"]): row for row in expected_rows}
        start = before_now(minutes=15).isoformat()
        end = before_now(seconds=30).isoformat()

        # Present on TraceItem / Snuba but not worth pinning (ids, times, nanosecond precision, sampling).
        variable_keys = frozenset(
            {
                "timestamp_precise",
                "observed_timestamp",
                "trace",
                "id",
                "organization.id",
                "project.id",
                "item_type",
                "timestamp",
                "client_sample_rate",
                "server_sample_rate",
                "retention_days",
                "downsampled_retention_days",
            }
        )
        return start, end, expected_rows_by_agent, variable_keys

    def _assert_explore_logs_jsonl_rows_match_expected(
        self,
        rows_by_agent: dict[str, dict[str, object]],
        expected_rows_by_agent: dict[str, dict[str, object]],
        ignored_keys: frozenset[str],
    ) -> None:
        def assert_row_equals_export(
            actual: dict[str, object], expected: dict[str, object]
        ) -> None:
            for key, exp in expected.items():
                assert key in actual, f"missing column {key!r}; got {sorted(actual)}"
                got = actual[key]
                if isinstance(exp, (int, float)) and isinstance(got, (int, float)):
                    assert float(got) == float(exp), (key, got, exp)
                else:
                    assert got == exp, (key, got, exp)
            extra = set(actual) - set(expected) - ignored_keys
            assert not extra, f"unexpected columns: {sorted(extra)}"

        assert set(rows_by_agent.keys()) == set(expected_rows_by_agent.keys())
        for user_agent in rows_by_agent:
            assert_row_equals_export(rows_by_agent[user_agent], expected_rows_by_agent[user_agent])

    def _explore_logs_jsonl_rich_field_api_request_body(
        self, start: str, end: str, *, limit: int | None = None
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "query_type": ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR,
            "format": OutputMode.JSONL.value,
            "query_info": {
                "project": [self.project.id],
                "field": [],
                "equations": [],
                "query": "",
                "dataset": "logs",
                "start": start,
                "end": end,
            },
        }
        if limit is not None:
            body["limit"] = limit
        return body

    def _post_explore_logs_jsonl_rich_field_export(
        self, start: str, end: str, *, limit: int | None = None
    ) -> dict[str, Any]:
        self.login_as(self.user)
        url = reverse(
            "sentry-api-0-organization-data-export",
            kwargs={"organization_id_or_slug": self.org.slug},
        )
        request_body = self._explore_logs_jsonl_rich_field_api_request_body(start, end, limit=limit)
        with self.feature("organizations:discover-query"):
            response = self.client.post(
                url,
                data=json.dumps(request_body),
                content_type="application/json",
            )
        assert response.status_code == 201, response.content
        return json.loads(response.content)

    def _assert_explore_logs_jsonl_export_create_payload(
        self, payload: dict[str, Any]
    ) -> ExportedData:
        de = ExportedData.objects.get(id=payload["id"])
        assert de.user_id == self.user.id
        assert de.query_type == ExportQueryType.TRACE_ITEM_FULL_EXPORT
        assert de.export_format == OutputMode.JSONL.value
        assert de.query_info["dataset"] == "logs"
        return de

    def _assert_rich_field_ndjson_two_rows_match_expected(
        self,
        raw_ndjson: bytes,
        expected_rows_by_agent: dict[str, dict[str, object]],
        ignored_keys: frozenset[str],
    ) -> None:
        lines = [ln for ln in raw_ndjson.split(b"\n") if ln]
        assert len(lines) == 2
        rows = [json.loads(ln.decode("utf-8")) for ln in lines]
        rows_by_agent = {row["user_agent"]: row for row in rows}
        self._assert_explore_logs_jsonl_rows_match_expected(
            rows_by_agent, expected_rows_by_agent, ignored_keys
        )

    def _get_data_export_download_body(self, data_export_id: int) -> bytes:
        details_url = reverse(
            "sentry-api-0-organization-data-export-details",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "data_export_id": data_export_id,
            },
        )
        dl_response = self.client.get(f"{details_url}?download=1")
        assert dl_response.status_code == 200
        stream = cast(StreamingHttpResponse, dl_response).streaming_content
        return b"".join(cast(Iterable[bytes], stream)).strip()

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
        self.store_eap_items(logs)

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
    def test_explore_logs_jsonl_format(self, emailer: MagicMock) -> None:
        logs = [
            self.create_ourlog(
                {"body": "jsonl log message", "severity_text": "INFO"},
                timestamp=before_now(minutes=10),
                organization=self.org,
                project=self.project,
                attributes={"custom.field": "test_value 1"},
            ),
            self.create_ourlog(
                {"body": "jsonl log message two", "severity_text": "INFO"},
                timestamp=before_now(minutes=8),
                organization=self.org,
                project=self.project,
                attributes={"custom.field": "test_value 2"},
            ),
            self.create_ourlog(
                {"body": "jsonl log message three", "severity_text": "INFO"},
                timestamp=before_now(minutes=4),
                organization=self.org,
                project=self.project,
                attributes={"custom.field": "test_value 3"},
            ),
        ]
        self.store_eap_items(logs)
        fields = ["log.body", "severity_text"]
        de = ExportedData.objects.create(
            user_id=self.user.id,
            organization=self.org,
            query_type=ExportQueryType.EXPLORE,
            query_info={
                "project": [self.project.id],
                "field": fields,
                "query": "",
                "dataset": "logs",
                "start": before_now(minutes=15).isoformat(),
                "end": before_now(seconds=30).isoformat(),
            },
            export_format=OutputMode.JSONL.value,
        )

        rows_exported = len(logs) - 1
        with self.tasks():
            assemble_download(de.id, batch_size=1, export_limit=rows_exported, page_token=None)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        assert de.date_expired is not None
        assert de.file_id is not None
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "application/x-ndjson"}
        assert file.size is not None
        assert file.checksum is not None

        with file.getfile() as f:
            content = f.read().strip()

        lines = [ln for ln in content.split(b"\n") if ln]
        assert len(lines) == rows_exported
        message_key = "log.body" if len(fields) else "message"
        bodies = {json.loads(ln.decode("utf-8"))[message_key] for ln in lines}
        assert bodies == {
            "jsonl log message",
            "jsonl log message two",
        }
        assert emailer.called

    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_logs_jsonl_full_dataset_rich_fields_async(self, emailer: MagicMock) -> None:
        """
        Wide logs JSONL: two rows, export_limit above row count (async assemble_download).

        """
        start, end, expected_rows_by_agent, ignored_keys = (
            self._store_explore_logs_jsonl_rich_field_fixture()
        )

        payload = self._post_explore_logs_jsonl_rich_field_export(start, end)
        de = self._assert_explore_logs_jsonl_export_create_payload(payload)

        with self.tasks():
            assemble_download(de.id, batch_size=2, export_limit=100)

        de = ExportedData.objects.get(id=de.id)
        assert de.date_finished is not None
        file = de._get_file()
        assert isinstance(file, File)
        assert file.headers == {"Content-Type": "application/x-ndjson"}

        with file.getfile() as f:
            content = f.read().strip()
        self._assert_rich_field_ndjson_two_rows_match_expected(
            content, expected_rows_by_agent, ignored_keys
        )
        assert emailer.called

    @patch("sentry.data_export.endpoints.data_export.assemble_download.delay")
    @patch("sentry.data_export.models.ExportedData.email_success")
    def test_explore_logs_jsonl_full_dataset_rich_fields_sync(
        self, emailer: MagicMock, assemble_delay: MagicMock
    ) -> None:
        """
        Same dataset as test_explore_logs_jsonl_full_dataset_rich_fields: explore + JSONL + limit
        runs synchronously; API response includes file metadata; download stream matches rows.
        """
        start, end, expected_rows_by_agent, ignored_keys = (
            self._store_explore_logs_jsonl_rich_field_fixture()
        )

        payload = self._post_explore_logs_jsonl_rich_field_export(start, end, limit=100)
        assert not assemble_delay.called

        assert payload["dateFinished"] is not None
        assert payload["checksum"] is not None
        assert payload["fileName"] is not None
        de = self._assert_explore_logs_jsonl_export_create_payload(payload)
        assert de.date_finished is not None
        assert de.file_id is not None

        file = de._get_file()
        assert isinstance(file, File)
        assert file.checksum == payload["checksum"]
        assert file.name == payload["fileName"]
        assert file.headers == {"Content-Type": "application/x-ndjson"}

        raw = self._get_data_export_download_body(de.id)
        self._assert_rich_field_ndjson_two_rows_match_expected(
            raw, expected_rows_by_agent, ignored_keys
        )
        assert not emailer.called

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
        self.store_eap_items(logs)

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
        self.store_eap_items(logs)

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
        self.store_eap_items(logs)

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
