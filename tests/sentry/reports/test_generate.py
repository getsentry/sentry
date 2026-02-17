from datetime import date
from unittest.mock import MagicMock, patch

from django.utils.text import slugify

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.reports.generate import generate_csv_for_explore_query
from sentry.reports.models import (
    ScheduledReport,
    ScheduledReportFrequency,
    ScheduledReportSourceType,
)
from sentry.testutils.cases import TestCase


class GenerateCSVForExploreQueryTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.saved_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My Test Query",
            query={
                "query": [
                    {
                        "fields": ["span.op", "span.description", "count()"],
                        "query": "span.op:http.client",
                        "orderby": "-count()",
                    }
                ],
                "range": "7d",
                "environment": ["production"],
            },
            dataset=ExploreSavedQueryDataset.SPANS,
        )
        self.saved_query.set_projects([self.project.id])
        self.report = ScheduledReport(
            organization=self.org,
            created_by_id=self.user.id,
            name="Weekly Span Report",
            source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            source_id=self.saved_query.id,
            frequency=ScheduledReportFrequency.WEEKLY,
            day_of_week=1,
            hour=9,
            recipient_emails=["test@example.com"],
        )

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_generates_csv_with_correct_headers_and_rows(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["span.op", "span.description", "count()"]
        mock_processor.run_query.side_effect = [
            [
                {"span.op": "http.client", "span.description": "GET /api", "count()": "42"},
                {"span.op": "db", "span.description": "SELECT", "count()": "10"},
            ],
            [],
        ]
        mock_processor_cls.return_value = mock_processor

        filename, csv_bytes, empty_result = generate_csv_for_explore_query(self.report, self.org)

        assert not empty_result
        expected_slug = slugify(self.saved_query.name)
        assert filename == f"{expected_slug}_{date.today().isoformat()}.csv"

        csv_text = csv_bytes.decode("utf-8")
        lines = csv_text.strip().split("\r\n")
        assert len(lines) == 3
        assert lines[0] == "span.op,span.description,count()"
        assert lines[1] == "http.client,GET /api,42"
        assert lines[2] == "db,SELECT,10"

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_returns_empty_result_when_no_data(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["span.op", "count()"]
        mock_processor.run_query.return_value = []
        mock_processor_cls.return_value = mock_processor

        _filename, csv_bytes, empty_result = generate_csv_for_explore_query(self.report, self.org)

        assert empty_result
        csv_text = csv_bytes.decode("utf-8")
        lines = csv_text.strip().split("\r\n")
        assert len(lines) == 1
        assert "span.op" in lines[0]

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_csv_size_cap_stops_writing(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["data"]
        big_row = {"data": "x" * 100}
        small_batch = [big_row] * 5
        mock_processor.run_query.return_value = small_batch
        mock_processor_cls.return_value = mock_processor

        # Cap at 500 bytes with batch size of 5 — each batch is ~500+ bytes,
        # so writing should stop after the first batch exceeds the cap.
        with (
            patch("sentry.reports.generate.MAX_CSV_BYTES", 500),
            patch("sentry.reports.generate.BATCH_SIZE", 5),
        ):
            _filename, csv_bytes, empty_result = generate_csv_for_explore_query(
                self.report, self.org
            )

        assert not empty_result
        assert len(csv_bytes) > 0
        csv_lines = csv_bytes.decode("utf-8").strip().split("\r\n")
        # Header + 5 rows from the first batch; should not continue to a second batch
        assert len(csv_lines) == 6

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_uses_time_range_override(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["span.op"]
        mock_processor.run_query.return_value = []
        mock_processor_cls.return_value = mock_processor

        self.report.time_range = "30d"

        generate_csv_for_explore_query(self.report, self.org)

        call_args = mock_processor_cls.call_args
        query_dict = call_args[0][1]
        assert query_dict["statsPeriod"] == "30d"

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_falls_back_to_saved_query_range(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["span.op"]
        mock_processor.run_query.return_value = []
        mock_processor_cls.return_value = mock_processor

        self.report.time_range = None

        generate_csv_for_explore_query(self.report, self.org)

        call_args = mock_processor_cls.call_args
        query_dict = call_args[0][1]
        assert query_dict["statsPeriod"] == "7d"

    @patch("sentry.reports.generate.ExploreProcessor")
    def test_multi_query_uses_first_query(self, mock_processor_cls):
        mock_processor = MagicMock()
        mock_processor.header_fields = ["span.op"]
        mock_processor.run_query.return_value = []
        mock_processor_cls.return_value = mock_processor

        self.saved_query.query = {
            "query": [
                {"fields": ["span.op"], "query": "first_query"},
                {"fields": ["span.duration"], "query": "second_query"},
            ],
            "range": "24h",
        }
        self.saved_query.save()

        generate_csv_for_explore_query(self.report, self.org)

        call_args = mock_processor_cls.call_args
        query_dict = call_args[0][1]
        assert query_dict["field"] == ["span.op"]
        assert query_dict["query"] == "first_query"
