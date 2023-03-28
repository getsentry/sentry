from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    organizationmember_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits, region_silo_test


@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def test_create_mapping(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "user_id": self.user.id,
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
        }
        rpc_orgmember_mapping = organizationmember_mapping_service.create_mapping(**fields)
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id
        )

        assert rpc_orgmember_mapping.date_added == orgmember_mapping.date_added
        assert (
            rpc_orgmember_mapping.organization_id
            == orgmember_mapping.organization_id
            == self.organization.id
        )
        assert rpc_orgmember_mapping.role == orgmember_mapping.role == "member"
        assert rpc_orgmember_mapping.user_id == orgmember_mapping.user_id == self.user.id
        assert rpc_orgmember_mapping.email is orgmember_mapping.email is None
        assert rpc_orgmember_mapping.inviter_id == orgmember_mapping.inviter_id == inviter.id
        assert (
            rpc_orgmember_mapping.invite_status
            == orgmember_mapping.invite_status
            == fields["invite_status"]
        )

    def test_create_with_org_member(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
        }
        with exempt_from_silo_limits():
            org_member = OrganizationMember.objects.create(**fields)
        rpc_orgmember_mapping = organizationmember_mapping_service.create_with_organization_member(
            org_member
        )
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id
        )

        assert rpc_orgmember_mapping.date_added == orgmember_mapping.date_added
        assert (
            rpc_orgmember_mapping.organization_id
            == orgmember_mapping.organization_id
            == self.organization.id
        )
        assert rpc_orgmember_mapping.role == orgmember_mapping.role == "member"
        assert rpc_orgmember_mapping.user_id is orgmember_mapping.user_id is None
        assert rpc_orgmember_mapping.email == orgmember_mapping.email == fields["email"]
        assert rpc_orgmember_mapping.inviter_id == orgmember_mapping.inviter_id == inviter.id
        assert (
            rpc_orgmember_mapping.invite_status
            == orgmember_mapping.invite_status
            == fields["invite_status"]
        )

    def test_create_is_idempotent(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
        }
        organizationmember_mapping_service.create_mapping(**fields)
        assert (
            OrganizationMemberMapping.objects.filter(
                organization_id=self.organization.id,
                user_id=None,
                email="mail@testserver.com",
                role="member",
            ).count()
            == 1
        )

        next_role = "billing"
        rpc_orgmember_mapping = organizationmember_mapping_service.create_mapping(
            **{
                **fields,
                "role": next_role,
            }
        )

        assert not OrganizationMemberMapping.objects.filter(
            organization_id=self.organization.id, email="mail@testserver.com", role="member"
        ).exists()
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id, email="mail@testserver.com"
        )

        assert rpc_orgmember_mapping.date_added == orgmember_mapping.date_added
        assert (
            rpc_orgmember_mapping.organization_id
            == orgmember_mapping.organization_id
            == self.organization.id
        )
        assert rpc_orgmember_mapping.role == orgmember_mapping.role == next_role
        assert rpc_orgmember_mapping.user_id is orgmember_mapping.user_id is None
        assert rpc_orgmember_mapping.email == orgmember_mapping.email == fields["email"]
        assert rpc_orgmember_mapping.inviter_id == orgmember_mapping.inviter_id == inviter.id
        assert (
            rpc_orgmember_mapping.invite_status
            == orgmember_mapping.invite_status
            == fields["invite_status"]
        )


@region_silo_test(stable=True)
class ReceiverTest(TransactionTestCase):
    def test_process_organization_member_updates_receiver(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
            assert OrganizationMemberMapping.objects.all().count() == 0
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
        }
        org_member = OrganizationMember.objects.create(**fields)
        region_outbox = OrganizationMember.outbox_for_update(
            org_id=self.organization.id, org_member_id=org_member.id
        )
        region_outbox.save()
        region_outbox.drain_shard()

        with exempt_from_silo_limits():
            assert OrganizationMemberMapping.objects.all().count() == 1
            OrganizationMemberMapping.objects.filter(
                organization_id=self.organization.id, email=fields["email"]
            ).exists()
