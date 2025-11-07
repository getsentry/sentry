from unittest import mock

import pytest
from django.conf import settings
from django.test import override_settings
from pytest import raises

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.constants import DataCategory, ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.quotas.base import SeatAssignmentResult
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.skips import requires_kafka
from sentry.types.actor import Actor
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import (
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_uptime_subscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    UPTIME_SUBSCRIPTION_TYPE,
    MaxManualUptimeSubscriptionsReached,
    UptimeMonitorNoSeatAvailable,
    check_and_update_regions,
    create_uptime_detector,
    create_uptime_subscription,
    delete_uptime_detector,
    delete_uptime_subscription,
    disable_uptime_detector,
    enable_uptime_detector,
    get_auto_monitored_detectors_for_project,
    is_url_auto_monitored_for_project,
    update_uptime_detector,
    update_uptime_subscription,
)
from sentry.uptime.types import (
    DEFAULT_DOWNTIME_THRESHOLD,
    DEFAULT_RECOVERY_THRESHOLD,
    UptimeMonitorMode,
)
from sentry.utils.outcomes import Outcome
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_kafka]


class CreateUptimeSubscriptionTest(UptimeTestCase):
    def test(self) -> None:
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        assert uptime_sub.subscription_id is not None
        assert uptime_sub.status == UptimeSubscription.Status.ACTIVE.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.url_domain == "sentry"
        assert uptime_sub.url_domain_suffix == "io"
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms

    def test_private_domain_suffix(self) -> None:
        url = "https://test.vercel.app"
        interval_seconds = 300
        timeout_ms = 500
        uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        assert uptime_sub.subscription_id is None
        assert uptime_sub.status == UptimeSubscription.Status.CREATING.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.url_domain == "test"
        assert uptime_sub.url_domain_suffix == "vercel.app"
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms

    def test_duplicate(self) -> None:
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        assert uptime_sub.subscription_id is not None
        with self.tasks():
            second_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        second_sub.refresh_from_db()

        assert uptime_sub.id != second_sub.id
        assert uptime_sub.subscription_id != second_sub.subscription_id

    def test_without_task(self) -> None:
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        assert uptime_sub.subscription_id is None
        assert uptime_sub.status == UptimeSubscription.Status.CREATING.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.url_domain == "sentry"
        assert uptime_sub.url_domain_suffix == "io"
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms

    def test_regions(self) -> None:
        with (
            override_settings(
                UPTIME_REGIONS=[
                    UptimeRegionConfig(slug="active_region", name="active_region"),
                    UptimeRegionConfig(slug="shadow_region", name="shadow_region"),
                ]
            ),
            override_options(
                {
                    "uptime.checker-regions-mode-override": {
                        "shadow_region": UptimeSubscriptionRegion.RegionMode.SHADOW
                    }
                }
            ),
        ):
            uptime_sub = create_uptime_subscription("https://sentry.io", 300, 500)
            assert [
                (r.region_slug, r.mode) for r in uptime_sub.regions.all().order_by("region_slug")
            ] == [
                ("active_region", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("shadow_region", UptimeSubscriptionRegion.RegionMode.SHADOW),
            ]


class UpdateUptimeSubscriptionTest(UptimeTestCase):
    def test(self) -> None:
        with self.tasks():
            uptime_sub = create_uptime_subscription("https://sentry.io", 300, 500)
        uptime_sub.refresh_from_db()
        prev_subscription_id = uptime_sub.subscription_id

        url = "https://santry.io"
        interval_seconds = 600
        timeout_ms = 1000
        method = "POST"
        body = "some body"
        trace_sampling = True
        with self.tasks():
            update_uptime_subscription(
                uptime_sub,
                url,
                interval_seconds,
                timeout_ms,
                method,
                [("something", "some_val")],
                body=body,
                trace_sampling=trace_sampling,
            )
        uptime_sub.refresh_from_db()
        assert uptime_sub.subscription_id == prev_subscription_id
        assert uptime_sub.status == UptimeSubscription.Status.ACTIVE.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.url_domain == "santry"
        assert uptime_sub.url_domain_suffix == "io"
        assert uptime_sub.interval_seconds == interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms
        assert uptime_sub.method == method
        assert uptime_sub.headers == [["something", "some_val"]]
        assert uptime_sub.body == body
        assert uptime_sub.trace_sampling == trace_sampling


class DeleteUptimeSubscriptionTest(UptimeTestCase):
    def test_with_task(self) -> None:
        with self.tasks():
            uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_uptime_subscription(uptime_sub)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_without_task(self) -> None:
        with self.tasks():
            uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)

        delete_uptime_subscription(uptime_sub)

        uptime_sub.refresh_from_db()
        assert uptime_sub.status == UptimeSubscription.Status.DELETING.value


