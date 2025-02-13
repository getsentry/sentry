from unittest import mock

import pytest
from django.conf import settings
from django.test import override_settings
from pytest import raises

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.constants import DataCategory, ObjectStatus
from sentry.quotas.base import SeatAssignmentResult
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.skips import requires_kafka
from sentry.types.actor import Actor
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    UPTIME_SUBSCRIPTION_TYPE,
    MaxManualUptimeSubscriptionsReached,
    UptimeMonitorNoSeatAvailable,
    delete_project_uptime_subscription,
    delete_uptime_subscription,
    delete_uptime_subscriptions_for_project,
    disable_project_uptime_subscription,
    enable_project_uptime_subscription,
    get_auto_monitored_subscriptions_for_project,
    get_or_create_project_uptime_subscription,
    get_or_create_uptime_subscription,
    is_url_auto_monitored_for_project,
    remove_uptime_subscription_if_unused,
    update_project_uptime_subscription,
)
from sentry.utils.outcomes import Outcome

pytestmark = [requires_kafka]


class CreateUptimeSubscriptionTest(UptimeTestCase):
    def test(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
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

    def test_private_domain_suffix(self):
        url = "https://test.vercel.app"
        interval_seconds = 300
        timeout_ms = 500
        uptime_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
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

    def test_duplicate(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        assert uptime_sub.subscription_id is not None
        with self.tasks():
            second_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
        second_sub.refresh_from_db()

        assert uptime_sub.id == second_sub.id
        assert uptime_sub.subscription_id == second_sub.subscription_id

    def test_deleting_status(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        uptime_sub.update(status=UptimeSubscription.Status.DELETING.value)
        with self.tasks():
            new_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Should be the same sub
        new_sub.refresh_from_db()
        assert uptime_sub.id == new_sub.id
        assert new_sub.status == UptimeSubscription.Status.ACTIVE.value
        assert new_sub.subscription_id is not None

    def test_without_task(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        uptime_sub = get_or_create_uptime_subscription(url, interval_seconds, timeout_ms)
        assert uptime_sub.subscription_id is None
        assert uptime_sub.status == UptimeSubscription.Status.CREATING.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.url_domain == "sentry"
        assert uptime_sub.url_domain_suffix == "io"
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms


class DeleteUptimeSubscriptionTest(UptimeTestCase):
    def test_with_task(self):
        with self.tasks():
            uptime_sub = get_or_create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_uptime_subscription(uptime_sub)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_without_task(self):
        with self.tasks():
            uptime_sub = get_or_create_uptime_subscription("https://sentry.io", 3600, 1000)

        delete_uptime_subscription(uptime_sub)

        uptime_sub.refresh_from_db()
        assert uptime_sub.status == UptimeSubscription.Status.DELETING.value


class CreateProjectUptimeSubscriptionTest(UptimeTestCase):
    def test(self):
        created = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[1]
        assert created
        assert ProjectUptimeSubscription.objects.filter(
            project=self.project,
            uptime_subscription__url="https://sentry.io",
            uptime_subscription__interval_seconds=3600,
            uptime_subscription__timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        ).exists()

    def test_already_exists(self):
        assert get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[1]
        assert not get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[1]

        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project,
                uptime_subscription__url="https://sentry.io",
                uptime_subscription__interval_seconds=3600,
                uptime_subscription__timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            ).count()
            == 1
        )

    def test_different_modes(self):
        assert get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[1]
        assert get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )[1]

        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project,
                uptime_subscription__url="https://sentry.io",
                uptime_subscription__interval_seconds=3600,
                uptime_subscription__timeout_ms=1000,
            ).count()
            == 2
        )

    def test_max_proj_subs(self):
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=1
        ):
            assert get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[1]
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                assert get_or_create_project_uptime_subscription(
                    self.project,
                    self.environment,
                    url="https://santry.io",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=ProjectUptimeSubscriptionMode.MANUAL,
                )[1]

    def test_override_max_proj_subs(self):
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=1
        ):
            assert get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[1]
            with pytest.raises(MaxManualUptimeSubscriptionsReached):
                get_or_create_project_uptime_subscription(
                    self.project,
                    self.environment,
                    url="https://santry.io",
                    interval_seconds=3600,
                    timeout_ms=1000,
                    mode=ProjectUptimeSubscriptionMode.MANUAL,
                    override_manual_org_limit=False,
                )[1]
            assert get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://santry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
                override_manual_org_limit=True,
            )[1]

    def test_auto_associates_active_regions(self):
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
            override_options({"uptime.disabled-checker-regions": ["region3"]}),
        ):
            subscription = get_or_create_uptime_subscription(
                url="https://example.com",
                interval_seconds=60,
                timeout_ms=1000,
            )

            # Should only have the enabled regions
            subscription_regions = {r.region_slug for r in subscription.regions.all()}
            assert subscription_regions == {"region1", "region2"}

            # Creating again should return same subscription with same regions
            subscription2 = get_or_create_uptime_subscription(
                url="https://example.com",
                interval_seconds=60,
                timeout_ms=1000,
            )
            assert subscription2.id == subscription.id
            subscription_regions = {r.region_slug for r in subscription2.regions.all()}
            assert subscription_regions == {"region1", "region2"}

    @mock.patch("sentry.uptime.subscriptions.subscriptions.disable_project_uptime_subscription")
    def test_status_disable(self, mock_disable_project_uptime_subscription):
        get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            status=ObjectStatus.DISABLED,
        )
        mock_disable_project_uptime_subscription.assert_called()

    @mock.patch("sentry.uptime.subscriptions.subscriptions.enable_project_uptime_subscription")
    def test_status_enable(self, mock_enable_project_uptime_subscription):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.ACTIVE,
            )[0]
            mock_enable_project_uptime_subscription.assert_called_with(
                proj_sub, ensure_assignment=True
            )

    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="Testing"),
    )
    def test_no_seat_asssignment(self, _mock_check_assign_seat):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.ACTIVE,
            )[0]

        # Monitor created but is not enabled due to no seat assignment
        assert proj_sub.status == ObjectStatus.DISABLED
        assert proj_sub.uptime_subscription.status == UptimeSubscription.Status.DISABLED.value


