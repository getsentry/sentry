from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    organizationmember_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
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
                "organizationmember_id": OrganizationMember.objects.get(
                    organization_id=self.organization.id, user_id=self.user.id
                ).id,
            }

        rpc_orgmember_mapping = organizationmember_mapping_service.create_mapping(**fields)
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id
        )

        assert (
            rpc_orgmember_mapping.organizationmember_id == orgmember_mapping.organizationmember_id
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
            org_member=org_member
        )
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id,
            organizationmember_id=org_member.id,
        )

        assert (
            rpc_orgmember_mapping.organizationmember_id == orgmember_mapping.organizationmember_id
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
            om = OrganizationMember.objects.create(**fields)
            fields["organizationmember_id"] = om.id

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

        assert (
            rpc_orgmember_mapping.organizationmember_id == orgmember_mapping.organizationmember_id
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
class ReceiverTest(TransactionTestCase, HybridCloudTestMixin):
    def test_process_organization_member_update_receiver(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
            assert OrganizationMember.objects.all().count() == 0
            assert OrganizationMemberMapping.objects.all().count() == 0
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
        }

        # Creation step of receiver
        org_member = OrganizationMember.objects.create(**fields)
        region_outbox = org_member.outbox_for_create()
        region_outbox.save()
        region_outbox.drain_shard()

        with exempt_from_silo_limits():
            # rows are created for owner, and invited member.
            assert OrganizationMember.objects.all().count() == 2
            assert OrganizationMemberMapping.objects.all().count() == 2
            for org_member in OrganizationMember.objects.all().iterator():
                self.assert_org_member_mapping(org_member=org_member)

        # Update step of receiver
        org_member.update(role="owner")
        region_outbox = org_member.outbox_for_update()
        region_outbox.save()
        region_outbox.drain_shard()

        with exempt_from_silo_limits():
            assert OrganizationMember.objects.all().count() == 2
            assert OrganizationMemberMapping.objects.all().count() == 2
            for org_member in OrganizationMember.objects.all().iterator():
                self.assert_org_member_mapping(org_member=org_member)

    def test_process_organization_member_deletes_receiver(self):
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
        region_outbox = org_member.outbox_for_create()
        region_outbox.save()
        region_outbox.drain_shard()

        with exempt_from_silo_limits():
            # rows are created for owner, and invited member.
            assert OrganizationMember.objects.all().count() == 2
            assert OrganizationMemberMapping.objects.all().count() == 2
            for om in OrganizationMember.objects.all().iterator():
                self.assert_org_member_mapping(org_member=om)

        with outbox_runner():
            org_member.delete()

        with exempt_from_silo_limits():
            assert OrganizationMember.objects.all().count() == 1
            assert OrganizationMemberMapping.objects.all().count() == 1
            self.assert_org_member_mapping_not_exists(org_member=org_member)
