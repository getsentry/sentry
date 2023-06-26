from sentry.models import SavedSearch, SearchType
from sentry.testutils.cases import TestMigrations


class BackfillOrganizationMappingsViaOutboxTest(TestMigrations):
    migrate_from = "0493_pickle_to_json_sentry_activity"
    migrate_to = "0494_savedsearch_update_me_myteams"

    def setup_initial_state(self):
        def create_saved_search(query: str) -> SavedSearch:
            return SavedSearch.objects.create(
                organization=self.organization,
                owner_id=self.user.id,
                type=SearchType.ISSUE.value,
                name="name",
                query=query,
            )

        self.should_update = [
            (q, create_saved_search(q), expected)
            for q, expected in [
                ("assigned:me", "assigned:[me, my_teams]"),
                ("assigned:[me]", "assigned:[me, my_teams]"),
                ("assigned:me ", "assigned:[me, my_teams]"),
                ("assigned:[me] ", "assigned:[me, my_teams]"),
                ("assigned:[me, none]", "assigned:[me, my_teams, none]"),
            ]
        ]
        self.should_stay_same = [
            (q, create_saved_search(q))
            for q in [
                "assigned:my_teams",
            ]
        ]

    def test_update_query_with_assigned(self):
        assert SavedSearch.objects.all().count() == len(self.should_update) + len(
            self.should_stay_same
        )

        for before_query, saved_search, expected_query in self.should_update:
            saved_search.refresh_from_db()
            assert saved_search.query != before_query
            assert saved_search.query == expected_query

        for before_query, saved_search in self.should_stay_same:
            saved_search.refresh_from_db()
            assert saved_search.query == before_query
