from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class SplitDiscoverDatasetSavedQueryTest(TestMigrations, SnubaTestCase):
    migrate_from = "0893_rulesnooze_added_with_timezone"
    migrate_to = "0894_split_discover_dataset_saved_queries"

    def setup_before_migration(self, apps):
        organization = self.create_organization(name="test", slug="test")
        self.project = self.create_project(organization=organization)
        self.environment = self.create_environment(organization=organization, project=self.project)

        DiscoverSavedQuery = apps.get_model("sentry", "DiscoverSavedQuery")

        self.error_query = DiscoverSavedQuery.objects.create(
            organization_id=organization.id,
            name="",
            query={
                "environment": [],
                "query": "stack.filename:'../../sentry/scripts/views.js' AND stack.package:'foo'",
                "fields": ["title", "issue", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,  # DISCOVER dataset
            dataset_source=0,  # UNKNOWN source (default)
            is_homepage=True,
        )

        self.transaction_query = DiscoverSavedQuery.objects.create(
            organization_id=organization.id,
            name="",
            query={
                "environment": [],
                "query": "transaction.op:pageload",
                "fields": ["title", "project", "release", "count()", "count_unique(user)"],
                "range": "90d",
                "orderby": "-count",
            },
            version=2,
            dataset=0,  # DISCOVER dataset
            dataset_source=0,  # UNKNOWN source (default)
            is_homepage=True,
        )

        self.nine_mins_ago = before_now(minutes=9)
        self.ten_mins_ago = before_now(minutes=10)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        data["environment"] = self.environment.name
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        data["environment"] = self.environment.name
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        self.ambiguous_query_with_transactions_data = DiscoverSavedQuery.objects.create(
            organization_id=organization.id,
            name="",
            query={
                "environment": [f"{self.environment.name}"],
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

    def test(self):
        self.error_query.refresh_from_db()
        self.transaction_query.refresh_from_db()
        self.ambiguous_query_with_transactions_data.refresh_from_db()
        assert self.error_query.dataset == 1  # ERROR_EVENTS dataset
        assert self.transaction_query.dataset == 2  # TRANSACTION_LIKE dataset
        assert self.ambiguous_query_with_transactions_data.dataset == 2  # TRANSACTION_LIKE dataset
