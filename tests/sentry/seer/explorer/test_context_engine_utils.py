from datetime import UTC, datetime, timedelta
from unittest import mock

from sentry.seer.explorer.context_engine_utils import (
    get_event_counts_for_org_projects,
    get_instrumentation_types,
    get_sdk_names_for_org_projects,
    get_top_span_ops_for_org_projects,
    get_top_transactions_for_org_projects,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestGetInstrumentationTypes(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

    def test_returns_empty_for_no_flags(self):
        assert get_instrumentation_types(self.project) == []

    def test_returns_correct_flags(self):
        self.project.flags.has_transactions = True
        self.project.flags.has_profiles = True
        self.project.flags.has_replays = True
        self.project.flags.has_sessions = True
        self.project.save()

        result = get_instrumentation_types(self.project)
        assert result == ["transactions", "profiles", "replays", "sessions"]

    def test_returns_partial_flags(self):
        self.project.flags.has_transactions = True
        self.project.flags.has_sessions = True
        self.project.save()

        result = get_instrumentation_types(self.project)
        assert result == ["transactions", "sessions"]


@django_db_all
class TestGetEventCountsForOrgProjects(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.end = datetime.now(UTC)
        self.start = self.end - timedelta(days=7)

    def test_returns_high_volume_projects_only(self):
        raw_data = [
            {"project_id": self.project.id, "category": 1, "total": 800},  # error
            {"project_id": self.project.id, "category": 2, "total": 500},  # transaction
        ]
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.raw_snql_query",
            return_value={"data": raw_data},
        ):
            result = get_event_counts_for_org_projects(
                self.org.id, [self.project.id], self.start, self.end
            )

        # 800 + 500 = 1300 >= HIGH_VOLUME_THRESHOLD
        assert self.project.id in result

    def test_excludes_low_volume_projects(self):
        raw_data = [
            {"project_id": self.project.id, "category": 1, "total": 100},
            {"project_id": self.project.id, "category": 2, "total": 200},
        ]
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.raw_snql_query",
            return_value={"data": raw_data},
        ):
            result = get_event_counts_for_org_projects(
                self.org.id, [self.project.id], self.start, self.end
            )

        # 100 + 200 = 300 < HIGH_VOLUME_THRESHOLD
        assert self.project.id not in result

    def test_returns_empty_on_query_exception(self):
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.raw_snql_query",
            side_effect=Exception("snuba error"),
        ):
            result = get_event_counts_for_org_projects(
                self.org.id, [self.project.id], self.start, self.end
            )

        assert result == {}


@django_db_all
class TestGetTopTransactionsForOrgProjects(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.end = datetime.now(UTC)
        self.start = self.end - timedelta(days=7)

    def test_returns_empty_for_no_projects(self):
        result = get_top_transactions_for_org_projects([], self.start, self.end)
        assert result == {}

    def test_returns_transaction_names_by_project(self):
        span_data = [
            {
                "project.id": self.project.id,
                "transaction": "GET /api/0/projects/",
                "sum(span.duration)": 1000,
            },
        ]
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.Spans.run_table_query",
            return_value={"data": span_data},
        ):
            result = get_top_transactions_for_org_projects([self.project], self.start, self.end)

        assert result == {self.project.id: ["GET /api/0/projects/"]}

    def test_returns_empty_on_query_exception(self):
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.Spans.run_table_query",
            side_effect=Exception("eap error"),
        ):
            result = get_top_transactions_for_org_projects([self.project], self.start, self.end)

        assert result == {}

    def test_returns_empty_dict_when_no_transactions(self):
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.Spans.run_table_query",
            return_value={"data": []},
        ):
            result = get_top_transactions_for_org_projects([self.project], self.start, self.end)

        assert result == {}


@django_db_all
class TestGetTopSpanOpsForOrgProjects(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.end = datetime.now(UTC)
        self.start = self.end - timedelta(days=7)

    def test_returns_empty_for_no_projects(self):
        result = get_top_span_ops_for_org_projects([], self.start, self.end)
        assert result == {}

    def test_returns_ops_by_project(self):
        span_data = [
            {
                "project.id": self.project.id,
                "span.category": "db",
                "sentry.normalized_description": "SELECT * FROM table",
                "sum(span.self_time)": 1000,
            },
            {
                "project.id": self.project.id,
                "span.category": "http",
                "sentry.normalized_description": "GET https://api.example.com",
                "sum(span.self_time)": 500,
            },
        ]
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.Spans.run_table_query",
            return_value={"data": span_data},
        ):
            result = get_top_span_ops_for_org_projects([self.project], self.start, self.end)

        assert result == {
            self.project.id: [
                ("db", "SELECT * FROM table"),
                ("http", "GET https://api.example.com"),
            ]
        }

    def test_returns_empty_on_query_exception(self):
        with mock.patch(
            "sentry.seer.explorer.context_engine_utils.Spans.run_table_query",
            side_effect=Exception("eap error"),
        ):
            result = get_top_span_ops_for_org_projects([self.project], self.start, self.end)

        assert result == {}


MOCK_RUN_TABLE = "sentry.seer.explorer.context_engine_utils.Spans.run_table_query"


@django_db_all
class TestGetSdkNamesForOrgProjects(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.end = datetime.now(UTC)
        self.start = self.end - timedelta(days=7)

    def test_returns_empty_for_no_projects(self):
        assert get_sdk_names_for_org_projects([], self.start, self.end) == {}

    @mock.patch(MOCK_RUN_TABLE, return_value={"data": []})
    def test_returns_empty_when_no_data(self, _mock):
        assert get_sdk_names_for_org_projects([self.project], self.start, self.end) == {}

    @mock.patch(MOCK_RUN_TABLE, side_effect=Exception("eap error"))
    def test_returns_empty_on_query_exception(self, _mock):
        assert get_sdk_names_for_org_projects([self.project], self.start, self.end) == {}

    def test_returns_sdk_name_by_project(self):
        data = [{"project.id": self.project.id, "sdk.name": "sentry.python", "count()": 500}]
        with mock.patch(MOCK_RUN_TABLE, return_value={"data": data}):
            result = get_sdk_names_for_org_projects([self.project], self.start, self.end)
        assert result == {self.project.id: "sentry.python"}

    def test_keeps_first_sdk_name_per_project(self):
        data = [
            {"project.id": self.project.id, "sdk.name": "sentry.python", "count()": 500},
            {"project.id": self.project.id, "sdk.name": "sentry.javascript", "count()": 100},
        ]
        with mock.patch(MOCK_RUN_TABLE, return_value={"data": data}):
            result = get_sdk_names_for_org_projects([self.project], self.start, self.end)
        assert result == {self.project.id: "sentry.python"}

    def test_skips_empty_sdk_name(self):
        data = [{"project.id": self.project.id, "sdk.name": "", "count()": 500}]
        with mock.patch(MOCK_RUN_TABLE, return_value={"data": data}):
            assert get_sdk_names_for_org_projects([self.project], self.start, self.end) == {}
