from django.db.models import QuerySet

from sentry.auth.services.access.impl import ControlAccessService
from sentry.auth.services.auth.serial import serialize_auth_provider
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import RpcOrganizationMemberSummary
from sentry.organizations.services.organization.serial import summarize_member
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

COLLIDING_ID = 2**40


@control_silo_test
class ControlAccessServiceCanOverrideSsoAsOwnerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = ControlAccessService()
        self.org = self.create_organization()

        self.owner = self.create_user()
        self.member = self.create_member(organization=self.org, user=self.owner, role="owner")
        self.other_owner = self.create_user()
        self.other_member = self.create_member(
            organization=self.org, user=self.other_owner, role="owner"
        )

        self.provider = self.create_auth_provider(organization_id=self.org.id, provider="dummy")
        self.rpc_provider = serialize_auth_provider(self.provider)

    def link_other_owner_sso(self) -> None:
        self.create_auth_identity(
            auth_provider=self.provider, user=self.other_owner, ident="other-owner", data={}
        )

    def mapping_for(self, member: OrganizationMember) -> QuerySet[OrganizationMemberMapping]:
        return OrganizationMemberMapping.objects.filter(
            organization_id=self.org.id, organizationmember_id=member.id
        )

    def can_override(self, member: RpcOrganizationMemberSummary) -> bool:
        return self.service.can_override_sso_as_owner(self.rpc_provider, member)

    def test_allowed_when_no_other_owner_has_sso(self) -> None:
        assert self.can_override(summarize_member(self.member))

    def test_blocked_when_another_owner_has_sso(self) -> None:
        self.link_other_owner_sso()

        assert not self.can_override(summarize_member(self.member))

    def test_blocked_when_member_id_collides_with_another_owners_mapping_pk(self) -> None:
        # member.id is a region-silo OrganizationMember.id, sharing no sequence with the
        # control-silo mapping PK, so excluding self by mapping PK can drop another owner.
        self.link_other_owner_sso()
        self.mapping_for(self.other_member).update(id=COLLIDING_ID)
        self.mapping_for(self.member).update(organizationmember_id=COLLIDING_ID)

        assert not self.can_override(
            RpcOrganizationMemberSummary(
                id=COLLIDING_ID, organization_id=self.org.id, user_id=self.owner.id
            )
        )

    def test_blocked_when_another_owner_mapping_has_no_member_id(self) -> None:
        self.link_other_owner_sso()
        self.mapping_for(self.other_member).update(organizationmember_id=None)

        assert not self.can_override(summarize_member(self.member))
