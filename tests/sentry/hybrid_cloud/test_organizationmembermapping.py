from sentry.models.organizationmember import InviteStatus
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    organizationmember_mapping_service,
)
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits


@control_silo_test(stable=True)
class OrganizationMappingTest(TransactionTestCase):
    def test_create(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "user_id": self.user.id,
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
            "idempotency_key": "random-key",
        }
        rpc_orgmember_mapping = organizationmember_mapping_service.create(**fields)
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id
        )

        assert rpc_orgmember_mapping.date_created == orgmember_mapping.date_created
        assert (
            rpc_orgmember_mapping.organization_id
            == orgmember_mapping.organization_id
            == self.organization.id
        )
        assert rpc_orgmember_mapping.role == orgmember_mapping.role == "member"
        assert rpc_orgmember_mapping.user_id == orgmember_mapping.user_id == self.user.id
        assert rpc_orgmember_mapping.email == orgmember_mapping.email == fields["email"]
        assert rpc_orgmember_mapping.inviter_id == orgmember_mapping.inviter_id == inviter.id
        assert (
            rpc_orgmember_mapping.invite_status
            == orgmember_mapping.invite_status
            == fields["invite_status"]
        )
        assert orgmember_mapping.idempotency_key == fields["idempotency_key"]

    def test_create_is_idempotent(self):
        with exempt_from_silo_limits():
            inviter = self.create_user("foo@example.com")
        fields = {
            "organization_id": self.organization.id,
            "role": "member",
            "user_id": self.user.id,
            "email": "mail@testserver.com",
            "inviter_id": inviter.id,
            "invite_status": InviteStatus.REQUESTED_TO_JOIN.value,
            "idempotency_key": "random-key",
        }
        organizationmember_mapping_service.create(**fields)
        assert (
            OrganizationMemberMapping.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id, role="member"
            ).count()
            == 1
        )

        next_role = "billing"
        rpc_orgmember_mapping = organizationmember_mapping_service.create(
            **{
                **fields,
                "role": next_role,
            }
        )

        assert not OrganizationMemberMapping.objects.filter(
            organization_id=self.organization.id, user_id=self.user.id, role="member"
        ).exists()
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id, user_id=self.user.id
        )
        assert orgmember_mapping.idempotency_key == fields["idempotency_key"]

        assert rpc_orgmember_mapping.date_created == orgmember_mapping.date_created
        assert (
            rpc_orgmember_mapping.organization_id
            == orgmember_mapping.organization_id
            == self.organization.id
        )
        assert rpc_orgmember_mapping.role == orgmember_mapping.role == next_role
        assert rpc_orgmember_mapping.user_id == orgmember_mapping.user_id == self.user.id
        assert rpc_orgmember_mapping.email == orgmember_mapping.email == fields["email"]
        assert rpc_orgmember_mapping.inviter_id == orgmember_mapping.inviter_id == inviter.id
        assert (
            rpc_orgmember_mapping.invite_status
            == orgmember_mapping.invite_status
            == fields["invite_status"]
        )
