from datetime import datetime, timezone
from unittest import mock
from unittest.mock import patch

from django.core.cache import cache

from sentry.data_secrecy.logic import (
    data_access_grant_exists,
    should_allow_superuser_access,
    should_allow_superuser_access_v2,
)
from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus
from sentry.data_secrecy.types import EffectiveGrantStatus, GrantCacheStatus
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
class ShouldAllowSuperuserAccessTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization.flags.prevent_superuser_access = True
        self.rpc_org = RpcOrganization(id=self.organization.id)
        self.rpc_org.flags.prevent_superuser_access = True

        self.rpc_orgmember = RpcOrganizationMember(
            organization_id=self.organization.id,
            role="admin",
            user_id=self.user.id,
        )
        self.rpc_context = RpcUserOrganizationContext(
            user_id=self.user.id, organization=self.rpc_org, member=self.rpc_orgmember
        )

    def test_self_hosted(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=True):
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    def test_feature_flag_disabled(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            # Feature flag is disabled by default in test setup
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    def test_bit_flag_disabled(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy"):
                self.organization.flags.prevent_superuser_access = False
                self.rpc_org.flags.prevent_superuser_access = False
                assert should_allow_superuser_access(self.organization) is True
                assert should_allow_superuser_access(self.rpc_context) is True

    def test_fully_enabled_data_secrecy(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy"):
                # prevent_superuser_access is already True from setUp
                assert should_allow_superuser_access(self.organization) is False
                assert should_allow_superuser_access(self.rpc_context) is False


@all_silo_test(regions=create_test_regions("us"))
class ShouldAllowSuperuserAccessV2Test(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization.flags.prevent_superuser_access = True
        self.rpc_org = RpcOrganization(id=self.organization.id)
        self.rpc_org.flags.prevent_superuser_access = True

        self.rpc_orgmember = RpcOrganizationMember(
            organization_id=self.organization.id,
            role="admin",
            user_id=self.user.id,
        )
        self.rpc_context = RpcUserOrganizationContext(
            user_id=self.user.id, organization=self.rpc_org, member=self.rpc_orgmember
        )

    def test_self_hosted(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=True):
            assert should_allow_superuser_access_v2(self.organization) is True
            assert should_allow_superuser_access_v2(self.rpc_context) is True

    def test_feature_flag_disabled(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            # Feature flag is disabled by default in test setup
            assert should_allow_superuser_access_v2(self.organization) is True
            assert should_allow_superuser_access_v2(self.rpc_context) is True

    def test_bit_flag_disabled(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                self.organization.flags.prevent_superuser_access = False
                self.rpc_org.flags.prevent_superuser_access = False
                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.rpc_context) is True

    @patch("sentry.data_secrecy.logic.data_access_grant_exists")
    def test_with_active_grant(self, mock_grant_exists: mock.MagicMock) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                mock_grant_exists.return_value = True

                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.rpc_context) is True

                # Verify the function was called with correct organization ID
                mock_grant_exists.assert_called_with(self.organization.id)

    @patch("sentry.data_secrecy.logic.data_access_grant_exists")
    def test_no_active_grant(self, mock_grant_exists: mock.MagicMock) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                mock_grant_exists.return_value = False

                assert should_allow_superuser_access_v2(self.organization) is False
                assert should_allow_superuser_access_v2(self.rpc_context) is False

                # Verify the function was called with correct organization ID
                mock_grant_exists.assert_called_with(self.organization.id)


@all_silo_test(regions=create_test_regions("us"))
@freeze_time("2025-01-01 12:00:00")
class DataAccessGrantExistsTest(TestCase):
    def setUp(self) -> None:
        self.organization_id = 123
        self.current_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.access_start = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        self.access_end = datetime(2025, 1, 1, 14, 0, 0, tzinfo=timezone.utc)

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    def test_cache_hit_valid_grant(self, mock_cache: mock.MagicMock) -> None:
        mock_cache.get.return_value = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )

        result = data_access_grant_exists(self.organization_id)

        assert result is True
        mock_cache.get.assert_called_once_with(self.organization_id)
        # Should not call set or service when cache hit
        mock_cache.set.assert_not_called()

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    def test_cache_hit_negative_cache(self, mock_cache: mock.MagicMock) -> None:
        mock_cache.get.return_value = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.NEGATIVE_CACHE,
        )

        result = data_access_grant_exists(self.organization_id)

        assert result is False
        mock_cache.get.assert_called_once_with(self.organization_id)
        # Should not call set or service when cache hit
        mock_cache.set.assert_not_called()

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    def test_cache_expired_grant_deletes_cache(self, mock_cache: mock.MagicMock) -> None:
        # First return expired grant, then cache miss on recalculation
        mock_cache.get.side_effect = [
            EffectiveGrantStatus(
                cache_status=GrantCacheStatus.EXPIRED_WINDOW,
                access_end=datetime(2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc),  # expired
                access_start=self.access_start,
            ),
            EffectiveGrantStatus(cache_status=GrantCacheStatus.CACHE_MISS),
        ]

        with patch("sentry.data_secrecy.logic.data_access_grant_service") as mock_service:
            mock_service.get_effective_grant_status.return_value = None

            result = data_access_grant_exists(self.organization_id)

        assert result is False
        mock_cache.delete.assert_called_once_with(self.organization_id)
        mock_service.get_effective_grant_status.assert_called_once_with(
            organization_id=self.organization_id
        )

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    @patch("sentry.data_secrecy.logic.data_access_grant_service")
    def test_cache_miss_with_grant(
        self, mock_service: mock.MagicMock, mock_cache: mock.MagicMock
    ) -> None:
        mock_cache.get.return_value = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.CACHE_MISS,
        )

        mock_service.get_effective_grant_status.return_value = RpcEffectiveGrantStatus(
            organization_id=self.organization_id,
            access_start=self.access_start,
            access_end=self.access_end,
        )

        result = data_access_grant_exists(self.organization_id)

        assert result is True
        mock_service.get_effective_grant_status.assert_called_once_with(
            organization_id=self.organization_id
        )

        # Verify cache.set was called with the right grant status
        mock_cache.set.assert_called_once()
        call_args = mock_cache.set.call_args
        assert call_args[0][0] == self.organization_id  # organization_id
        grant_status = call_args[0][1]  # EffectiveGrantStatus
        assert grant_status.cache_status == GrantCacheStatus.VALID_WINDOW
        assert grant_status.access_end == self.access_end
        assert grant_status.access_start == self.access_start

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    @patch("sentry.data_secrecy.logic.data_access_grant_service")
    def test_cache_miss_no_grant(
        self, mock_service: mock.MagicMock, mock_cache: mock.MagicMock
    ) -> None:
        mock_cache.get.return_value = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.CACHE_MISS,
        )

        mock_service.get_effective_grant_status.return_value = None

        result = data_access_grant_exists(self.organization_id)

        assert result is False
        mock_service.get_effective_grant_status.assert_called_once_with(
            organization_id=self.organization_id
        )

        # Verify cache.set was called with negative cache status
        mock_cache.set.assert_called_once()
        call_args = mock_cache.set.call_args
        assert call_args[0][0] == self.organization_id  # organization_id
        grant_status = call_args[0][1]  # EffectiveGrantStatus
        assert grant_status.cache_status == GrantCacheStatus.NEGATIVE_CACHE

    @patch("sentry.data_secrecy.logic.effective_grant_status_cache")
    @patch("sentry.data_secrecy.logic.data_access_grant_service")
    def test_cache_miss_with_expired_rpc_grant(
        self, mock_service: mock.MagicMock, mock_cache: mock.MagicMock
    ) -> None:
        mock_cache.get.return_value = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.CACHE_MISS,
        )

        # Return grant that's already expired
        expired_time = datetime(2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc)
        mock_service.get_effective_grant_status.return_value = RpcEffectiveGrantStatus(
            organization_id=self.organization_id,
            access_start=self.access_start,
            access_end=expired_time,  # expired
        )

        result = data_access_grant_exists(self.organization_id)

        assert result is False
        mock_service.get_effective_grant_status.assert_called_once_with(
            organization_id=self.organization_id
        )

        # Verify cache.set was called with negative cache status for expired grant
        mock_cache.set.assert_called_once()
        call_args = mock_cache.set.call_args
        grant_status = call_args[0][1]  # EffectiveGrantStatus
        assert grant_status.cache_status == GrantCacheStatus.NEGATIVE_CACHE


