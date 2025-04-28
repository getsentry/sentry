from sentry.models.groupsearchview import GroupSearchView
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.testutils.cases import TestMigrations


class ConvertOrgSavedSearchesToViewsTest(TestMigrations):
    migrate_from = "0872_fix_drift_deleted_columns"
    migrate_to = "0873_convert_org_saved_searches_to_views"

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

        self.user_saved_search = SavedSearch.objects.create(
            name="User Saved Search",
            organization=self.org,
            owner_id=self.user.id,
            visibility=Visibility.OWNER,
            query="is:resolved",
        )

    def test_convert_org_saved_searches_to_views(self):
        assert GroupSearchView.objects.count() == 1
        org_view = GroupSearchView.objects.get(organization=self.org, user_id=self.user.id)

        assert org_view.query == self.org_saved_search.query
