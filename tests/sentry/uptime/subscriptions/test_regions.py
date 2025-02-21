from django.conf import settings
from django.test import TestCase, override_settings

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.testutils.helpers import override_options
from sentry.uptime.models import UptimeSubscriptionRegion
from sentry.uptime.subscriptions.regions import (
    UptimeRegionWithMode,
    get_active_regions,
    get_region_config,
)


class TestBase(TestCase):
    def setUp(self):
        self.test_regions = [
            UptimeRegionConfig(
                slug="us",
                name="United States",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="us",
            ),
            UptimeRegionConfig(
                slug="eu",
                name="Europe",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="eu",
            ),
            UptimeRegionConfig(
                slug="ap",
                name="Asia Pacific",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="ap",
            ),
        ]


class GetActiveRegionsTest(TestBase):
    def test_returns_only_enabled_regions(self):
        with (
            override_settings(UPTIME_REGIONS=self.test_regions),
            override_options(
                {
                    "uptime.checker-regions-mode-override": {
                        "eu": UptimeSubscriptionRegion.RegionMode.INACTIVE.value
                    }
                }
            ),
        ):
            active_regions = get_active_regions()
            assert set(active_regions) == {
                UptimeRegionWithMode("us", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                UptimeRegionWithMode("ap", UptimeSubscriptionRegion.RegionMode.ACTIVE),
            }

        with (
            override_settings(UPTIME_REGIONS=self.test_regions),
            override_options(
                {
                    "uptime.checker-regions-mode-override": {
                        "eu": UptimeSubscriptionRegion.RegionMode.INACTIVE.value,
                        "us": UptimeSubscriptionRegion.RegionMode.ACTIVE.value,
                        "ap": UptimeSubscriptionRegion.RegionMode.SHADOW.value,
                    }
                }
            ),
        ):
            active_regions = get_active_regions()
            assert set(active_regions) == {
                UptimeRegionWithMode("us", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                UptimeRegionWithMode("ap", UptimeSubscriptionRegion.RegionMode.SHADOW),
            }


class GetRegionConfigTest(TestBase):
    def test_returns_existing_region(self):
        with override_settings(UPTIME_REGIONS=self.test_regions):
            region = get_region_config("us")
            assert region is not None
            assert region.slug == "us"
            assert region.name == "United States"
