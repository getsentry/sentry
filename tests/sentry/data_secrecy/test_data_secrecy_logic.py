from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone

from sentry.data_secrecy.data_secrecy_logic import (
    _get_cached_grant_status,
    data_access_grant_exists,
    should_allow_superuser_access,
    should_allow_superuser_access_v2,
)
from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus
from sentry.data_secrecy.types import CACHE_KEY_PATTERN, NEGATIVE_CACHE_VALUE
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
class DataSecrecyTest(TestCase):
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
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    def test_bit_flag_disabled(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.organization.flags.prevent_superuser_access = False
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True


@all_silo_test(regions=create_test_regions("us"))
@freeze_time("2025-01-01 12:00:00")
class DataSecrecyV2Test(TestCase):
    def setUp(self):
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

    def test_should_allow_superuser_access_v2_self_hosted(self):
        with self.settings(SENTRY_SELF_HOSTED=True):
            assert should_allow_superuser_access_v2(self.organization) is True
            assert should_allow_superuser_access_v2(self.rpc_context) is True

    def test_should_allow_superuser_access_v2_feature_flag_disabled(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            # Feature flag is disabled by default in the base test setup
            assert should_allow_superuser_access_v2(self.organization) is True
            assert should_allow_superuser_access_v2(self.rpc_context) is True

    def test_should_allow_superuser_access_v2_bit_flag_disabled(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                self.organization.flags.prevent_superuser_access = False
                self.rpc_org.flags.prevent_superuser_access = False
                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.rpc_context) is True

    @patch("sentry.data_secrecy.data_secrecy_logic.data_access_grant_exists")
    def test_should_allow_superuser_access_v2_with_active_grant(self, mock_grant_exists):
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                mock_grant_exists.return_value = True
                assert should_allow_superuser_access_v2(self.organization) is True
                assert should_allow_superuser_access_v2(self.rpc_context) is True
                mock_grant_exists.assert_called_with(self.organization.id)

    @patch("sentry.data_secrecy.data_secrecy_logic.data_access_grant_exists")
    def test_should_allow_superuser_access_v2_no_active_grant(self, mock_grant_exists):
        with self.settings(SENTRY_SELF_HOSTED=False):
            with self.feature("organizations:data-secrecy-v2"):
                mock_grant_exists.return_value = False
                assert should_allow_superuser_access_v2(self.organization) is False
                assert should_allow_superuser_access_v2(self.rpc_context) is False
                mock_grant_exists.assert_called_with(self.organization.id)

    def test_get_cached_grant_status_cache_miss(self):
        # No cache entry exists
        result = _get_cached_grant_status(self.organization.id)
        assert result is None

    def test_get_cached_grant_status_negative_cache_hit(self):
        # Set negative cache value
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cache.set(cache_key, NEGATIVE_CACHE_VALUE, timeout=300)

        result = _get_cached_grant_status(self.organization.id)
        assert result is False

    def test_get_cached_grant_status_valid_cached_data(self):
        # Set valid cached data that hasn't expired
        future_time = timezone.now() + timedelta(hours=1)
        cached_data = {
            "access_start": timezone.now(),
            "access_end": future_time,
        }
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cache.set(cache_key, cached_data, timeout=300)

        result = _get_cached_grant_status(self.organization.id)
        assert result is True

    def test_get_cached_grant_status_expired_cached_data(self):
        # Set cached data that has logically expired
        past_time = timezone.now() - timedelta(hours=1)
        cached_data = {
            "access_start": (timezone.now() - timedelta(hours=2)),
            "access_end": past_time,
        }
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cache.set(cache_key, cached_data, timeout=300)

        result = _get_cached_grant_status(self.organization.id)
        assert result is None
        # Verify cache was deleted
        assert cache.get(cache_key) is None

    # Tests for data_access_grant_exists
    def test_data_access_grant_exists_cache_hit_positive(self):
        # Set valid cached data
        future_time = timezone.now() + timedelta(hours=1)
        cached_data = {
            "access_start": timezone.now(),
            "access_end": future_time,
        }
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cache.set(cache_key, cached_data, timeout=300)

        result = data_access_grant_exists(self.organization.id)
        assert result is True

    def test_data_access_grant_exists_cache_hit_negative(self):
        # Set negative cache value
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cache.set(cache_key, NEGATIVE_CACHE_VALUE, timeout=300)

        result = data_access_grant_exists(self.organization.id)
        assert result is False

    def test_data_access_grant_exists_cache_miss_with_grant(self):
        grant = self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=timezone.now(),
            grant_end=timezone.now() + timedelta(hours=2),
        )

        result = data_access_grant_exists(self.organization.id)
        assert result is True

        # Verify cache was set
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cached_data = cache.get(cache_key)
        assert cached_data is not None
        assert cached_data["access_start"] == grant.grant_start
        assert cached_data["access_end"] == grant.grant_end

    def test_data_access_grant_exists_cache_miss_no_grant(self):
        result = data_access_grant_exists(self.organization.id)
        assert result is False

        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cached_data = cache.get(cache_key)
        assert cached_data == NEGATIVE_CACHE_VALUE

    def test_data_access_grant_exists_cache_expired_with_grant(self):
        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=timezone.now(),
            grant_end=timezone.now() + timedelta(hours=2),
        )

        result = data_access_grant_exists(self.organization.id)
        assert result is True

    @patch(
        "sentry.data_secrecy.data_secrecy_logic.data_access_grant_service.get_effective_grant_status"
    )
    def test_data_access_grant_exists_cache_hit_uses_cached_data(self, mock_service):
        grant = self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=timezone.now(),
            grant_end=timezone.now() + timedelta(hours=2),
        )
        mock_service.return_value = RpcEffectiveGrantStatus(
            organization_id=self.organization.id,
            access_start=grant.grant_start,
            access_end=grant.grant_end,
        )

        # First call should populate the cache
        result1 = data_access_grant_exists(self.organization.id)
        assert result1 is True
        assert mock_service.call_count == 1

        # Second call should use cached data and not call the service again
        result2 = data_access_grant_exists(self.organization.id)
        assert result2 is True
        assert mock_service.call_count == 1  # Should still be 1, not 2

        # Verify cache contains the expected data
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cached_data = cache.get(cache_key)
        assert cached_data is not None
        assert cached_data["access_start"] == grant.grant_start
        assert cached_data["access_end"] == grant.grant_end

    @patch(
        "sentry.data_secrecy.data_secrecy_logic.data_access_grant_service.get_effective_grant_status"
    )
    def test_data_access_grant_exists_cache_expired_recalculates(self, mock_service):
        grant = self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=timezone.now(),
            grant_end=timezone.now() + timedelta(hours=1),
        )
        mock_service.return_value = RpcEffectiveGrantStatus(
            organization_id=self.organization.id,
            access_start=grant.grant_start,
            access_end=grant.grant_end,
        )

        # First call should populate the cache
        result1 = data_access_grant_exists(self.organization.id)
        assert result1 is True
        assert mock_service.call_count == 1

        # Verify cache was populated
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cached_data = cache.get(cache_key)
        assert cached_data is not None

        # Advance time to make the cached data expire
        with freeze_time("2025-01-01 14:30:00"):  # 2.5 hours later
            mock_service.return_value = None

            result2 = data_access_grant_exists(self.organization.id)
            assert result2 is False
            assert mock_service.call_count == 2  # Should be called again

            # Verify expired cache was deleted
            cached_data_after = cache.get(cache_key)
            assert cached_data_after == NEGATIVE_CACHE_VALUE

    def test_data_access_grant_exists_cache_hit_calculates_correctly(self):
        grant = self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=timezone.now(),
            grant_end=timezone.now() + timedelta(hours=2),
        )

        # First call should populate the cache
        result1 = data_access_grant_exists(self.organization.id)
        assert result1 is True

        # Second call should use cached data and return True
        result2 = data_access_grant_exists(self.organization.id)
        assert result2 is True

        # Verify cache contains the expected data
        cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization.id)
        cached_data = cache.get(cache_key)
        assert cached_data is not None
        assert cached_data["access_start"] == grant.grant_start
        assert cached_data["access_end"] == grant.grant_end
