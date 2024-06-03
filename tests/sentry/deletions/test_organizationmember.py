from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organizationmember import OrganizationMember
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteOrganizationMemberTest(APITestCase, TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        organization = self.create_organization(name="test")
        user = self.create_user()
        member = self.create_member(organization=organization, user=user)
        custom_view = GroupSearchView.objects.create(
            organization=organization,
            user_id=user.id,
            name="Custom View",
            query="is:unresolved",
            query_sort="date",
            position=0,
        )

        self.ScheduledDeletion.schedule(instance=member, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not OrganizationMember.objects.filter(id=member.id).exists()
        assert not GroupSearchView.objects.filter(id=custom_view.id).exists()
