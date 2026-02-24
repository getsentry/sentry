from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organization import Organization
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

    def _create_org_member_with_external_actor(self, org: Organization) -> OrganizationMember:
        user = self.create_user()
        member = self.create_member(organization=org, user=user)
        external_actor = self.create_external_user(user=user, organization=org)

        return member, external_actor

    def test_deletes_external_actor(self) -> None:
        organization = self.create_organization(name="test")

        member, external_actor = self._create_org_member_with_external_actor(organization)
        unaffected_members = [
            self._create_org_member_with_external_actor(organization) for _ in range(3)
        ]

        self.ScheduledDeletion.schedule(instance=member, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not OrganizationMember.objects.filter(id=member.id).exists()
        assert not ExternalActor.objects.filter(id=external_actor.id).exists()

        for member, external_actor in unaffected_members:
            assert OrganizationMember.objects.filter(id=member.id).exists()
            assert ExternalActor.objects.filter(id=external_actor.id).exists()