class UpdateProjectUptimeSubscriptionTest(UptimeTestCase):
    def test(self):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            )[0]
            prev_uptime_subscription = proj_sub.uptime_subscription
            update_project_uptime_subscription(
                proj_sub,
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

        with pytest.raises(UptimeSubscription.DoesNotExist):
            prev_uptime_subscription.refresh_from_db()

        assert ProjectUptimeSubscription.objects.filter(
            project=self.project,
            uptime_subscription__url="https://santry.io",
            uptime_subscription__interval_seconds=60,
            uptime_subscription__timeout_ms=1000,
            uptime_subscription__method="POST",
            uptime_subscription__headers=[["some", "header"]],
            uptime_subscription__body="a body",
            name="New name",
            owner_user_id=self.user.id,
            owner_team_id=None,
            # Since we updated, should be marked as manual
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        ).exists()

    def test_removes_old(self):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            )[0]
            prev_uptime_subscription = proj_sub.uptime_subscription
            update_project_uptime_subscription(
                proj_sub,
                environment=self.environment,
                url="https://santry.io",
                interval_seconds=proj_sub.uptime_subscription.interval_seconds,
                timeout_ms=1000,
                method=proj_sub.uptime_subscription.method,
                headers=proj_sub.uptime_subscription.headers,
                body=proj_sub.uptime_subscription.body,
                name=proj_sub.name,
                owner=proj_sub.owner,
                trace_sampling=proj_sub.uptime_subscription.trace_sampling,
            )

        with pytest.raises(UptimeSubscription.DoesNotExist):
            prev_uptime_subscription.refresh_from_db()

        assert ProjectUptimeSubscription.objects.filter(
            project=self.project,
            uptime_subscription__url="https://santry.io",
            uptime_subscription__interval_seconds=3600,
            uptime_subscription__timeout_ms=1000,
            # Since we updated, should be marked as manual
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        ).exists()

    def test_already_exists(self):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[0]
            other_proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://santry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[0]

            update_project_uptime_subscription(
                proj_sub,
                environment=self.environment,
                url=proj_sub.uptime_subscription.url,
                interval_seconds=other_proj_sub.uptime_subscription.interval_seconds,
                timeout_ms=1000,
                method=other_proj_sub.uptime_subscription.method,
                headers=other_proj_sub.uptime_subscription.headers,
                body=other_proj_sub.uptime_subscription.body,
                name=other_proj_sub.name,
                owner=other_proj_sub.owner,
                trace_sampling=other_proj_sub.uptime_subscription.trace_sampling,
            )

        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project,
                uptime_subscription__url="https://sentry.io",
                uptime_subscription__interval_seconds=3600,
                uptime_subscription__timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            ).count()
            == 1
        )

    @mock.patch("sentry.uptime.subscriptions.subscriptions.disable_project_uptime_subscription")
    def test_status_disable(self, mock_disable_project_uptime_subscription):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            )[0]
            update_project_uptime_subscription(
                proj_sub,
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
        mock_disable_project_uptime_subscription.assert_called()

    @mock.patch("sentry.uptime.subscriptions.subscriptions.enable_project_uptime_subscription")
    def test_status_enable(self, mock_enable_project_uptime_subscription):
        with self.tasks():
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                status=ObjectStatus.DISABLED,
            )[0]
            update_project_uptime_subscription(
                proj_sub,
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
            )
        mock_enable_project_uptime_subscription.assert_called()


