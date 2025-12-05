from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmemberreplayaccess import OrganizationMemberReplayAccess
from sentry.replays.permissions import has_replay_permission
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestReplayPermissions(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.user3 = self.create_user()
        self.member1 = self.create_member(organization=self.organization, user=self.user1)
        self.member2 = self.create_member(organization=self.organization, user=self.user2)
        self.member3 = self.create_member(organization=self.organization, user=self.user3)

    def _enable_granular_permissions(self) -> None:
        """Enable the organization option for granular replay permissions"""
        OrganizationOption.objects.set_value(
            organization=self.organization,
            key="sentry:granular-replay-permissions",
            value=True,
        )

    def test_feature_flag_disabled_returns_true(self) -> None:
        """When feature flag is disabled, all members should have access"""
        self._enable_granular_permissions()
        assert has_replay_permission(self.organization, self.user1) is True

    def test_org_option_disabled_returns_true(self) -> None:
        """When org option is disabled, all members should have access even with allowlist"""
        with self.feature("organizations:granular-replay-permissions"):
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member1
            )
            assert has_replay_permission(self.organization, self.user2) is True

    def test_empty_allowlist_returns_true(self) -> None:
        """When allowlist is empty, all members should have access"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            assert has_replay_permission(self.organization, self.user1) is True
            assert has_replay_permission(self.organization, self.user2) is True

    def test_member_in_allowlist_returns_true(self) -> None:
        """When member is in allowlist, they should have access"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member1
            )
            assert has_replay_permission(self.organization, self.user1) is True

    def test_member_not_in_allowlist_returns_false(self) -> None:
        """When member is not in allowlist and allowlist exists, they should not have access"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member1
            )
            assert has_replay_permission(self.organization, self.user2) is False

    def test_multiple_members_in_allowlist(self) -> None:
        """Test multiple members in allowlist"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member1
            )
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member2
            )

            assert has_replay_permission(self.organization, self.user1) is True
            assert has_replay_permission(self.organization, self.user2) is True
            assert has_replay_permission(self.organization, self.user3) is False

    def test_non_member_returns_false(self) -> None:
        """Non-members should not have access"""
        non_member_user = self.create_user()
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            assert has_replay_permission(self.organization, non_member_user) is False

    def test_unauthenticated_user_returns_false(self) -> None:
        """Unauthenticated users should not have access"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            assert has_replay_permission(self.organization, None) is False

    def test_disabling_org_option_reopens_access(self) -> None:
        """When org option is disabled after being enabled, access is restored"""
        with self.feature("organizations:granular-replay-permissions"):
            self._enable_granular_permissions()
            OrganizationMemberReplayAccess.objects.create(
                organization=self.organization, organizationmember=self.member1
            )
            assert has_replay_permission(self.organization, self.user2) is False

            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=False,
            )
            assert has_replay_permission(self.organization, self.user2) is True
