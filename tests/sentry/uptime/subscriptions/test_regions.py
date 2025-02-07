from django.conf import settings
from django.test import TestCase, override_settings

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.subscriptions.regions import get_active_region_configs, get_region_config


class TestBase(TestCase):
    def setUp(self):
        self.test_regions = [
            UptimeRegionConfig(
                slug="us",
                name="United States",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="us",
                enabled=True,
            ),
            UptimeRegionConfig(
                slug="eu",
                name="Europe",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="eu",
                enabled=False,
            ),
            UptimeRegionConfig(
                slug="ap",
                name="Asia Pacific",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="ap",
                enabled=True,
            ),
        ]


class GetActiveRegionConfigsTest(TestBase):
    def test_returns_only_enabled_regions(self):
        with override_settings(UPTIME_REGIONS=self.test_regions):
            active_regions = get_active_region_configs()
            assert len(active_regions) == 2
            assert all(region.enabled for region in active_regions)
            assert {region.slug for region in active_regions} == {"us", "ap"}


class GetRegionConfigTest(TestBase):
    def test_returns_existing_region(self):
        with override_settings(UPTIME_REGIONS=self.test_regions):
            region = get_region_config("us")
            assert region is not None
            assert region.slug == "us"
            assert region.name == "United States"

    def test_returns_first_active_region_for_invalid_slug(self):
        with override_settings(UPTIME_REGIONS=self.test_regions):
            region = get_region_config("invalid")
            assert region is not None
            assert region.slug == "us"  # First active region
