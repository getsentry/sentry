import pytest
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry.data_export.base import ExportError
from sentry.data_export.processors.discover import DiscoverProcessor
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.utils.samples import load_data


class DiscoverProcessorTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project1)
        self.discover_query = {
            "statsPeriod": "14d",
            "project": [self.project1.id, self.project2.id],
            "field": ["count(id)", "fake(field)", "issue"],
            "query": "",
        }

    def test_get_projects(self):
        project = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id]}
        )
        assert isinstance(project, list)
        assert project[0] == self.project1
        projects = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id, self.project2.id]}
        )
        assert sorted(p.id for p in projects) == sorted([self.project1.id, self.project2.id])
        with pytest.raises(ExportError):
            DiscoverProcessor.get_projects(organization_id=self.org.id, query={"project": [-1]})

    def test_handle_issue_id_fields(self):
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        assert processor.header_fields == ["count_id", "fake_field", "issue"]
        result_list = [{"issue": self.group.id, "issue.id": self.group.id}]
        new_result_list = processor.handle_fields(result_list)
        assert new_result_list[0] != result_list
        assert new_result_list[0]["issue"] == self.group.qualified_short_id

    def test_handle_transaction_status_fields(self):
        self.discover_query = {
            **self.discover_query,
            "field": ["title", "event.type", "transaction.status"],
        }
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        assert processor.header_fields == ["title", "event.type", "transaction.status"]
        result_list = [
            {"transaction.status": SPAN_STATUS_NAME_TO_CODE.get("ok")},
            {"transaction.status": SPAN_STATUS_NAME_TO_CODE.get("not_found")},
        ]
        new_result_list = processor.handle_fields(result_list)
        assert new_result_list[0]["transaction.status"] == "ok"
        assert new_result_list[1]["transaction.status"] == "not_found"

    def test_handle__fields(self):
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        assert processor.header_fields == ["count_id", "fake_field", "issue"]
        result_list = [{"issue": self.group.id, "issue.id": self.group.id}]
        new_result_list = processor.handle_fields(result_list)
        assert new_result_list[0] != result_list
        assert new_result_list[0]["issue"] == self.group.qualified_short_id

    def test_handle_equations(self):
        self.discover_query["field"] = ["count(id)", "fake(field)"]
        self.discover_query["equations"] = ["count(id) / fake(field)", "count(id) / 2"]
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        assert processor.header_fields == [
            "count_id",
            "fake_field",
            "count(id) / fake(field)",
            "count(id) / 2",
        ]
        result_list = [{"equation[0]": 5, "equation[1]": 8}]
        new_result_list = processor.handle_fields(result_list)
        assert new_result_list[0] != result_list
        assert new_result_list[0]["count(id) / fake(field)"] == 5
        assert new_result_list[0]["count(id) / 2"] == 8

    def test_handle_transactions_dataset(self):
        # Store an error event to show we're querying transactions
        self.store_event(load_data("python"), project_id=self.project1.id)

        transaction_data = load_data("transaction")
        transaction = self.store_event(
            {**transaction_data, "transaction": "test transaction"}, project_id=self.project1.id
        )
        self.discover_query = {
            **self.discover_query,
            "field": ["title", "transaction.status"],
            "dataset": "transactions",
        }
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        data = processor.data_fn(offset=0, limit=2)["data"]
        assert data[0] == {
            "title": "test transaction",
            "transaction.status": 0,
            "id": transaction.event_id,
            "project.name": self.project1.slug,
        }

    def test_handle_errors_dataset(self):
        # Store a transaction event to show we're querying errors
        self.store_event(load_data("transaction"), project_id=self.project1.id)

        error_data = load_data("python")
        error_event = self.store_event(error_data, project_id=self.project1.id)
        self.discover_query = {
            **self.discover_query,
            "field": ["title"],
            "dataset": "errors",
        }
        processor = DiscoverProcessor(organization=self.org, discover_query=self.discover_query)
        data = processor.data_fn(offset=0, limit=2)["data"]
        assert data[0] == {
            "title": error_event.message,
            "id": error_event.event_id,
            "project.name": self.project1.slug,
        }


class DiscoverIssuesProcessorTest(TestCase, PerformanceIssueTestCase):
    def test_handle_dataset(self):
        query = {
            "statsPeriod": "14d",
            "project": [self.project.id],
            "field": ["count(id)", "fake(field)", "issue"],
            "query": "",
        }
        query["field"] = ["title", "count()"]
        query["dataset"] = "issuePlatform"
        self.create_performance_issue()
        processor = DiscoverProcessor(organization=self.organization, discover_query=query)
        assert processor.header_fields == [
            "title",
            "count",
        ]
        result = processor.data_fn(0, 1)
        assert len(result["data"]) == 1
        assert result["data"][0]["title"] == "N+1 Query"
