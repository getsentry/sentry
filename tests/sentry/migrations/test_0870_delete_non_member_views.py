from sentry.models.groupsearchview import GroupSearchView
from sentry.testutils.cases import TestMigrations


class DeleteNonMemberViewsTest(TestMigrations):
    migrate_from = "0869_fix_drift_db_default_pt2"
    migrate_to = "0870_delete_non_member_views"

    def setup_initial_state(self):
        self.user = self.create_user("member@example.com")
        self.non_member_user = self.create_user("nonmember@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        # View for the member user
        self.member_view = GroupSearchView.objects.create(
            user_id=self.user.id,
            organization_id=self.org.id,
            name="Member's View",
            query="",
        )

        # View for the non-member user
        self.non_member_view = GroupSearchView.objects.create(
            user_id=self.non_member_user.id,
            organization_id=self.org.id,
            name="Non-Member's View",
            query="",
        )

        # Verify initial state
        assert GroupSearchView.objects.count() == 2
        assert GroupSearchView.objects.filter(user_id=self.user.id).exists()
        assert GroupSearchView.objects.filter(user_id=self.non_member_user.id).exists()

    def test_deletes_non_member_views(self):
        # Non-member view should be deleted
        assert not GroupSearchView.objects.filter(id=self.non_member_view.id).exists()

        # Member view should still exist
        assert GroupSearchView.objects.filter(id=self.member_view.id).exists()

        # Final count should be 1
        assert GroupSearchView.objects.count() == 1
