import pytest

from sentry.models.groupsearchview import GroupSearchView
from sentry.models.savedsearch import SavedSearch
from sentry.testutils.cases import TestMigrations


class BackfillGroupSearchViewsWithPinnedSearchesTest(TestMigrations):
    migrate_from = "0728_incident_subscription_fk"
    migrate_to = "0729_backfill_groupsearchviews_with_pinned_searches"

    def setup_initial_state(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.saved_search = SavedSearch.objects.create(
            organization=self.org,
            owner_id=self.user.id,
            visibility="owner_pinned",
            query="assigned:me",
            sort="date",
        )

    @pytest.mark.skip(reason="old migration test")
    def test(self):
        custom_views = GroupSearchView.objects.filter(organization=self.org, user_id=self.user.id)
        assert custom_views.count() == 2

        pinned_search = custom_views.get(position=0)
        default_search = custom_views.get(position=1)

        assert pinned_search
        assert pinned_search.organization == self.org
        assert pinned_search.user_id == self.user.id
        assert default_search
        assert default_search.organization == self.org
        assert default_search.user_id == self.user.id

        assert pinned_search.position == 0
        assert pinned_search.name == "Default Search"
        assert pinned_search.query == "assigned:me"
        assert pinned_search.query_sort == "date"

        assert default_search.position == 1
        assert default_search.name == "Prioritized"
        assert default_search.query == "is:unresolved issue.priority:[high, medium]"
        assert default_search.query_sort == "date"
