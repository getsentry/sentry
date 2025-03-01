from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import TestMigrations


class BackfillGroupSearchViewPositionsTest(TestMigrations):
    migrate_from = "0836_create_groupsearchviewstarred_table"
    migrate_to = "0837_backfill_groupsearchview_positions_to_gsvstarred"

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
