import pytest

from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.skips import requires_kafka
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeSubscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    UPTIME_SUBSCRIPTION_TYPE,
    create_project_uptime_subscription,
    create_uptime_subscription,
    delete_project_uptime_subscription,
    delete_uptime_subscription,
    delete_uptime_subscriptions_for_project,
    get_auto_monitored_subscriptions_for_project,
    is_url_auto_monitored_for_project,
    remove_uptime_subscription_if_unused,
)

pytestmark = [requires_kafka]


class CreateUptimeSubscriptionTest(UptimeTestCase):
    def test(self):
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

    def test_private_domain_suffix(self):
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

    def test_duplicate(self):
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

        assert uptime_sub.id == second_sub.id
        assert uptime_sub.subscription_id == second_sub.subscription_id

    def test_deleting_status(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        uptime_sub.update(status=UptimeSubscription.Status.DELETING.value)
        with self.tasks():
            new_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Should be the same sub
        new_sub.refresh_from_db()
        assert uptime_sub.id == new_sub.id
        assert new_sub.status == UptimeSubscription.Status.ACTIVE.value
        assert new_sub.subscription_id is not None
        assert new_sub.subscription_id != uptime_sub.subscription_id

    def test_without_task(self):
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


class DeleteUptimeSubscriptionTest(UptimeTestCase):
    def test_with_task(self):
        with self.tasks():
            uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_uptime_subscription(uptime_sub)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_without_task(self):
        with self.tasks():
            uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)

        delete_uptime_subscription(uptime_sub)

        uptime_sub.refresh_from_db()
        assert uptime_sub.status == UptimeSubscription.Status.DELETING.value


class CreateProjectUptimeSubscriptionTest(UptimeTestCase):
    def test(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        assert ProjectUptimeSubscription.objects.filter(
            project=self.project,
            uptime_subscription=uptime_sub,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        ).exists()

    def test_already_exists(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_sub
            ).count()
            == 1
        )

    def test_different_modes(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.MANUAL
        )
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_sub
            ).count()
            == 2
        )


class DeleteUptimeSubscriptionsForProjectTest(UptimeTestCase):
    def test_other_subscriptions(self):
        other_project = self.create_project()
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        create_project_uptime_subscription(
            other_project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                uptime_sub,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()

    def test_single_subscriptions(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                uptime_sub,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_does_not_exist(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project, uptime_sub, modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE]
            )

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_does_not_exist_other_subs(self):
        other_project = self.create_project()
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(
            other_project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project, uptime_sub, modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE]
            )

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()

    def test_delete_other_modes(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_active_sub = create_project_uptime_subscription(
            self.project,
            uptime_sub,
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        proj_manual_sub = create_project_uptime_subscription(
            self.project,
            uptime_sub,
            ProjectUptimeSubscriptionMode.MANUAL,
        )
        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                uptime_sub,
                modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_active_sub.refresh_from_db()

        assert ProjectUptimeSubscription.objects.filter(id=proj_manual_sub.id).exists()
        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()

        with self.tasks():
            delete_uptime_subscriptions_for_project(
                self.project,
                uptime_sub,
                modes=[ProjectUptimeSubscriptionMode.MANUAL],
            )

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_manual_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()


class DeleteProjectUptimeSubscriptionTest(UptimeTestCase):
    def test_other_subscriptions(self):
        other_project = self.create_project()
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        create_project_uptime_subscription(
            other_project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        with self.tasks():
            delete_project_uptime_subscription(proj_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()

    def test_single_subscriptions(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(
            self.project, uptime_sub, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        )
        with self.tasks():
            delete_project_uptime_subscription(proj_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()


class RemoveUptimeSubscriptionIfUnusedTest(UptimeTestCase):
    def test_remove(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            remove_uptime_subscription_if_unused(uptime_sub)

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_keep(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(
            self.project,
            uptime_sub,
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        with self.tasks():
            remove_uptime_subscription_if_unused(uptime_sub)

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()


class IsUrlMonitoredForProjectTest(UptimeTestCase):
    def test_not_monitored(self):
        assert not is_url_auto_monitored_for_project(self.project, "https://sentry.io")
        subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(),
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )
        assert not is_url_auto_monitored_for_project(
            self.project, subscription.uptime_subscription.url
        )

    def test_monitored(self):
        subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(),
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        assert is_url_auto_monitored_for_project(self.project, subscription.uptime_subscription.url)

    def test_monitored_other_project(self):
        other_project = self.create_project()
        subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(),
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
            uptime_subscription=self.create_uptime_subscription(),
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        assert get_auto_monitored_subscriptions_for_project(self.project) == [subscription]
        other_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(url="https://santry.io"),
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
        )
        self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(url="https://sintry.io"),
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )
        assert set(get_auto_monitored_subscriptions_for_project(self.project)) == {
            subscription,
            other_subscription,
        }

    def test_other_project(self):
        other_project = self.create_project()
        self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(),
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        assert get_auto_monitored_subscriptions_for_project(other_project) == []
