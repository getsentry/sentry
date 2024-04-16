from sentry.models.savedsearch import SavedSearch
from sentry.testutils.cases import TestMigrations


class RenamePrioritySortToTrendsTest(TestMigrations):
    migrate_from = "0653_apitoken_add_token_type"
    migrate_to = "0654_rename_priority_sort_to_trends"

    def setup_before_migration(self, apps):
        self.priority_searches = []
        for i in range(3):
            self.priority_searches.append(
                SavedSearch.objects.create(
                    organization=self.organization, query="is:unresolved", sort="priority"
                )
            )

        self.other_searches = [
            SavedSearch.objects.create(organization=self.organization, query="is:unresolved"),
            SavedSearch.objects.create(
                organization=self.organization, query="is:unresolved", sort="date"
            ),
        ]

    def test(self):
        for search in self.priority_searches:
            search.refresh_from_db()
            assert search.sort == "trends"

        for search in self.other_searches:
            search.refresh_from_db()
            assert search.sort == "date"