class CreateUptimeDetectorTest(UptimeTestCase):
    def test(self) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.url == "https://sentry.io"
        assert uptime_subscription.interval_seconds == 3600
        assert uptime_subscription.timeout_ms == 1000

        assert detector.config["mode"] == UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value
        assert detector.config["environment"] == self.environment.name
        assert detector.config["recovery_threshold"] == DEFAULT_RECOVERY_THRESHOLD
        assert detector.config["downtime_threshold"] == DEFAULT_DOWNTIME_THRESHOLD
        assert detector.project == self.project
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None

    def test_custom_thresholds(self) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            recovery_threshold=2,
            downtime_threshold=5,
        )
        assert detector.config["recovery_threshold"] == 2
        assert detector.config["downtime_threshold"] == 5

    def test_already_exists(self) -> None:
        create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        assert create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )

        # Both detectors should exist and use different uptime subscriptions
        detectors = Detector.objects.filter(
            project=self.project,
            type=UptimeDomainCheckFailure.slug,
            config__mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
        )
        assert detectors.count() == 2

    def test_max_proj_subs(self) -> None:
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=1
        ):
            assert create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                assert create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://santry.io",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )

    def test_override_max_proj_subs(self) -> None:
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=1
        ):
            assert create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://santry.io",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                    override_manual_org_limit=False,
                )
            assert create_uptime_detector(
                self.project,
                self.environment,
                url="https://santry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
                override_manual_org_limit=True,
            )

    def test_disabled_monitors_dont_count_toward_limit(self) -> None:
        """
        Verify that disabled monitors do not count towards the organization's manual monitor limit.

        Disabled monitors (enabled=False, status=ACTIVE) should not prevent creating new monitors.
        The limit check should only count enabled monitors, allowing users to create new monitors
        up to MAX_MANUAL_SUBSCRIPTIONS_PER_ORG enabled monitors regardless of how many are disabled.
        """
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=2
        ):
            # Create and then disable a monitor
            detector1 = create_uptime_detector(
                self.project,
                self.environment,
                url="https://example1.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            disable_uptime_detector(detector1)

            # Verify the detector is disabled but still ACTIVE status
            detector1.refresh_from_db()
            assert detector1.enabled is False
            assert detector1.status == ObjectStatus.ACTIVE

            # Should be able to create 2 more monitors (disabled one shouldn't count)
            detector2 = create_uptime_detector(
                self.project,
                self.environment,
                url="https://example2.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            assert detector2.enabled is True

            detector3 = create_uptime_detector(
                self.project,
                self.environment,
                url="https://example3.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            assert detector3.enabled is True

            # Verify we have 2 enabled and 1 disabled
            enabled_count = Detector.objects.filter(
                project__organization_id=self.organization.id,
                status=ObjectStatus.ACTIVE,
                enabled=True,
                type=UptimeDomainCheckFailure.slug,
                config__mode=UptimeMonitorMode.MANUAL.value,
            ).count()
            assert enabled_count == 2

            total_active_count = Detector.objects.filter(
                project__organization_id=self.organization.id,
                status=ObjectStatus.ACTIVE,
                type=UptimeDomainCheckFailure.slug,
                config__mode=UptimeMonitorMode.MANUAL.value,
            ).count()
            assert total_active_count == 3  # 2 enabled + 1 disabled

            # Creating a 3rd enabled monitor should fail (at limit of enabled)
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://example4.com",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )

    def test_deleted_monitor_frees_slot_immediately(self) -> None:
        """
        Verify that deleting a monitor immediately frees up a slot for creating a new one.

        Deleted monitors have status=PENDING_DELETION rather than status=ACTIVE, so they
        should not be counted by check_uptime_subscription_limit(), allowing immediate
        reuse of their quota slot.
        """
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=2
        ):
            # Create 2 monitors (at limit)
            detector1 = create_uptime_detector(
                self.project,
                self.environment,
                url="https://example1.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            create_uptime_detector(
                self.project,
                self.environment,
                url="https://example2.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )

            # Verify at limit
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://should-fail.com",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )

            # Delete one monitor
            with self.tasks():
                delete_uptime_detector(detector1)
                run_scheduled_deletions()

            # Verify detector is deleted
            with pytest.raises(Detector.DoesNotExist):
                detector1.refresh_from_db()

            # Should be able to create a new monitor immediately
            detector3 = create_uptime_detector(
                self.project,
                self.environment,
                url="https://example3.com",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            assert detector3.enabled is True

            # Verify we're at limit again (2 enabled monitors)
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://should-fail-again.com",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )

    def test_auto_associates_active_regions(self) -> None:
        regions = [
            UptimeRegionConfig(
                slug="region1",
                name="Region 1",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r1",
            ),
            UptimeRegionConfig(
                slug="region2",
                name="Region 2",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r2",
            ),
            UptimeRegionConfig(
                slug="region3",
                name="Region 3",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r3",
            ),
        ]
        with (
            override_settings(UPTIME_REGIONS=regions),
            override_options(
                {
                    "uptime.checker-regions-mode-override": {
                        "region3": UptimeSubscriptionRegion.RegionMode.INACTIVE.value
                    }
                }
            ),
        ):
            subscription = create_uptime_subscription(
                url="https://example.com",
                interval_seconds=60,
                timeout_ms=1000,
            )

            # Should only have the enabled regions
            subscription_regions = {r.region_slug for r in subscription.regions.all()}
            assert subscription_regions == {"region1", "region2"}

    @mock.patch("sentry.uptime.subscriptions.subscriptions.disable_uptime_detector")
    def test_status_disable(self, mock_disable_uptime_detector: mock.MagicMock) -> None:
        create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
            status=ObjectStatus.DISABLED,
        )
        mock_disable_uptime_detector.assert_called()

    @mock.patch("sentry.uptime.subscriptions.subscriptions.disable_uptime_detector")
    def test_status_disable_not_called_onboarding(
        self, mock_disable_uptime_detector: mock.MagicMock
    ) -> None:
        create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
            status=ObjectStatus.DISABLED,
        )
        mock_disable_uptime_detector.assert_not_called()

    @mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector")
    def test_status_enable(self, mock_enable_uptime_detector: mock.MagicMock) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.ACTIVE,
            )
            mock_enable_uptime_detector.assert_called_with(detector, ensure_assignment=True)

    @mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector")
    def test_status_enable_not_called_onboarding(
        self, mock_enable_uptime_detector: mock.MagicMock
    ) -> None:
        with self.tasks():
            create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
                status=ObjectStatus.ACTIVE,
            )
            mock_enable_uptime_detector.assert_not_called()

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.RATE_LIMITED,
    )
    def test_no_seat_assignment(self, _mock_assign_seat: mock.MagicMock) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.ACTIVE,
            )

        # Monitor created but is not enabled due to no seat assignment
        assert not detector.enabled

        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value

    def test_create_manual_removes_onboarding(self) -> None:
        assert self.organization.update_option("sentry:uptime_autodetection", True)
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )
        assert self.organization.get_option("sentry:uptime_autodetection")

        with self.tasks():
            # XXX(epurkhiser): The second creation runs within the tasks
            # context so that the subscription deletion happens immediately and
            # the Detector deletion task does not cascade into deleting a
            # uptime subscription. In the future we'll likely move all deletion
            # logic into the scheduled deletion handler and this will no longer
            # need to run within the tasks context.
            create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io/manual",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            run_scheduled_deletions()

        assert not self.organization.get_option("sentry:uptime_autodetection")
        with pytest.raises(Detector.DoesNotExist):
            detector.refresh_from_db()


