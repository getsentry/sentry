from datetime import datetime, timezone

from sentry.discover.dataset_split import get_and_save_split_decision_for_query, get_snuba_dataclass
from sentry.discover.models import DiscoverSavedQuery
from sentry.models.user import User
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils.samples import load_data


@freeze_time("2024-05-01 12:00:00")
class DiscoverSavedQueryTestCase(TestCase, SnubaTestCase):
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

        get_and_save_split_decision_for_query(errors_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=errors_query.id)
        assert saved_query.dataset == 1

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

        get_and_save_split_decision_for_query(errors_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=errors_query.id)
        assert saved_query.dataset == 1

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

        get_and_save_split_decision_for_query(transaction_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=transaction_query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(transaction_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=transaction_query.id)
        assert saved_query.dataset == 1

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

        get_and_save_split_decision_for_query(array_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=array_query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(measurements_query.id, False)
        saved_query = DiscoverSavedQuery.objects.get(id=measurements_query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 2

    def test_ambiguous_query_with_error_data(self):
        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id)

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 1

    def test_ambiguous_query_with_transactions_data(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id)

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 2

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 1

    def test_ambiguous_query_with_error_and_transaction_data(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id)

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 1

    def test_ambiguous_query_with_tags(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id)

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 2

    def test_ambiguous_error_query_with_tags(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["tags"] = {"branch": "/main/"}
        self.store_event(data, project_id=self.project.id)

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

        get_and_save_split_decision_for_query(query, False)
        saved_query = DiscoverSavedQuery.objects.get(id=query.id)
        assert saved_query.dataset == 1

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
            snuba_dataclass, _ = get_snuba_dataclass(query, self.projects)

        assert snuba_dataclass.start == datetime(2024, 4, 24, 12, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)

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

        snuba_dataclass, _ = get_snuba_dataclass(query, self.projects)

        assert snuba_dataclass.start == datetime(2024, 5, 1, 11, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
