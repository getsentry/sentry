from sentry.models.organizationmemberreplayaccess import OrganizationMemberReplayAccess
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestReplayGranularPermissions(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.user_with_access = self.create_user()
        self.user_without_access = self.create_user()

        self.member_with_access = self.create_member(
            organization=self.organization, user=self.user_with_access
        )
        self.member_without_access = self.create_member(
            organization=self.organization, user=self.user_without_access
        )

    def test_organization_replay_index_with_permission(self):
        """User with replay permission can access org replay index"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_with_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_organization_replay_index_without_permission(self):
        """User without replay permission cannot access org replay index"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_organization_replay_details_with_permission(self):
        """User with replay permission can access org replay details"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_with_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            assert response.status_code in [200, 404]

    def test_organization_replay_details_without_permission(self):
        """User without replay permission cannot access org replay details"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_organization_replay_count_without_permission(self):
        """User without replay permission cannot access org replay count"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replay-count/"
            response = self.client.get(url, {"query": "issue.id:1"})
            assert response.status_code == 403

    def test_project_replay_details_without_permission(self):
        """User without replay permission cannot access project replay details"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_empty_allowlist_allows_all_users(self):
        """When allowlist is empty, all org members have access"""
        with self.feature(
            ["organizations:session-replay", "organizations:replay-granular-permissions"]
        ):
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_feature_flag_disabled_allows_all_users(self):
        """When feature flag is disabled, all org members have access"""
        with self.feature("organizations:session-replay"):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200
