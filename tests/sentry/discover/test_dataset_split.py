from datetime import datetime, timedelta, timezone

import pytest

from sentry.discover.dataset_split import (
    _dataset_split_decision_inferred_from_query,
    _get_and_save_split_decision_for_query,
    _get_snuba_dataclass,
)
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.user import User
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils.samples import load_data


class DiscoverSavedQueryDatasetSplitTestCase(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.create(email="test@sentry.io")
        self.project_2 = self.create_project(organization=self.org)
        self.project_3 = self.create_project(organization=self.org)
        self.project_ids = [
            self.project.id,
            self.project_2.id,
            self.project_3.id,
        ]
        self.projects = [
            self.project,
            self.project_2,
            self.project_3,
        ]
        self.query = {"fields": ["test"], "conditions": [], "limit": 10}

        self.nine_mins_ago = before_now(minutes=9)
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = iso_format(self.ten_mins_ago)
        self.dry_run = False

    def test_errors_query(self):
        errors_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "query": "stack.filename:'../../sentry/scripts/views.js'",
                "fields": ["title", "issue", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        errors_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(errors_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=errors_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_errors_query_top_level_and_condition(self):
        errors_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "query": "stack.filename:'../../sentry/scripts/views.js' AND stack.package:'foo'",
                "fields": ["title", "issue", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        errors_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(errors_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=errors_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_top_level_or_condition_with_no_data(self):
        transaction_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "query": "transaction.op:pageload OR transaction.status:unknown",
                "fields": ["title", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        transaction_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(transaction_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=transaction_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_conflicting_or_conditions_favor_errors(self):
        transaction_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "query": "error.type:IllegalArgument OR transaction.status:unknown",
                "fields": ["title", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        transaction_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(transaction_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=transaction_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_array_condition(self):
        array_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "query": "transaction.op:[pageload]",
                "fields": ["title", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        array_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(array_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=array_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_measurements_condition(self):
        measurements_query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "orderby": "-p75_measurements_time_to_initial_display",
                "yAxis": "p75(measurements.time_to_initial_display)",
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "p75(measurements.time_to_initial_display)",
                    "count()",
                ],
                "query": "measurements.time_to_initial_display:>100",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        measurements_query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(measurements_query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=measurements_query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_spans_condition(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "yAxis": "p75(spans.db)",
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "p75(spans.db)",
                    "count()",
                ],
                "query": "spans.db:>100",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_measurements_columns(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "orderby": "-p75_measurements_time_to_initial_display",
                "yAxis": "p75(measurements.time_to_initial_display)",
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "p75(measurements.time_to_initial_display)",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_spans_column(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "p75(spans.db)",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_ambiguous_query_with_error_data(self):
        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_ambiguous_query_with_transactions_data(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_ambiguous_query_with_no_data(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_ambiguous_query_with_error_and_transaction_data(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    def test_ambiguous_query_with_tags(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "branch:/main/",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 2

    def test_ambiguous_error_query_with_tags(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "7d",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "branch:/main/",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )
        query.set_projects(self.project_ids)

        _get_and_save_split_decision_for_query(query, self.dry_run)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 0 if self.dry_run else saved_query.dataset == 1

    @freeze_time("2024-05-01 12:00:00")
    def test_out_of_range_defaults_to_seven_days(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "start": "2024-01-01T10:00:00",
                "end": "2024-01-02T10:00:00",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )

        with self.options({"system.event-retention-days": 90}):
            snuba_dataclass = _get_snuba_dataclass(query, self.projects)

        assert snuba_dataclass.start == datetime(2024, 4, 24, 12, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)

    @freeze_time("2024-05-01 12:00:00")
    def test_respects_range_date_params(self):
        query = DiscoverSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="",
            query={
                "environment": [],
                "range": "1h",
                "fields": [
                    "transaction",
                    "epm()",
                    "count()",
                ],
                "query": "",
                "display": "default",
            },
            version=2,
            dataset=0,
            dataset_source=0,
            is_homepage=True,
        )

        snuba_dataclass = _get_snuba_dataclass(query, self.projects)

        assert snuba_dataclass.start == datetime(2024, 5, 1, 11, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)


class DiscoverSavedQueryDatasetSplitDryRunTestCase(DiscoverSavedQueryDatasetSplitTestCase):
    def setUp(self):
        super().setUp()
        self.dry_run = True


@pytest.fixture
def owner() -> None:
    return Factories.create_user()


@pytest.fixture
def organization(owner: User) -> None:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization: Organization) -> Project:
    return Factories.create_project(organization=organization)


@pytest.mark.parametrize(
    ["query", "selected_columns", "expected_dataset"],
    [
        pytest.param("", ["count()"], None),
        pytest.param(
            "stack.filename:'../../sentry/scripts/views.js' AND (branch:foo OR branch:bar)",
            ["count()"],
            DiscoverSavedQueryTypes.ERROR_EVENTS,
        ),
        pytest.param(
            "error.unhandled:true",
            ["count()"],
            DiscoverSavedQueryTypes.ERROR_EVENTS,
        ),
        pytest.param(
            "(event:type:error AND branch:foo) OR (event:type:transaction AND branch:bar)",
            ["count()"],
            None,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["count()"],
            None,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["stack.function", "avg(transaction.duration)"],
            DiscoverSavedQueryTypes.ERROR_EVENTS,
        ),
        pytest.param(
            "",
            ["error.handled", "count()"],
            DiscoverSavedQueryTypes.ERROR_EVENTS,
        ),
        pytest.param(
            "transaction.duration:>100ms",
            ["count()"],
            DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        ),
        pytest.param(
            "tag:value event.type:transaction",
            ["count()"],
            DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        ),
        pytest.param(
            "(tag:value OR branch:foo) AND event.type:transaction",
            ["count()"],
            DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["avg(transaction.duration)"],
            DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["p95(measurements.app_start_cold)"],
            DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        ),
    ],
)
@django_db_all
def test_dataset_split_decision_inferred_from_query(
    query: str, selected_columns: list[str], expected_dataset: int | None, project: Project
):
    snuba_dataclass = SnubaParams(
        start=datetime.now() - timedelta(days=1),
        end=datetime.now(),
        environments=[],
        projects=[project],
        user=None,
        teams=[],
        organization=project.organization,
    )

    errors_builder = ErrorsQueryBuilder(
        Dataset.Events,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=[],
        limit=1,
    )

    transactions_builder = DiscoverQueryBuilder(
        Dataset.Transactions,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=[],
        limit=1,
    )

    assert expected_dataset == _dataset_split_decision_inferred_from_query(
        errors_builder=errors_builder, transactions_builder=transactions_builder
    )
