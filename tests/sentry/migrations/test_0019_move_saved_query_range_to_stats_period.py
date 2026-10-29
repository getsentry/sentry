from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class MoveSavedQueryRangeToStatsPeriodTest(TestMigrations):
    app = "explore"
    migrate_from = "0018_add_prebuilt_delete_to_formulas"
    migrate_to = "0019_move_saved_query_range_to_stats_period"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        ExploreSavedQuery = apps.get_model("explore", "ExploreSavedQuery")
        DiscoverSavedQuery = apps.get_model("discover", "DiscoverSavedQuery")

        with unguarded_write(using="default"):
            organization = Organization.objects.create(slug="range-migration", name="Range")

        def create(model, name: str, query: dict[str, object]) -> int:
            return model.objects.create(organization_id=organization.id, name=name, query=query).id

        self.explore_range = create(ExploreSavedQuery, "explore-range", {"range": "24h"})
        self.explore_both = create(
            ExploreSavedQuery,
            "explore-both",
            {"range": "14d", "statsPeriod": "7d", "query": []},
        )
        self.explore_stats_period = create(
            ExploreSavedQuery, "explore-stats", {"statsPeriod": "1h", "environment": ["prod"]}
        )
        self.explore_null_range = create(ExploreSavedQuery, "explore-null", {"range": None})

        self.discover_range = create(DiscoverSavedQuery, "discover-range", {"range": "30d"})
        self.discover_stats_period = create(
            DiscoverSavedQuery, "discover-stats", {"statsPeriod": "6h"}
        )

    def test_moves_range_to_stats_period(self) -> None:
        ExploreSavedQuery = self.apps.get_model("explore", "ExploreSavedQuery")
        DiscoverSavedQuery = self.apps.get_model("discover", "DiscoverSavedQuery")

        explore_range = ExploreSavedQuery.objects.get(id=self.explore_range)
        assert explore_range.query == {"statsPeriod": "24h"}

        explore_both = ExploreSavedQuery.objects.get(id=self.explore_both)
        assert explore_both.query == {"statsPeriod": "7d", "query": []}

        explore_stats_period = ExploreSavedQuery.objects.get(id=self.explore_stats_period)
        assert explore_stats_period.query == {"statsPeriod": "1h", "environment": ["prod"]}

        explore_null_range = ExploreSavedQuery.objects.get(id=self.explore_null_range)
        assert explore_null_range.query == {}

        discover_range = DiscoverSavedQuery.objects.get(id=self.discover_range)
        assert discover_range.query == {"range": "30d"}

        discover_stats_period = DiscoverSavedQuery.objects.get(id=self.discover_stats_period)
        assert discover_stats_period.query == {"statsPeriod": "6h"}
