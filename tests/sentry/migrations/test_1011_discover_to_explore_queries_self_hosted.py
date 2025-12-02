from sentry.discover.models import (
    DiscoverSavedQuery,
    DiscoverSavedQueryProject,
    DiscoverSavedQueryTypes,
)
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.testutils.cases import SnubaTestCase, TestMigrations


class MigrateDiscoverQueriesToExploreQueriesSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "1010_add_organizationcontributors_table"
    migrate_to = "1011_discover_to_explore_queries_self_hosted"

    def setup_before_migration(self, apps):
        User = apps.get_model("sentry", "User")

        self.user = User.objects.create(email="test@sentry.io")
        self.org = self.create_organization(name="Test org", slug="test-org")
        self.project = self.create_project(organization=self.org)
        self.project_ids = [self.project.id]

        self.query = {"fields": ["title", "count()"], "query": ""}
        self.discover_query_with_fields_to_translate = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        )
        for project_id in self.project_ids:
            DiscoverSavedQueryProject.objects.create(
                discover_saved_query=self.discover_query_with_fields_to_translate,
                project_id=project_id,
            )

        self.discover_query_without_projects = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        )

        self.dropped_fields_query = {
            "fields": ["id", "title", "count_web_vitals(measurements.lcp,good)"]
        }
        self.discover_query_dropped_fields = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.dropped_fields_query,
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        )

        self.discover_query_errors = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query={},
            dataset=DiscoverSavedQueryTypes.ERROR_EVENTS,
        )

    def test(self):
        self.discover_query_with_fields_to_translate.refresh_from_db()
        self.discover_query_without_projects.refresh_from_db()
        self.discover_query_dropped_fields.refresh_from_db()
        self.discover_query_errors.refresh_from_db()

        # All TRANSACTION_LIKE queries should get explore queries, even without projects
        # (no projects means "all projects")
        assert self.discover_query_with_fields_to_translate.explore_query is not None
        assert self.discover_query_without_projects.explore_query is not None
        assert self.discover_query_dropped_fields.explore_query is not None
        # ERRORS queries should NOT get explore queries
        assert self.discover_query_errors.explore_query is None

        explore_query_with_translated_fields = (
            self.discover_query_with_fields_to_translate.explore_query
        )
        explore_query_dropped_fields = self.discover_query_dropped_fields.explore_query
        explore_query_no_projects = self.discover_query_without_projects.explore_query

        assert (
            explore_query_with_translated_fields.dataset == ExploreSavedQueryDataset.SEGMENT_SPANS
        )
        assert explore_query_dropped_fields.dataset == ExploreSavedQueryDataset.SEGMENT_SPANS
        assert explore_query_no_projects.dataset == ExploreSavedQueryDataset.SEGMENT_SPANS

        assert explore_query_with_translated_fields.query["query"][0]["fields"] == [
            "id",
            "transaction",
        ]
        assert explore_query_with_translated_fields.query["query"][0]["aggregateField"] == [
            {"yAxes": ["count(span.duration)"], "chartType": 2}
        ]
        assert explore_query_with_translated_fields.query["query"][0]["query"] == "is_transaction:1"
        assert explore_query_with_translated_fields.projects.count() == len(self.project_ids)

        assert explore_query_dropped_fields.query["query"][0]["fields"] == ["id", "transaction"]
        assert explore_query_dropped_fields.query["query"][0]["aggregateField"] == []
        assert explore_query_dropped_fields.query["query"][0]["query"] == "is_transaction:1"

        assert explore_query_no_projects.projects.count() == 0
