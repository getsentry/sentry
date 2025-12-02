from sentry.models.organizationmemberreplayaccess import OrganizationMemberReplayAccess
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestOrganizationMemberReplayAccess(APITestCase):
    endpoint = "sentry-api-0-organization-member-details"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.member = self.create_member(
            organization=self.organization, user=self.create_user(), role="member"
        )

    def test_grant_replay_access(self):
        """Owner can grant replay access to a member"""
        with self.feature("organizations:replay-granular-permissions"):
            self.login_as(self.user)
            response = self.get_success_response(
                self.organization.slug,
                self.member.id,
                method="PUT",
                replayAccess=True,
            )
            assert response.data["replayAccess"] is True

            assert OrganizationMemberReplayAccess.objects.filter(
                organization=self.organization, organizationmember=self.member
            ).exists()

    def test_revoke_replay_access(self):
        """Owner can revoke replay access from a member"""
        with self.feature("organizations:replay-granular-permissions"):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member
            )

            self.login_as(self.user)
            response = self.get_success_response(
                self.organization.slug,
                self.member.id,
                method="PUT",
                replayAccess=False,
            )
            assert response.data["replayAccess"] is False

            assert not OrganizationMemberReplayAccess.objects.filter(
                organization=self.organization, organizationmember=self.member
            ).exists()

    def test_replay_access_in_serializer(self):
        """Replay access field is included in serializer response"""
        with self.feature("organizations:replay-granular-permissions"):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member
            )

            self.login_as(self.user)
            response = self.get_success_response(
                self.organization.slug,
                self.member.id,
            )
            assert "replayAccess" in response.data
            assert response.data["replayAccess"] is True

    def test_replay_access_false_when_not_in_allowlist(self):
        """Replay access field is False when member is not in allowlist"""
        with self.feature("organizations:replay-granular-permissions"):
            self.login_as(self.user)
            response = self.get_success_response(
                self.organization.slug,
                self.member.id,
            )
            assert "replayAccess" in response.data
            assert response.data["replayAccess"] is False

    def test_member_without_admin_cannot_modify_replay_access(self):
        """Non-admin members cannot modify replay access"""
        regular_user = self.create_user()
        self.create_member(organization=self.organization, user=regular_user, role="member")

        with self.feature("organizations:replay-granular-permissions"):
            self.login_as(regular_user)
            self.get_error_response(
                self.organization.slug,
                self.member.id,
                method="PUT",
                replayAccess=True,
                status_code=403,
            )

    def test_feature_flag_disabled_returns_error(self):
        """When feature flag is disabled, attempting to set replay access returns error"""
        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug,
            self.member.id,
            method="PUT",
            replayAccess=True,
            status_code=403,
        )
        assert "Replay granular permissions are not available" in response.data["detail"]

    def test_member_removed_deletes_replay_access(self):
        """When a member is removed, their replay access is automatically removed via CASCADE"""
        with self.feature("organizations:replay-granular-permissions"):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member
            )

            member_id = self.member.id
            self.member.delete()

            assert not OrganizationMemberReplayAccess.objects.filter(
                organizationmember_id=member_id
            ).exists()