class UpdateUptimeDetectorTest(UptimeTestCase):
    def test(self) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
            )
            prev_uptime_subscription = get_uptime_subscription(detector)
            prev_uptime_subscription.refresh_from_db()
            prev_subscription_id = prev_uptime_subscription.subscription_id
            update_uptime_detector(
                detector,
                environment=self.environment,
                url="https://santry.io",
                interval_seconds=60,
                timeout_ms=1000,
                method="POST",
                headers=[("some", "header")],
                body="a body",
                name="New name",
                owner=Actor.from_orm_user(self.user),
                trace_sampling=False,
            )

        detector.refresh_from_db()
        assert detector.name == "New name"
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None
        assert detector.config["mode"] == UptimeMonitorMode.MANUAL
        prev_uptime_subscription.refresh_from_db()
        assert prev_uptime_subscription.url == "https://santry.io"
        assert prev_uptime_subscription.interval_seconds == 60
        assert prev_uptime_subscription.timeout_ms == 1000
        assert prev_uptime_subscription.method == "POST"
        assert prev_uptime_subscription.headers == [["some", "header"]]
        assert prev_uptime_subscription.body == "a body"
        assert prev_uptime_subscription.subscription_id == prev_subscription_id

        # Detector fields should be updated
        assert detector.config["environment"] == self.environment.name
        # Threshold values should remain at defaults since not specified in update
        assert detector.config["recovery_threshold"] == DEFAULT_RECOVERY_THRESHOLD
        assert detector.config["downtime_threshold"] == DEFAULT_DOWNTIME_THRESHOLD

    def test_update_thresholds(self) -> None:
        detector = self.create_uptime_detector()
        # Verify initial defaults
        assert detector.config["recovery_threshold"] == DEFAULT_RECOVERY_THRESHOLD
        assert detector.config["downtime_threshold"] == DEFAULT_DOWNTIME_THRESHOLD

        update_uptime_detector(
            detector,
            recovery_threshold=3,
            downtime_threshold=7,
        )

        detector.refresh_from_db()
        assert detector.config["recovery_threshold"] == 3
        assert detector.config["downtime_threshold"] == 7

    def test_already_exists(self) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            uptime_subscription = get_uptime_subscription(detector)
            other_detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://santry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            other_uptime_subscription = get_uptime_subscription(other_detector)

            update_uptime_detector(
                detector,
                environment=self.environment,
                url=uptime_subscription.url,
                interval_seconds=other_uptime_subscription.interval_seconds,
                timeout_ms=1000,
                method=other_uptime_subscription.method,
                headers=other_uptime_subscription.headers,
                body=other_uptime_subscription.body,
                name=other_detector.name,
                owner=other_detector.owner,
                trace_sampling=other_uptime_subscription.trace_sampling,
            )

        # Verify that we still have both detectors after the update
        sentry_detectors = Detector.objects.filter(
            project=self.project,
            data_sources__source_id=str(uptime_subscription.id),
            config__mode=UptimeMonitorMode.MANUAL.value,
        )
        assert sentry_detectors.count() == 1

        santry_detectors = Detector.objects.filter(
            project=self.project,
            data_sources__source_id=str(other_uptime_subscription.id),
            config__mode=UptimeMonitorMode.MANUAL.value,
        )
        assert santry_detectors.count() == 1

    @mock.patch("sentry.uptime.subscriptions.subscriptions.disable_uptime_detector")
    def test_status_disable(self, mock_disable_uptime_detector: mock.MagicMock) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
            )
            update_uptime_detector(
                detector,
                environment=self.environment,
                url="https://santry.io",
                interval_seconds=60,
                timeout_ms=1000,
                method="POST",
                headers=[("some", "header")],
                body="a body",
                name="New name",
                owner=Actor.from_orm_user(self.user),
                trace_sampling=False,
                status=ObjectStatus.DISABLED,
            )
        mock_disable_uptime_detector.assert_called()

    @mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector")
    def test_status_enable(self, mock_enable_uptime_detector: mock.MagicMock) -> None:
        with self.tasks():
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.DISABLED,
            )
            update_uptime_detector(
                detector,
                environment=self.environment,
                url="https://santry.io",
                interval_seconds=60,
                timeout_ms=1000,
                method="POST",
                headers=[("some", "header")],
                body="a body",
                name="New name",
                owner=Actor.from_orm_user(self.user),
                trace_sampling=False,
                status=ObjectStatus.ACTIVE,
                ensure_assignment=True,
            )
        mock_enable_uptime_detector.assert_called_with(mock.ANY, ensure_assignment=True)


