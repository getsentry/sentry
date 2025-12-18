from sentry.models.options.organization_option import OrganizationOption
from sentry.replays.models import OrganizationMemberReplayAccess
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestReplayGranularPermissions(APITestCase):
    def setUp(self) -> None:
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

    def _enable_granular_permissions(self) -> None:
        """Enable the organization option for granular replay permissions"""
        OrganizationOption.objects.set_value(
            organization=self.organization,
            key="sentry:granular-replay-permissions",
            value=True,
        )

    def test_organization_replay_index_with_permission(self) -> None:
        """User with replay permission can access org replay index"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_with_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_organization_replay_index_without_permission(self) -> None:
        """User without replay permission cannot access org replay index"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_organization_replay_details_with_permission(self) -> None:
        """User with replay permission can access org replay details (gets 404 for non-existent replay, not 403)"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_with_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            # Should get 404 for non-existent replay, NOT 403 Forbidden (which would indicate permission denial)
            assert response.status_code == 404

    def test_organization_replay_details_without_permission(self) -> None:
        """User without replay permission cannot access org replay details"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_organization_replay_count_without_permission(self) -> None:
        """User without replay permission cannot access org replay count"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replay-count/"
            response = self.client.get(url, {"query": "issue.id:1"})
            assert response.status_code == 403

    def test_project_replay_details_without_permission(self) -> None:
        """User without replay permission cannot access project replay details"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/123e4567-e89b-12d3-a456-426614174000/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_empty_allowlist_denies_all_users(self) -> None:
        """When allowlist is empty and org option is enabled, no org members have access"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_org_option_disabled_allows_all_users(self) -> None:
        """When org option is disabled, all org members have access even with allowlist"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_feature_flag_disabled_allows_all_users(self) -> None:
        """When feature flag is disabled, all org members have access"""
        with self.feature("organizations:session-replay"):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )
            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_removing_last_user_from_allowlist_keeps_access_denied(self) -> None:
        """When the last user is removed from allowlist, access remains denied (empty allowlist = no access)"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            access_record = OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )

            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

            access_record.delete()

            assert not OrganizationMemberReplayAccess.objects.filter(
                organizationmember__organization=self.organization
            ).exists()

            response = self.client.get(url)
            assert response.status_code == 403

    def test_disabling_org_option_reopens_access(self) -> None:
        """When org option is disabled, all org members regain access"""
        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )

            self.login_as(self.user_without_access)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=False,
            )

            response = self.client.get(url)
            assert response.status_code == 200

    def test_inactive_superuser_does_not_have_access(self) -> None:
        """Superuser without active superuser session cannot bypass granular permissions"""
        superuser = self.create_user(is_superuser=True)
        self.create_member(organization=self.organization, user=superuser)

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )

            self.login_as(superuser)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 403

    def test_staff_always_has_access(self) -> None:
        """Staff can access replay data even when not in allowlist"""
        staff_user = self.create_user(is_staff=True)
        self.create_member(organization=self.organization, user=staff_user)

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organizationmember=self.member_with_access
            )

            self.login_as(staff_user, staff=True)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200

    def test_staff_access_with_empty_allowlist(self) -> None:
        """Staff can access replay data even when allowlist is empty"""
        staff_user = self.create_user(is_staff=True)
        self.create_member(organization=self.organization, user=staff_user)

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            self._enable_granular_permissions()

            self.login_as(staff_user, staff=True)
            url = f"/api/0/organizations/{self.organization.slug}/replays/"
            response = self.client.get(url)
            assert response.status_code == 200