class DeleteUptimeSubscriptionsForProjectTest(UptimeTestCase):
    def test_other_subscriptions(self):
        other_project = self.create_project()
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]
        get_or_create_project_uptime_subscription(
            other_project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                proj_sub.uptime_subscription,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=proj_sub.uptime_subscription.id).exists()

    def test_single_subscriptions(self):
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                proj_sub.uptime_subscription,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            proj_sub.uptime_subscription.refresh_from_db()

    def test_does_not_exist(self):
        uptime_sub = get_or_create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project, uptime_sub, modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE]
            )

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_does_not_exist_other_subs(self):
        other_project = self.create_project()
        other_proj_sub = get_or_create_project_uptime_subscription(
            other_project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                other_proj_sub.uptime_subscription,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        assert UptimeSubscription.objects.filter(id=other_proj_sub.uptime_subscription_id).exists()

    def test_delete_other_modes(self):
        proj_active_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]
        proj_manual_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )[0]

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                proj_manual_sub.uptime_subscription,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_active_sub.refresh_from_db()

        assert ProjectUptimeSubscription.objects.filter(id=proj_manual_sub.id).exists()
        assert UptimeSubscription.objects.filter(id=proj_manual_sub.uptime_subscription.id).exists()

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                proj_manual_sub.uptime_subscription,
                modes=[ProjectUptimeSubscriptionMode.MANUAL],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_manual_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            proj_manual_sub.uptime_subscription.refresh_from_db()


class DeleteProjectUptimeSubscriptionTest(UptimeTestCase):
    @mock.patch("sentry.quotas.backend.disable_seat")
    def test_other_subscriptions(self, mock_disable_seat):
        other_project = self.create_project()
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        other_sub = get_or_create_project_uptime_subscription(
            other_project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        assert proj_sub.uptime_subscription_id == other_sub.uptime_subscription_id

        with self.tasks():
            delete_project_uptime_subscription(proj_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=other_sub.uptime_subscription_id).exists()
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, proj_sub)

    @mock.patch("sentry.quotas.backend.disable_seat")
    def test_single_subscriptions(self, mock_disable_seat):
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]
        with self.tasks():
            delete_project_uptime_subscription(proj_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            proj_sub.uptime_subscription.refresh_from_db()
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, proj_sub)


class RemoveUptimeSubscriptionIfUnusedTest(UptimeTestCase):
    def test_remove(self):
        uptime_sub = get_or_create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            remove_uptime_subscription_if_unused(uptime_sub)

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_keep(self):
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )[0]

        with self.tasks():
            remove_uptime_subscription_if_unused(proj_sub.uptime_subscription)

        assert UptimeSubscription.objects.filter(id=proj_sub.uptime_subscription_id).exists()