class DeleteUptimeDetectorTest(UptimeTestCase):
    @mock.patch("sentry.quotas.backend.remove_seat")
    def test_other_subscriptions(self, mock_remove_seat: mock.MagicMock) -> None:
        other_project = self.create_project()
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        other_detector = create_uptime_detector(
            other_project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        uptime_subscription = get_uptime_subscription(detector)
        other_uptime_subscription = get_uptime_subscription(other_detector)

        assert uptime_subscription.id != other_uptime_subscription.id

        with self.tasks():
            delete_uptime_detector(detector)
            run_scheduled_deletions()

        # Detector should be deleted
        with pytest.raises(Detector.DoesNotExist):
            detector.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=other_uptime_subscription.id).exists()
        mock_remove_seat.assert_called_with(DataCategory.UPTIME, detector)

    @mock.patch("sentry.quotas.backend.remove_seat")
    def test_single_subscriptions(self, mock_remove_seat: mock.MagicMock) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        uptime_subscription = get_uptime_subscription(detector)
        with self.tasks():
            delete_uptime_detector(detector)
            run_scheduled_deletions()

        # Detector should be deleted
        with pytest.raises(Detector.DoesNotExist):
            detector.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_subscription.refresh_from_db()
        mock_remove_seat.assert_called_with(DataCategory.UPTIME, detector)


