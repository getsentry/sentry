from unittest import mock

import pytest

from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.models import (
    UptimeSubscriptionDataSourceHandler,
    get_active_auto_monitor_count_for_org,
    get_detector,
    get_top_hosting_provider_names,
)
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION, UptimeMonitorMode
from sentry.workflow_engine.models.detector import Detector


class GetActiveMonitorCountForOrgTest(UptimeTestCase):
    def test(self) -> None:
        assert get_active_auto_monitor_count_for_org(self.organization) == 0
        self.create_uptime_detector()
        assert get_active_auto_monitor_count_for_org(self.organization) == 1

        other_sub = self.create_uptime_subscription(url="https://santry.io")
        self.create_uptime_detector(uptime_subscription=other_sub)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2

        other_org = self.create_organization()
        other_proj = self.create_project(organization=other_org)
        other_org_sub = self.create_uptime_subscription(url="https://example.com")
        self.create_uptime_detector(uptime_subscription=other_org_sub, project=other_proj)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2
        assert get_active_auto_monitor_count_for_org(other_org) == 1


class GetTopHostingProviderNamesTest(UptimeTestCase):
    def test(self) -> None:
        self.create_uptime_subscription(host_provider_name="prov1")
        self.create_uptime_subscription(host_provider_name="prov1")
        self.create_uptime_subscription(host_provider_name="prov2")
        self.create_uptime_subscription(host_provider_name="prov2")
        self.create_uptime_subscription(host_provider_name="prov3")
        assert get_top_hosting_provider_names(2) == {"prov1", "prov2"}
        self.create_uptime_subscription(host_provider_name="prov3")
        self.create_uptime_subscription(host_provider_name="prov3")
        self.create_uptime_subscription(host_provider_name="prov4")
        # Cached, so should remain the same
        assert get_top_hosting_provider_names(2) == {"prov1", "prov2"}
        # Using a different arg should bust the cache
        assert get_top_hosting_provider_names(1) == {"prov3"}
        assert get_top_hosting_provider_names(3) == {"prov1", "prov2", "prov3"}


class UptimeSubscriptionDataSourceHandlerTest(UptimeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )

        self.data_source = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(self.uptime_subscription.id),
        )

    def test_bulk_get_query_object(self) -> None:
        result = UptimeSubscriptionDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.uptime_subscription

    def test_bulk_get_query_object__incorrect_data_source(self) -> None:
        self.ds_with_invalid_subscription_id = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id="not_uuid",
        )

        with mock.patch("sentry.uptime.models.logger.exception") as mock_logger:
            data_sources = [self.data_source, self.ds_with_invalid_subscription_id]
            result = UptimeSubscriptionDataSourceHandler.bulk_get_query_object(data_sources)
            assert result[self.data_source.id] == self.uptime_subscription

            mock_logger.assert_called_once_with(
                "Invalid DataSource.source_id fetching UptimeSubscription",
                extra={
                    "id": self.ds_with_invalid_subscription_id.id,
                    "source_id": self.ds_with_invalid_subscription_id.source_id,
                },
            )


class GetDetectorTest(UptimeTestCase):
    def test_simple(self) -> None:
        uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )
        env = self.create_environment(name="production", project=self.project)
        detector = self.create_uptime_detector(
            project=self.project,
            name="My Uptime Monitor",
            uptime_subscription=uptime_subscription,
            env=env,
            mode=UptimeMonitorMode.MANUAL,
        )

        assert get_detector(uptime_subscription) == detector

    def test_no_detector(self) -> None:
        uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )
        with pytest.raises(Detector.DoesNotExist):
            get_detector(uptime_subscription)