class IsUrlMonitoredForProjectTest(UptimeTestCase):
    def test_not_monitored(self):
        assert not is_url_auto_monitored_for_project(self.project, "https://sentry.io")
        subscription = self.create_project_uptime_subscription(
            mode=ProjectUptimeSubscriptionMode.MANUAL
        )
        assert not is_url_auto_monitored_for_project(
            self.project, subscription.uptime_subscription.url
        )

    def test_monitored(self):
        subscription = self.create_project_uptime_subscription(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        assert is_url_auto_monitored_for_project(self.project, subscription.uptime_subscription.url)

    def test_monitored_other_project(self):
        other_project = self.create_project()
        subscription = self.create_project_uptime_subscription(
            project=self.project,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        assert is_url_auto_monitored_for_project(self.project, subscription.uptime_subscription.url)
        assert not is_url_auto_monitored_for_project(
            other_project, subscription.uptime_subscription.url
        )


class GetAutoMonitoredSubscriptionsForProjectTest(UptimeTestCase):
    def test_empty(self):
        assert get_auto_monitored_subscriptions_for_project(self.project) == []

    def test(self):
        subscription = self.create_project_uptime_subscription(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        assert get_auto_monitored_subscriptions_for_project(self.project) == [subscription]
        other_subscription = self.create_project_uptime_subscription(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING
        )
        self.create_project_uptime_subscription(mode=ProjectUptimeSubscriptionMode.MANUAL)
        assert set(get_auto_monitored_subscriptions_for_project(self.project)) == {
            subscription,
            other_subscription,
        }

    def test_other_project(self):
        other_project = self.create_project()
        self.create_project_uptime_subscription(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        assert get_auto_monitored_subscriptions_for_project(other_project) == []


class DisableProjectUptimeSubscriptionTest(UptimeTestCase):
    @mock.patch("sentry.quotas.backend.disable_seat")
    def test(self, mock_disable_seat):
        proj_sub = get_or_create_project_uptime_subscription(
            self.project,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )[0]

        with self.tasks():
            disable_project_uptime_subscription(proj_sub)

        proj_sub.refresh_from_db()
        assert proj_sub.status == ObjectStatus.DISABLED
        assert proj_sub.uptime_subscription.status == UptimeSubscription.Status.DISABLED.value
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, proj_sub)

    def test_multiple_project_subs(self):
        project1 = self.project
        project2 = self.create_project()

        proj_sub1 = get_or_create_project_uptime_subscription(
            project1,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )[0]
        proj_sub2 = get_or_create_project_uptime_subscription(
            project2,
            self.environment,
            url="https://sentry.io",
            interval_seconds=3600,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )[0]

        uptime_subscription = proj_sub1.uptime_subscription

        # Disabling the first project subscription does NOT disable the
        # subscription
        with self.tasks():
            disable_project_uptime_subscription(proj_sub1)

        proj_sub1.refresh_from_db()
        uptime_subscription.refresh_from_db()
        assert proj_sub1.status == ObjectStatus.DISABLED
        assert proj_sub2.status == ObjectStatus.ACTIVE
        assert uptime_subscription.status != UptimeSubscription.Status.DISABLED.value

        # Disabling the second project subscription DOES disable the
        # subscription
        with self.tasks():
            disable_project_uptime_subscription(proj_sub2)

        proj_sub2.refresh_from_db()
        uptime_subscription.refresh_from_db()
        assert proj_sub2.status == ObjectStatus.DISABLED
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value


class EnableProjectUptimeSubscriptionTest(UptimeTestCase):
    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=True),
    )
    def test(self, mock_assign_seat, mock_check_assign_seat):
        # Mock out enable_project_uptime_subscription here to avoid calling it
        # and polluting our mock quota calls.
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.enable_project_uptime_subscription"
        ):
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[0]

        # Calling enable_project_uptime_subscription on an already enabled
        # monitor does nothing
        enable_project_uptime_subscription(proj_sub)
        mock_check_assign_seat.assert_not_called()

        # Manually mark the monitor and subscription as disabled
        proj_sub.update(status=ObjectStatus.DISABLED)
        proj_sub.uptime_subscription.update(status=UptimeSubscription.Status.DISABLED.value)
        proj_sub.refresh_from_db()
        proj_sub.uptime_subscription.refresh_from_db()

        # Enabling the subscription marks the suscription as active again
        with self.tasks():
            enable_project_uptime_subscription(proj_sub)

        proj_sub.refresh_from_db()
        assert proj_sub.status == ObjectStatus.ACTIVE
        assert proj_sub.uptime_subscription.status == UptimeSubscription.Status.ACTIVE.value

        # Seat assignemnt was called
        mock_check_assign_seat.assert_called_with(DataCategory.UPTIME, proj_sub)
        mock_assign_seat.assert_called_with(DataCategory.UPTIME, proj_sub)

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.RATE_LIMITED,
    )
    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="Testing"),
    )
    def test_no_seat_assignment(self, mock_check_assign_seat, mock_assign_seat):
        # Mock out enable_project_uptime_subscription here to avoid calling it
        # and polluting our mock quota calls.
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.enable_project_uptime_subscription"
        ):
            proj_sub = get_or_create_project_uptime_subscription(
                self.project,
                self.environment,
                url="https://sentry.io",
                interval_seconds=3600,
                timeout_ms=1000,
                mode=ProjectUptimeSubscriptionMode.MANUAL,
            )[0]

        # We'll be unable to assign a seat
        with self.tasks(), raises(UptimeMonitorNoSeatAvailable) as exc_info:
            enable_project_uptime_subscription(proj_sub, ensure_assignment=True)

        assert exc_info.value.result is not None
        assert exc_info.value.result.reason == "Testing"

        proj_sub.refresh_from_db()
        assert proj_sub.status == ObjectStatus.DISABLED
        assert proj_sub.uptime_subscription.status == UptimeSubscription.Status.DISABLED.value

        mock_check_assign_seat.assert_called_with(DataCategory.UPTIME, proj_sub)
        mock_assign_seat.assert_not_called()