class IsUrlMonitoredForProjectTest(UptimeTestCase):
    def test_not_monitored(self) -> None:
        assert not is_url_auto_monitored_for_project(self.project, "https://sentry.io")
        detector = self.create_uptime_detector(mode=UptimeMonitorMode.MANUAL)
        uptime_subscription = get_uptime_subscription(detector)
        assert not is_url_auto_monitored_for_project(self.project, uptime_subscription.url)

    def test_monitored(self) -> None:
        detector = self.create_uptime_detector(mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE)
        uptime_subscription = get_uptime_subscription(detector)
        assert is_url_auto_monitored_for_project(self.project, uptime_subscription.url)

    def test_monitored_other_project(self) -> None:
        other_project = self.create_project()
        detector = self.create_uptime_detector(
            project=self.project,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        uptime_subscription = get_uptime_subscription(detector)
        assert is_url_auto_monitored_for_project(self.project, uptime_subscription.url)
        assert not is_url_auto_monitored_for_project(other_project, uptime_subscription.url)


class GetAutoMonitoredSubscriptionsForProjectTest(UptimeTestCase):
    def test_empty(self) -> None:
        assert get_auto_monitored_detectors_for_project(self.project) == []

    def test(self) -> None:
        detector = self.create_uptime_detector(mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE)
        assert get_auto_monitored_detectors_for_project(self.project) == [detector]
        other_detector = self.create_uptime_detector(
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING
        )
        self.create_uptime_detector(mode=UptimeMonitorMode.MANUAL)
        assert set(get_auto_monitored_detectors_for_project(self.project)) == {
            detector,
            other_detector,
        }

    def test_other_project(self) -> None:
        other_project = self.create_project()
        self.create_uptime_detector(mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE)
        assert get_auto_monitored_detectors_for_project(other_project) == []


class DisableUptimeDetectorTest(UptimeTestCase):
    @mock.patch("sentry.quotas.backend.disable_seat")
    def test(self, mock_disable_seat: mock.MagicMock) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.MANUAL,
        )
        uptime_subscription = get_uptime_subscription(detector)

        with self.tasks():
            disable_uptime_detector(detector)

        uptime_subscription.refresh_from_db()
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, detector)

        detector.refresh_from_db()
        assert not detector.enabled

    @mock.patch("sentry.quotas.backend.disable_seat")
    @mock.patch("sentry.uptime.subscriptions.subscriptions.resolve_uptime_issue")
    def test_disable_failed(self, mock_resolve_uptime_issue, mock_disable_seat) -> None:
        with (
            self.tasks(),
            self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()),
        ):
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            uptime_subscription = get_uptime_subscription(detector)

            # Set detector state to HIGH to simulate a failed state
            self.create_detector_state(
                detector=detector,
                detector_group_key=None,
                state=DetectorPriorityLevel.HIGH,
                is_triggered=True,
            )

            disable_uptime_detector(detector)
            mock_resolve_uptime_issue.assert_called_with(detector)

        detector.refresh_from_db()
        uptime_subscription.refresh_from_db()
        # After disabling, the detector state should be OK and not triggered (we reset it)
        detector_state = detector.detectorstate_set.first()
        assert detector_state is not None
        assert not detector_state.is_triggered
        assert detector_state.priority_level == DetectorPriorityLevel.OK
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, detector)

        detector.refresh_from_db()
        assert not detector.enabled

    @mock.patch("sentry.quotas.backend.disable_seat")
    def test_already_disabled(self, mock_disable_seat: mock.MagicMock) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.MANUAL,
        )
        # Manually disable the detector first
        detector.update(enabled=False)

        disable_uptime_detector(detector)

        mock_disable_seat.assert_not_called()

    @mock.patch("sentry.quotas.backend.disable_seat")
    def test_skip_quotas(self, mock_disable_seat: mock.MagicMock) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.MANUAL,
        )
        uptime_subscription = get_uptime_subscription(detector)

        with self.tasks():
            disable_uptime_detector(detector, skip_quotas=True)

        uptime_subscription.refresh_from_db()
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value
        mock_disable_seat.assert_not_called()

        detector.refresh_from_db()
        assert not detector.enabled


