from sentry.api.serializers import serialize
from sentry.api.serializers.models.organizationmemberinvite import (
    OrganizationMemberInviteSerializer,
)
from sentry.testutils.cases import TestCase


class OrganizationMemberInviteSerializerTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.email = "user@email.com"

    def test_simple(self):
        member_invite = self.create_member_invite(organization=self.org, email=self.email)
        result = serialize(member_invite, None, OrganizationMemberInviteSerializer())

        assert result == {
            "id": str(member_invite.id),
            "email": self.email,
            "orgRole": member_invite.role,
            "expired": False,
            "flags": {
                "idp:provisioned": member_invite.idp_provisioned,
                "idp:role-restricted": member_invite.idp_role_restricted,
                "sso:linked": member_invite.sso_linked,
                "sso:invalid": member_invite.sso_invalid,
                "member-limit:restricted": member_invite.member_limit_restricted,
                "partnership:restricted": member_invite.partnership_restricted,
            },
            "teams": {},
            "dateCreated": member_invite.date_added,
            "inviteStatus": member_invite.get_invite_status_name(),
            "inviterName": None,
        }

    def test_teams(self):
        team = self.create_team(organization=self.org)

        member_invite = self.create_member_invite(
            organization=self.org, email=self.email, organization_member_team_data=[team.slug]
        )
        result = serialize(member_invite, None, OrganizationMemberInviteSerializer())

        assert result["teams"] == [team.slug]

    def test_inviter(self):
        user = self.create_user()
        member_invite = self.create_member_invite(
            organization=self.org, email=self.email, inviter_id=user.id
        )
        result = serialize(member_invite, None, OrganizationMemberInviteSerializer())

        assert result["inviterName"] == user.get_display_name()
