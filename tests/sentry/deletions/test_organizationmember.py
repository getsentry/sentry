from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organizationmember import OrganizationMember
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

    def test_only_org_specific_views_deleted(self):
        # If a member is removed from an organization, only their custom views in that organization should be deleted.
        org_one = self.create_organization(name="test1")
        org_two = self.create_organization(name="test2")
        user = self.create_user()
        member_one = self.create_member(organization=org_one, user=user)
        member_two = self.create_member(organization=org_two, user=user)

        custom_view_one = GroupSearchView.objects.create(
            organization=org_one,
            user_id=user.id,
            name="Custom View",
            query="is:unresolved",
            query_sort="date",
            position=0,
        )

        custom_view_two = GroupSearchView.objects.create(
            organization=org_two,
            user_id=user.id,
            name="Custom View",
            query="is:unresolved",
            query_sort="date",
            position=0,
        )

        self.ScheduledDeletion.schedule(instance=member_one, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not OrganizationMember.objects.filter(id=member_one.id).exists()
        assert not GroupSearchView.objects.filter(id=custom_view_one.id).exists()

        assert OrganizationMember.objects.filter(id=member_two.id).exists()
        assert GroupSearchView.objects.filter(id=custom_view_two.id).exists()