class EnableUptimeDetectorTest(UptimeTestCase):
    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test(self, mock_assign_seat: mock.MagicMock) -> None:
        # Mock out enable_uptime_detector here to avoid calling it
        # and polluting our mock quota calls.
        with mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector"):
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            uptime_subscription = get_uptime_subscription(detector)

        # Calling enable_uptime_detector on an already enabled
        # monitor does nothing
        enable_uptime_detector(detector)
        mock_assign_seat.assert_not_called()

        detector.refresh_from_db()

        # Manually mark the monitor and subscription as disabled
        detector.update(enabled=False)
        detector.refresh_from_db()

        uptime_subscription.update(status=UptimeSubscription.Status.DISABLED.value)
        uptime_subscription.refresh_from_db()
        uptime_subscription.refresh_from_db()

        # Enabling the subscription marks the subscription as active again
        with self.tasks():
            enable_uptime_detector(detector)

        uptime_subscription.refresh_from_db()
        assert detector.enabled
        assert uptime_subscription.status == UptimeSubscription.Status.ACTIVE.value

        # Seat assignment was called
        mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

        detector.refresh_from_db()
        assert detector.enabled

    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="Testing"),
    )
    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.RATE_LIMITED,
    )
    def test_no_seat_assignment(
        self, mock_assign_seat: mock.MagicMock, mock_check_assign_seat: mock.MagicMock
    ) -> None:
        # Mock out enable_uptime_detector here to avoid calling it
        # and polluting our mock quota calls.
        with mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector"):
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
            uptime_subscription = get_uptime_subscription(detector)

        # We'll be unable to assign a seat
        with self.tasks(), raises(UptimeMonitorNoSeatAvailable) as exc_info:
            enable_uptime_detector(detector, ensure_assignment=True)

        assert exc_info.value.result is not None
        assert exc_info.value.result.reason == "Testing"

        uptime_subscription.refresh_from_db()
        assert not detector.enabled
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value

        detector.refresh_from_db()
        assert not detector.enabled

        mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector)
        mock_check_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_already_enabled(self, mock_assign_seat: mock.MagicMock) -> None:
        detector = create_uptime_detector(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=UptimeMonitorMode.MANUAL,
        )

        assert detector.enabled
        assert detector.enabled

        # Clear previous calls from creation
        mock_assign_seat.reset_mock()

        enable_uptime_detector(detector)

        # On the "second" call we find it's already enabled so do nothing
        mock_assign_seat.assert_not_called()

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_skip_quotas(self, mock_assign_seat: mock.MagicMock) -> None:
        # Mock out enable_uptime_detector here to avoid calling it
        # and polluting our mock quota calls.
        with mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector"):
            detector = create_uptime_detector(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=UptimeMonitorMode.MANUAL,
            )
        uptime_subscription = get_uptime_subscription(detector)

        # Manually mark the monitor and subscription as disabled
        detector.update(enabled=False)
        detector.refresh_from_db()

        uptime_subscription.update(status=UptimeSubscription.Status.DISABLED.value)
        uptime_subscription.refresh_from_db()
        uptime_subscription.refresh_from_db()

        # Enabling the subscription marks the subscription as active again
        with self.tasks():
            enable_uptime_detector(detector, skip_quotas=True)

        uptime_subscription.refresh_from_db()
        assert detector.enabled
        assert uptime_subscription.status == UptimeSubscription.Status.ACTIVE.value

        mock_assign_seat.assert_not_called()

        detector.refresh_from_db()
        assert detector.enabled

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_enable_with_other_disabled_monitors_present(
        self, mock_assign_seat: mock.MagicMock
    ) -> None:
        """
        Verify that enabling a monitor works regardless of disabled monitors in the organization.

        The ENABLE path (via update_uptime_detector) uses billing seat quota checks only,
        not the organization-level monitor count limit. This allows enabling monitors even
        when other disabled monitors exist, as long as billing quota is available.
        """
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=2
        ):
            # Create two monitors
            with mock.patch("sentry.uptime.subscriptions.subscriptions.enable_uptime_detector"):
                detector1 = create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://example1.com",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )
                detector2 = create_uptime_detector(
                    self.project,
                    self.environment,
                    url="https://example2.com",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=UptimeMonitorMode.MANUAL,
                )

            # Disable first monitor
            disable_uptime_detector(detector1)
            detector1.refresh_from_db()
            assert detector1.enabled is False
            assert detector1.status == ObjectStatus.ACTIVE

            # Mark second monitor as disabled
            detector2.update(enabled=False)
            uptime_sub2 = get_uptime_subscription(detector2)
            uptime_sub2.update(status=UptimeSubscription.Status.DISABLED.value)

            # Should be able to enable the second monitor even though first is disabled
            # This bypasses check_uptime_subscription_limit() and only checks billing quota
            with self.tasks():
                enable_uptime_detector(detector2)

            detector2.refresh_from_db()
            assert detector2.enabled is True

            # Verify quota backend was called for seat assignment
            mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector2)

            # Verify we still have 1 enabled and 1 disabled
            enabled_count = Detector.objects.filter(
                project__organization_id=self.organization.id,
                status=ObjectStatus.ACTIVE,
                enabled=True,
                type=UptimeDomainCheckFailure.slug,
                config__mode=UptimeMonitorMode.MANUAL.value,
            ).count()
            assert enabled_count == 1

            disabled_count = Detector.objects.filter(
                project__organization_id=self.organization.id,
                status=ObjectStatus.ACTIVE,
                enabled=False,
                type=UptimeDomainCheckFailure.slug,
                config__mode=UptimeMonitorMode.MANUAL.value,
            ).count()
            assert disabled_count == 1


