from sentry.testutils.cases import TestMigrations
from sentry.models import SavedSearch, IssueViews, OrganizationMember


class BackfillIssueViewsWithPinnedSearchesTest(TestMigrations):
    migrate_from = "0724_discover_saved_query_dataset"
    migrate_to = "0725_backfill_issue_views_with_pinned_searches"

    def setup_initial_state(self):
        self.user = self.create_user()
        self.saved_search = SavedSearch.objects.create(
            organization=self.org,
            owner_id=self.user.id,
            visibility="owner_pinned",
            query="assigned:me",
            query_sort="date",
        )
        self.org = self.create_organization(owner=self.user)

    def test(self):
        org_member = OrganizationMember.objects.get(organization=self.org, user_id=self.user.id)
        assert org_member

        issue_view = IssueViews.objects.get(org_member_id=org_member.id)
        assert issue_view.org_member_id == org_member.id
        assert issue_view.name == "Default View"
        assert issue_view.query == "assigned:me"
        assert issue_view.query_sort == "date"
