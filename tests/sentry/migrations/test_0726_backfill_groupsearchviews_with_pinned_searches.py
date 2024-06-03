from sentry.models.groupsearchview import GroupSearchView
from sentry.models.savedsearch import SavedSearch
from sentry.testutils.cases import TestMigrations


class BackfillIssueViewsWithPinnedSearchesTest(TestMigrations):
    migrate_from = "0725_create_sentry_groupsearchview_table"
    migrate_to = "0726_backfill_groupsearchviews_with_pinned_searches"

    def setup_initial_state(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.saved_search = SavedSearch.objects.create(
            organization=self.org,
            owner_id=self.user.id,
            visibility="owner_pinned",
            query="assigned:me",
            query_sort="date",
        )

    def test(self):
        custom_view = GroupSearchView.objects.get(org_member_id=self.user.id)

        assert custom_view
        assert custom_view.organizaiton == self.org
        assert custom_view.user_id == self.user.id
        assert custom_view.name == "Default View"
        assert custom_view.query == "assigned:me"
        assert custom_view.query_sort == "date"