class CheckAndUpdateRegionsTest(UptimeTestCase):
    def run_check_and_update_region_test(
        self,
        sub: UptimeSubscription,
        regions: list[str],
        region_overrides: dict[str, UptimeSubscriptionRegion.RegionMode],
        expected_regions_before: dict[str, UptimeSubscriptionRegion.RegionMode],
        expected_regions_after: dict[str, UptimeSubscriptionRegion.RegionMode],
    ):
        region_configs = [
            UptimeRegionConfig(slug=slug, name=slug, config_redis_key_prefix=slug)
            for slug in regions
        ]

        with (
            override_settings(UPTIME_REGIONS=region_configs),
            override_options({"uptime.checker-regions-mode-override": region_overrides}),
        ):
            assert {
                r.region_slug: UptimeSubscriptionRegion.RegionMode(r.mode)
                for r in sub.regions.all()
            } == expected_regions_before
            check_and_update_regions(sub, list(sub.regions.all()))
            sub.refresh_from_db()
            assert {
                r.region_slug: UptimeSubscriptionRegion.RegionMode(r.mode)
                for r in sub.regions.all()
            } == expected_regions_after

    def test_check_and_update_regions(self) -> None:
        sub = self.create_uptime_subscription(
            region_slugs=["region1"],
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
        )

    def test_check_and_update_regions_active_shadow(self) -> None:
        sub = self.create_uptime_subscription(
            region_slugs=["region1", "region2"],
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {"region2": UptimeSubscriptionRegion.RegionMode.SHADOW},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.SHADOW,
            },
        )

    def test_check_and_update_regions_removes_disabled(self) -> None:
        sub = self.create_uptime_subscription(region_slugs=["region1", "region2"])
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {"region2": UptimeSubscriptionRegion.RegionMode.INACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
        )
