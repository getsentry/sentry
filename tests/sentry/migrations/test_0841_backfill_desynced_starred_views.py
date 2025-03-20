import pytest

from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillDesyncedStarredViewsTest(TestMigrations):
    migrate_from = "0840_savedsearch_type_non_null"
    migrate_to = "0841_backfill_desynced_starred_views"

    def setup_initial_state(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.project = self.create_project(organization=self.organization)

        self.gsv1 = GroupSearchView.objects.create(
            user_id=self.user.id,
            organization_id=self.organization.id,
            name="Test View 1",
            query="is:unresolved",
            position=1,
        )

        GroupSearchViewStarred.objects.create(
            group_search_view=self.gsv1,
            user_id=self.user.id,
            organization_id=self.organization.id,
            position=1,
        )

        self.gsv2 = GroupSearchView.objects.create(
            user_id=self.user.id,
            organization_id=self.organization.id,
            name="Test View 2",
            query="is:resolved",
            position=2,
        )

    def test(self):
        assert GroupSearchViewStarred.objects.count() == 2
        assert GroupSearchViewStarred.objects.get(group_search_view=self.gsv1).position == 1
        assert GroupSearchViewStarred.objects.get(group_search_view=self.gsv2).position == 2
