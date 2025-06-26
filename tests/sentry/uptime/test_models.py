from unittest import mock

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_SUCCESS,
)

from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import (
    UptimeSubscriptionDataSourceHandler,
    get_active_auto_monitor_count_for_org,
    get_detector,
    get_top_hosting_provider_names,
)
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION, UptimeMonitorMode
from sentry.workflow_engine.models import Condition, DataSourceDetector
from sentry.workflow_engine.types import DetectorPriorityLevel


class GetActiveMonitorCountForOrgTest(UptimeTestCase):
    def test(self):
        assert get_active_auto_monitor_count_for_org(self.organization) == 0
        self.create_project_uptime_subscription()
        assert get_active_auto_monitor_count_for_org(self.organization) == 1

        other_sub = self.create_uptime_subscription(url="https://santry.io")
        self.create_project_uptime_subscription(uptime_subscription=other_sub)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2

        other_org = self.create_organization()
        other_proj = self.create_project(organization=other_org)
        self.create_project_uptime_subscription(uptime_subscription=other_sub, project=other_proj)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2
        assert get_active_auto_monitor_count_for_org(other_org) == 1


class GetTopHostingProviderNamesTest(UptimeTestCase):
    def test(self):
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
    def setUp(self):
        super().setUp()
        self.uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )

        self.data_source = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(self.uptime_subscription.id),
        )

    def test_bulk_get_query_object(self):
        result = UptimeSubscriptionDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.uptime_subscription

    def test_bulk_get_query_object__incorrect_data_source(self):
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
    def test_simple(self):
        uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )
        data_source = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(uptime_subscription.id),
        )

        detector = self.create_detector(
            project=self.project,
            type=UptimeDomainCheckFailure.slug,
            name="My Uptime Monitor",
            config={
                "environment": "production",
                "mode": UptimeMonitorMode.MANUAL.value,
            },
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        assert get_detector(uptime_subscription) == detector

    def test_no_detector(self):
        uptime_subscription = self.create_uptime_subscription(
            url="https://santry.io",
        )
        assert get_detector(uptime_subscription) is None


class CreateDetectorTest(UptimeTestCase):
    def test_simple(self):
        monitor = self.create_project_uptime_subscription()
        detector = get_detector(monitor.uptime_subscription)
        assert detector

        assert detector.name == monitor.name
        assert detector.owner_user_id == monitor.owner_user_id
        assert detector.owner_team == monitor.owner_team
        assert detector.project == monitor.project
        assert monitor.environment
        assert detector.config["environment"] == monitor.environment.name
        assert detector.config["mode"] == monitor.mode

        condition_group = detector.workflow_condition_group
        assert condition_group

        conditions = condition_group.conditions.all()
        assert len(conditions) == 2
        failure_condition, success_condition = conditions
        assert failure_condition.comparison == CHECKSTATUS_FAILURE
        assert failure_condition.type == Condition.EQUAL
        assert failure_condition.condition_result == DetectorPriorityLevel.HIGH
        assert success_condition.comparison == CHECKSTATUS_SUCCESS
        assert success_condition.type == Condition.EQUAL
        assert success_condition.condition_result == DetectorPriorityLevel.OK
