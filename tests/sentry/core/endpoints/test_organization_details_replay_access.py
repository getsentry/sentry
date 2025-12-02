from sentry.models.organizationmemberreplayaccess import OrganizationMemberReplayAccess
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationDetailsReplayAccessTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @with_feature("organizations:replay-granular-permissions")
    def test_grant_replay_access_to_members(self):
        """Test granting replay access to specific members via organization endpoint"""
        member1 = self.create_member(organization=self.organization, user=self.create_user())
        member2 = self.create_member(organization=self.organization, user=self.create_user())

        response = self.get_success_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[member1.id, member2.id],
        )

        assert response.status_code == 200

        # Verify records were created
        assert OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member1
        ).exists()
        assert OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member2
        ).exists()

    @with_feature("organizations:replay-granular-permissions")
    def test_revoke_replay_access_from_member(self):
        """Test revoking replay access by removing member from list"""
        member1 = self.create_member(organization=self.organization, user=self.create_user())
        member2 = self.create_member(organization=self.organization, user=self.create_user())

        # Grant access to both
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member1
        )
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member2
        )

        # Remove member2 from the list
        response = self.get_success_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[member1.id],
        )

        assert response.status_code == 200

        # Verify member1 still has access
        assert OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member1
        ).exists()

        # Verify member2 access was revoked
        assert not OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member2
        ).exists()

    @with_feature("organizations:replay-granular-permissions")
    def test_replay_access_members_shown_only_to_admins(self):
        """Test that replayAccessMembers is only visible to admins"""
        member = self.create_member(organization=self.organization, user=self.create_user())
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member
        )

        # Admin can see replayAccessMembers
        response = self.get_success_response(self.organization.slug)
        assert response.status_code == 200
        assert "replayAccessMembers" in response.data
        assert member.id in response.data["replayAccessMembers"]

        # Regular member cannot see replayAccessMembers
        regular_user = self.create_user()
        self.create_member(organization=self.organization, user=regular_user, role="member")
        self.login_as(regular_user)

        response = self.get_success_response(self.organization.slug)
        assert response.status_code == 200
        # Should return empty list for non-admins
        assert response.data["replayAccessMembers"] == []

    @with_feature("organizations:replay-granular-permissions")
    def test_replay_access_in_member_serializer(self):
        """Test that individual members have replayAccess boolean in their serialized data"""
        member = self.create_member(organization=self.organization, user=self.create_user())
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member
        )

        # Get member list via APITestCase method
        url = f"/api/0/organizations/{self.organization.slug}/members/"
        response = self.client.get(url, data={"expand": ["roles"]})
        assert response.status_code == 200

        # Find our member in the list
        member_data = next(m for m in response.data if m["id"] == str(member.id))
        assert member_data["replayAccess"] is True

        # Find a member without access
        other_member = self.create_member(organization=self.organization, user=self.create_user())
        response = self.client.get(url, data={"expand": ["roles"]})
        other_member_data = next(m for m in response.data if m["id"] == str(other_member.id))
        assert other_member_data["replayAccess"] is False

    @with_feature("organizations:replay-granular-permissions")
    def test_replay_access_true_when_allowlist_empty(self):
        """Test that all members have replayAccess=True when allowlist is empty"""
        self.create_member(organization=self.organization, user=self.create_user())

        # Ensure allowlist is empty
        OrganizationMemberReplayAccess.objects.filter(organization=self.organization).delete()

        url = f"/api/0/organizations/{self.organization.slug}/members/"
        response = self.client.get(url, data={"expand": ["roles"]})
        assert response.status_code == 200

        # All members should have replayAccess=True when allowlist is empty
        for member_data in response.data:
            assert member_data["replayAccess"] is True

    @with_feature("organizations:replay-granular-permissions")
    def test_member_without_admin_cannot_modify_replay_access(self):
        """Test that non-admin members cannot modify replay access"""
        regular_user = self.create_user()
        self.create_member(organization=self.organization, user=regular_user, role="member")
        self.login_as(regular_user)

        member = self.create_member(organization=self.organization, user=self.create_user())

        # Regular members don't have permission to modify ANY org settings (403 Forbidden)
        response = self.get_error_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[member.id],
            status_code=403,
        )

        assert response.status_code == 403

    def test_feature_flag_disabled_returns_error(self):
        """Test that modifying replay access without feature flag returns error"""
        member = self.create_member(organization=self.organization, user=self.create_user())

        response = self.get_error_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[member.id],
            status_code=400,
        )

        assert "replayAccessMembers" in response.data
        error_message = str(response.data["replayAccessMembers"])
        assert "not enabled" in error_message.lower()

    @with_feature("organizations:replay-granular-permissions")
    def test_member_removed_deletes_replay_access(self):
        """Test that removing a member from org also removes their replay access"""
        member = self.create_member(organization=self.organization, user=self.create_user())
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member
        )

        # Verify access record exists
        assert OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member
        ).exists()

        # Delete the member
        member.delete()

        # Verify access record was automatically deleted (CASCADE)
        assert not OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember_id=member.id
        ).exists()

    @with_feature("organizations:replay-granular-permissions")
    def test_invalid_member_id_returns_error(self):
        """Test that providing invalid member ID returns validation error"""
        response = self.get_error_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[999999],  # Invalid member ID
            status_code=400,
        )

        assert "replayAccessMembers" in response.data
        error_message = str(response.data["replayAccessMembers"])
        assert "invalid" in error_message.lower()

    @with_feature("organizations:replay-granular-permissions")
    def test_removing_all_members_reopens_access(self):
        """Test that removing all members from allowlist reopens access to everyone"""
        member1 = self.create_member(organization=self.organization, user=self.create_user())
        member2 = self.create_member(organization=self.organization, user=self.create_user())

        # Grant access to specific members
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member1
        )
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member2
        )

        # Verify only these members have access
        url = f"/api/0/organizations/{self.organization.slug}/members/"
        response = self.client.get(url, data={"expand": ["roles"]})
        member1_data = next(m for m in response.data if m["id"] == str(member1.id))
        assert member1_data["replayAccess"] is True

        # Remove all members from the list
        response = self.get_success_response(
            self.organization.slug,
            method="put",
            replayAccessMembers=[],
        )
        assert response.status_code == 200

        # Verify all access records were deleted
        assert not OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization
        ).exists()

        # Verify all members now have access
        response = self.client.get(url, data={"expand": ["roles"]})
        for member_data in response.data:
            assert member_data["replayAccess"] is True

    @with_feature("organizations:replay-granular-permissions")
    def test_not_including_replay_access_field_preserves_state(self):
        """Test that not including replayAccessMembers in PUT doesn't change permissions"""
        member = self.create_member(organization=self.organization, user=self.create_user())
        OrganizationMemberReplayAccess.objects.create(
            organization=self.organization, organizationmember=member
        )

        # Update organization without replayAccessMembers field
        response = self.get_success_response(
            self.organization.slug,
            method="put",
            openMembership=True,  # Change a different field
        )
        assert response.status_code == 200

        # Verify replay access was preserved
        assert OrganizationMemberReplayAccess.objects.filter(
            organization=self.organization, organizationmember=member
        ).exists()
