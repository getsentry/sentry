from typing import int
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.organizationmember import OrganizationMember
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteOrganizationMemberTest(APITestCase, TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self) -> None:
        organization = self.create_organization(name="test")
        user = self.create_user()
        member = self.create_member(organization=organization, user=user)
        self.ScheduledDeletion.schedule(instance=member, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not OrganizationMember.objects.filter(id=member.id).exists()
