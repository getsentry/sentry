from unittest import mock

from django.test import TestCase

from sentry.conf.types.kafka_definition import Topic
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.subscriptions.regions import (
    get_active_region_configs,
    get_region_config,
    get_region_lookup,
)


class TestBase(TestCase):
    def setUp(self):
        self.test_regions = [
            UptimeRegionConfig(
                slug="us",
                name="United States",
                config_topic=Topic("uptime-results"),
                enabled=True,
            ),
            UptimeRegionConfig(
                slug="eu",
                name="Europe",
                config_topic=Topic("uptime-configs"),
                enabled=False,
            ),
            UptimeRegionConfig(
                slug="ap",
                name="Asia Pacific",
                config_topic=Topic("monitors-clock-tasks"),
                enabled=True,
            ),
        ]

    def tearDown(self):
        # Reset the global region_lookup between tests
        from sentry.uptime.subscriptions import regions

        regions.region_lookup = None


class GetActiveRegionConfigsTest(TestBase):
    def test_returns_only_enabled_regions(self):
        with mock.patch("django.conf.settings.UPTIME_REGIONS", self.test_regions):
            active_regions = get_active_region_configs()
            assert len(active_regions) == 2
            assert all(region.enabled for region in active_regions)
            assert {region.slug for region in active_regions} == {"us", "ap"}


class GetRegionConfigTest(TestBase):
    def test_returns_existing_region(self):
        with mock.patch("django.conf.settings.UPTIME_REGIONS", self.test_regions):
            region = get_region_config("us")
            assert region is not None
            assert region.slug == "us"
            assert region.name == "United States"

    def test_returns_first_active_region_for_invalid_slug(self):
        with mock.patch("django.conf.settings.UPTIME_REGIONS", self.test_regions):
            region = get_region_config("invalid")
            assert region is not None
            assert region.slug == "us"  # First active region


class GetRegionLookupTest(TestBase):
    def test_creates_lookup_dictionary(self):
        with mock.patch("django.conf.settings.UPTIME_REGIONS", self.test_regions):
            lookup = get_region_lookup()
            assert len(lookup) == 3
            assert set(lookup.keys()) == {"us", "eu", "ap"}

    def test_caches_lookup_dictionary(self):
        with mock.patch("django.conf.settings.UPTIME_REGIONS", self.test_regions):
            lookup1 = get_region_lookup()
            lookup2 = get_region_lookup()
            assert lookup1 is lookup2
