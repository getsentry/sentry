from sentry.models.organizationmemberinvite import InviteStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls


class OrganizationMemberInviteTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
class GetOrganizationMemberInviteTest(OrganizationMemberInviteTestBase):
    def test_simple(self):
        invited_member = self.create_member_invite(
            organization=self.organization, email="matcha@latte.com"
        )
        response = self.get_success_response(self.organization.slug, invited_member.id)
        assert response.data["id"] == str(invited_member.id)
        assert response.data["email"] == "matcha@latte.com"

    def test_invite_request(self):
        # users can also hit this endpoint to view pending invite requests
        invited_member = self.create_member_invite(
            organization=self.organization,
            email="matcha@latte.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        response = self.get_success_response(self.organization.slug, invited_member.id)
        assert response.data["id"] == str(invited_member.id)
        assert response.data["email"] == "matcha@latte.com"
        assert response.data["inviteStatus"] == "requested_to_be_invited"

    def test_get_by_garbage(self):
        self.get_error_response(self.organization.slug, "-1", status_code=404)
