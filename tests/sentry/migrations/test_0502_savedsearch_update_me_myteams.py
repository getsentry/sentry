import pytest

from sentry.models.savedsearch import SavedSearch
from sentry.models.search_common import SearchType
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration 0545 results in this failing even with reverse operations.")
class BackfillSaveSearchAssignedQueryTest(TestMigrations):
    migrate_from = "0501_typed_bitfield_remove_labels"
    migrate_to = "0502_savedsearch_update_me_myteams"

    def setup_initial_state(self):
        def create_saved_search(query: str) -> SavedSearch:
            saved = SavedSearch.objects.create(
                organization=self.organization,
                owner_id=self.user.id,
                type=SearchType.ISSUE.value,
                name="name",
                query=query,
            )
            assert saved.query == query
            return saved

        self.should_update = [
            (q, create_saved_search(q), expected)
            for q, expected in [
                ("assigned:me", "assigned:[me, my_teams]"),
                ("assigned:[me]", "assigned:[me, my_teams]"),
                ("assigned:me ", "assigned:[me, my_teams]"),
                ("assigned:[me] ", "assigned:[me, my_teams]"),
                ("assigned:[me, none]", "assigned:[me, my_teams, none]"),
                (
                    "assigned:[me, test@example.com, none]",
                    "assigned:[me, my_teams, test@example.com, none]",
                ),
                ("assigned:[me, me]", "assigned:[me, my_teams, me]"),
                (
                    "assigned_or_suggested:[me, #a_team]",
                    "assigned_or_suggested:[me, my_teams, #a_team]",
                ),
                (
                    "assigned_or_suggested:[me,test@example.com,none]",
                    "assigned_or_suggested:[me, my_teams, test@example.com, none]",
                ),
                (
                    "assigned:[me] assigned:[me]",
                    "assigned:[me, my_teams] assigned:[me, my_teams]",
                ),
                (
                    "is:unresolved assigned:[me] bookmarks:me assigned:[me, none, test@example.com] release:test",
                    "is:unresolved assigned:[me, my_teams] bookmarks:me assigned:[me, my_teams, none, test@example.com] release:test",
                ),
                (
                    "assigned:my_teams assigned:me",
                    "assigned:my_teams assigned:[me, my_teams]",
                ),
                (
                    'assigned:[me, #a_team, "string with spaces", test@example.com]',
                    'assigned:[me, my_teams, #a_team, "string with spaces", test@example.com]',
                ),
                (
                    "is:unresolved level:error assigned:[me, none]",
                    "is:unresolved level:error assigned:[me, my_teams, none]",
                ),
                (
                    "assigned:[me, none] is:unresolved level:error",
                    "assigned:[me, my_teams, none] is:unresolved level:error",
                ),
            ]
        ]
        self.should_remain_unchanged = [
            (q, create_saved_search(q))
            for q in [
                "assigned:my_teams",
                "assigned:none",
                "assigned:[none]",
                "bookmarks:me",
                "suggested:me",
                "assigned_or_suggested:[me",
                'assigned:"[me, none]"',
            ]
        ]

    def test_update_query_with_assigned(self):
        assert SavedSearch.objects.all().count() == len(self.should_update) + len(
            self.should_remain_unchanged
        )

        for before_query, saved_search, expected_query in self.should_update:
            saved_search.refresh_from_db()
            assert saved_search.query == expected_query

        for before_query, saved_search in self.should_remain_unchanged:
            saved_search.refresh_from_db()
            assert saved_search.query == before_query
