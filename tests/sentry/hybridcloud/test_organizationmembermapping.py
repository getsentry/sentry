from django.db import router, transaction

from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    RpcOrganizationMemberMappingUpdate,
    organizationmember_mapping_service,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test


@control_silo_test
class OrganizationMappingTest(TransactionTestCase, HybridCloudTestMixin):
    def test_upsert_stale_user_id(self):
        organizationmember_mapping_service.upsert_mapping(
            organization_id=self.organization.id,
            organizationmember_id=111111,
            mapping=RpcOrganizationMemberMappingUpdate(
                role=self.organization.default_role,
                user_id=10001,
                email=None,
                inviter_id=self.user.id,
                invite_status=None,
            ),
        )

        omm = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id, organizationmember_id=111111
        )
        assert omm.user_id is None
        assert omm.inviter_id == self.user.id

    def test_upsert_stale_inviter_id(self):
        self.user
        self.organization

        with transaction.atomic(router.db_for_write(OrganizationMemberMapping)):
            organizationmember_mapping_service.upsert_mapping(
                organization_id=self.organization.id,
                organizationmember_id=111111,
                mapping=RpcOrganizationMemberMappingUpdate(
                    role=self.organization.default_role,
                    user_id=self.user.id,
                    email=None,
                    inviter_id=1000001,
                    invite_status=None,
                ),
            )

            omm = OrganizationMemberMapping.objects.get(
                organization_id=self.organization.id, organizationmember_id=111111
            )
            assert omm.user_id == self.user.id
            assert omm.inviter_id is None

    def test_upsert_email_invite(self):
        om = OrganizationMember(
            role="member",
            email="foo@example.com",
            organization_id=self.organization.id,
        )
        rpc_orgmember_mapping = organizationmember_mapping_service.upsert_mapping(
            organization_id=self.organization.id,
            organizationmember_id=111111,
            mapping=RpcOrganizationMemberMappingUpdate.from_orm(om),
        )

        assert rpc_orgmember_mapping is not None
        assert rpc_orgmember_mapping.email == "foo@example.com"
        assert rpc_orgmember_mapping.user_id is None
        assert rpc_orgmember_mapping.organization_id == self.organization.id

        om.user_id = self.create_user().id
        om.email = None

        rpc_orgmember_mapping = organizationmember_mapping_service.upsert_mapping(
            organization_id=self.organization.id,
            organizationmember_id=111111,
            mapping=RpcOrganizationMemberMappingUpdate.from_orm(om),
        )

        assert rpc_orgmember_mapping is not None
        assert rpc_orgmember_mapping.user_id == om.user_id

    def test_upsert_happy_path(self):
        inviter = self.create_user("foo@example.com")
        with assume_test_silo_mode(SiloMode.REGION):
            om_id = OrganizationMember.objects.get(
                organization_id=self.organization.id, user_id=self.user.id
            ).id

        rpc_orgmember_mapping = organizationmember_mapping_service.upsert_mapping(
            organization_id=self.organization.id,
            organizationmember_id=om_id,
            mapping=RpcOrganizationMemberMappingUpdate(
                role="member",
                user_id=self.user.id,
                email=None,
                inviter_id=inviter.id,
                invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            ),
        )
        orgmember_mapping = OrganizationMemberMapping.objects.get(
            organization_id=self.organization.id
        )

        assert rpc_orgmember_mapping is not None
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
            == InviteStatus.REQUESTED_TO_BE_INVITED.value
        )

    def test_create_mapping_updates_org_members(self):
        assert self.user.is_active
        self.user.is_active = False
        self.user.save()

        with outbox_runner():
            org = self.create_organization("test", owner=self.user)
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(organization_id=org.id, user_id=self.user.id)
        assert not om.user_is_active

    def test_save_user_pushes_is_active(self):
        with outbox_runner():
            org = self.create_organization("test", owner=self.user)
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(organization_id=org.id, user_id=self.user.id)
        assert om.user_is_active

        with outbox_runner():
            self.user.is_active = False
            self.user.save()

        with assume_test_silo_mode(SiloMode.REGION):
            om.refresh_from_db()
        assert not om.user_is_active

    def test_update_user_pushes_is_active(self):
        with outbox_runner():
            org = self.create_organization("test", owner=self.user)
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(organization_id=org.id, user_id=self.user.id)
        assert om.user_is_active

        with outbox_runner():
            self.user.update(is_active=False)

        om.refresh_from_db()
        assert not om.user_is_active


@region_silo_test
class ReceiverTest(TransactionTestCase, HybridCloudTestMixin):
    def test_process_organization_member_update_receiver(self):
        inviter = self.create_user("foo@example.com")
        assert OrganizationMember.objects.all().count() == 0

        with assume_test_silo_mode(SiloMode.CONTROL):
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

        assert OrganizationMember.objects.all().count() == 2
        with assume_test_silo_mode(SiloMode.CONTROL):
            # rows are created for owner, and invited member.
            assert OrganizationMemberMapping.objects.all().count() == 2

        for org_member in OrganizationMember.objects.all().iterator():
            self.assert_org_member_mapping(org_member=org_member)

        # Update step of receiver
        org_member.update(role="owner")

        assert OrganizationMember.objects.all().count() == 2
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrganizationMemberMapping.objects.all().count() == 2

        for org_member in OrganizationMember.objects.all().iterator():
            self.assert_org_member_mapping(org_member=org_member)

    def test_process_organization_member_deletes_receiver(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
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

        assert OrganizationMember.objects.all().count() == 2
        with assume_test_silo_mode(SiloMode.CONTROL):
            # rows are created for owner, and invited member.
            assert OrganizationMemberMapping.objects.all().count() == 2

        for om in OrganizationMember.objects.all().iterator():
            self.assert_org_member_mapping(org_member=om)

        with outbox_runner():
            org_member.delete()

        assert OrganizationMember.objects.all().count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrganizationMemberMapping.objects.all().count() == 1
            self.assert_org_member_mapping_not_exists(org_member=org_member)
