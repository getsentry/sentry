from sentry.models.groupsearchview import GroupSearchView
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.testutils.cases import TestMigrations


class ConvertOrgSavedSearchesToViewsTest(TestMigrations):
    migrate_from = "0920_convert_org_saved_searches_to_views_revised"
    migrate_to = "0921_convert_org_saved_searches_to_views_rerevised"

    def setup_initial_state(self):
        self.org = self.create_organization()
        self.user = self.create_user()

        self.org_saved_search = SavedSearch.objects.create(
            name="Org Saved Search",
            organization=self.org,
            owner_id=self.user.id,
            visibility=Visibility.ORGANIZATION,
            query="is:unresolved",
        )

        self.org_saved_search_view = GroupSearchView.objects.create(
            organization=self.org,
            user_id=self.user.id,
            name="Org Saved Search (already converted)",
            query="is:resolved",
            query_sort=SortOptions.DATE,
        )
        # This should not be converted
        self.converted_org_saved_search = SavedSearch.objects.create(
            name="Org Saved Search (already converted)",
            organization=self.org,
            sort=SortOptions.DATE,
            owner_id=self.user.id,
            visibility=Visibility.ORGANIZATION,
            query="is:resolved",
        )

        self.user_saved_search = SavedSearch.objects.create(
            name="User Saved Search",
            organization=self.org,
            owner_id=self.user.id,
            visibility=Visibility.OWNER,
            query="is:resolved",
        )

    def test_convert_org_saved_searches_to_views(self):
        assert GroupSearchView.objects.count() == 2
        org_view = GroupSearchView.objects.get(
            organization=self.org, user_id=self.user.id, name="Org Saved Search"
        )

        assert org_view.query == self.org_saved_search.query