@all_silo_test(regions=create_test_regions("us"))
@freeze_time("2025-01-01 12:00:00")
class DataSecrecyE2ETest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization.flags.prevent_superuser_access = True

        self.rpc_org = RpcOrganization(id=self.organization.id)
        self.rpc_org.flags.prevent_superuser_access = True

        self.rpc_orgmember = RpcOrganizationMember(
            organization_id=self.organization.id,
            role="admin",
            user_id=self.user.id,
        )
        self.rpc_context = RpcUserOrganizationContext(
            user_id=self.user.id, organization=self.rpc_org, member=self.rpc_orgmember
        )

        # Clear cache before each test
        cache.clear()

    def test_superuser_access_granted_with_active_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # Create an active data access grant
                grant = self.create_data_access_grant(
                    organization_id=self.organization.id,
                    grant_start=datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
                    grant_end=datetime(2025, 1, 1, 16, 0, 0, tzinfo=timezone.utc),  # ends at 4 PM
                )

                # Test that superuser access is allowed
                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.rpc_context) is True

                # Test that data_access_grant_exists returns True
                assert data_access_grant_exists(self.organization.id) is True

                # Verify grant details are what we expect
                assert grant.organization_id == self.organization.id
                assert grant.grant_start == datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
                assert grant.grant_end == datetime(2025, 1, 1, 16, 0, 0, tzinfo=timezone.utc)

    def test_superuser_access_denied_without_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # Ensure no grants exist for this organization
                # (self.create_data_access_grant is not called)

                # Test that superuser access is denied
                assert should_allow_superuser_access_v2(self.organization) is False
                assert should_allow_superuser_access_v2(self.rpc_context) is False

                # Test that data_access_grant_exists returns False
                assert data_access_grant_exists(self.organization.id) is False

    def test_superuser_access_denied_with_expired_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # Create an expired data access grant
                expired_grant = self.create_data_access_grant(
                    organization_id=self.organization.id,
                    grant_start=datetime(2025, 1, 1, 8, 0, 0, tzinfo=timezone.utc),  # 8 AM
                    grant_end=datetime(
                        2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc
                    ),  # 11 AM (expired)
                )

                # Test that superuser access is denied for expired grant
                assert should_allow_superuser_access_v2(self.organization) is False
                assert should_allow_superuser_access_v2(self.rpc_context) is False

                # Test that data_access_grant_exists returns False for expired grant
                assert data_access_grant_exists(self.organization.id) is False

                # Verify grant details
                assert expired_grant.organization_id == self.organization.id
                assert expired_grant.grant_end < datetime.now(timezone.utc)  # Confirm it's expired

    def test_cache_behavior_with_real_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # Create an active grant
                self.create_data_access_grant(
                    organization_id=self.organization.id,
                    grant_start=datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
                    grant_end=datetime(2025, 1, 1, 16, 0, 0, tzinfo=timezone.utc),
                )

                # First call should hit the database and cache the result
                result1 = data_access_grant_exists(self.organization.id)
                assert result1 is True

                # Second call should use the cache (we can't easily verify this without
                # mocking, but we can at least verify the result is consistent)
                result2 = data_access_grant_exists(self.organization.id)
                assert result2 is True

                # Both calls to should_allow_superuser_access_v2 should return True
                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.organization) is True

    def test_cache_behavior_without_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # No grant created - should result in negative cache

                # First call should hit the database and cache the negative result
                result1 = data_access_grant_exists(self.organization.id)
                assert result1 is False

                # Second call should use the negative cache
                result2 = data_access_grant_exists(self.organization.id)
                assert result2 is False

                # Both calls to should_allow_superuser_access_v2 should return False
                assert should_allow_superuser_access_v2(self.organization) is False
                assert should_allow_superuser_access_v2(self.organization) is False

    def test_transition_from_no_grant_to_active_grant(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                # Initially no grant exists
                assert data_access_grant_exists(self.organization.id) is False
                assert should_allow_superuser_access_v2(self.organization) is False

                # Create a grant
                self.create_data_access_grant(
                    organization_id=self.organization.id,
                    grant_start=datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
                    grant_end=datetime(2025, 1, 1, 16, 0, 0, tzinfo=timezone.utc),
                )

                # Clear cache to simulate cache expiration or manual invalidation
                cache.clear()

                # Now should have access
                assert data_access_grant_exists(self.organization.id) is True
                assert should_allow_superuser_access_v2(self.organization) is True
