from typing import int
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organizationmemberinvite import (
    OrganizationMemberInviteSerializer,
)
from sentry.testutils.cases import TestCase


class OrganizationMemberInviteSerializerTest(TestCase):
    def setUp(self) -> None:
        self.org = self.create_organization()
        self.email = "user@email.com"

    def test_simple(self) -> None:
        member_invite = self.create_member_invite(
            organization=self.org, email=self.email, organization_member_team_data=[]
        )
        result = serialize(member_invite, None, OrganizationMemberInviteSerializer())

        assert result == {
            "id": str(member_invite.id),
            "email": self.email,
            "orgRole": member_invite.role,
            "expired": False,
            "idpProvisioned": member_invite.idp_provisioned,
            "idpRoleRestricted": member_invite.idp_role_restricted,
            "ssoLinked": member_invite.sso_linked,
            "ssoInvalid": member_invite.sso_invalid,
            "memberLimitRestricted": member_invite.member_limit_restricted,
            "partnershipRestricted": member_invite.partnership_restricted,
            "teams": [],
            "dateCreated": member_invite.date_added,
            "inviteStatus": member_invite.get_invite_status_name(),
            "inviterName": None,
        }

    def test_teams(self) -> None:
        team = self.create_team(organization=self.org)

        member_invite = self.create_member_invite(
            organization=self.org,
            email=self.email,
            organization_member_team_data=[{"id": team.id, "slug": team.slug}],
        )
        result = serialize(member_invite, None)

        assert result["teams"] == [{"id": team.id, "slug": team.slug}]

    def test_inviter(self) -> None:
        user = self.create_user()
        member_invite = self.create_member_invite(
            organization=self.org, email=self.email, inviter_id=user.id
        )
        result = serialize(member_invite, None)

        assert result["inviterName"] == user.get_display_name()
