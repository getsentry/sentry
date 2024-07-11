import pytest

from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_kafka
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription
from sentry.uptime.subscriptions.subscriptions import (
    UPTIME_SUBSCRIPTION_TYPE,
    create_project_uptime_subscription,
    create_uptime_subscription,
    delete_project_uptime_subscription,
    delete_uptime_subscription,
)

pytestmark = [requires_kafka]


class CreateUptimeSubscriptionTest(TestCase):
    def test(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        with self.tasks():
            uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        # Subscription.subscription_id ends up set in the task, so refresh
        uptime_sub.refresh_from_db()
        assert uptime_sub.status == UptimeSubscription.Status.ACTIVE.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms

    def test_without_task(self):
        url = "https://sentry.io"
        interval_seconds = 300
        timeout_ms = 500
        uptime_sub = create_uptime_subscription(url, interval_seconds, timeout_ms)
        assert uptime_sub.subscription_id is None
        assert uptime_sub.status == UptimeSubscription.Status.CREATING.value
        assert uptime_sub.type == UPTIME_SUBSCRIPTION_TYPE
        assert uptime_sub.url == url
        assert uptime_sub.interval_seconds == uptime_sub.interval_seconds
        assert uptime_sub.timeout_ms == timeout_ms


class DeleteUptimeSubscriptionTest(TestCase):
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


class CreateProjectUptimeSubscriptionTest(TestCase):
    def test(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(self.project, uptime_sub)
        assert ProjectUptimeSubscription.objects.filter(
            project=self.project, uptime_subscription=uptime_sub
        ).exists()

    def test_already_exists(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(self.project, uptime_sub)
        create_project_uptime_subscription(self.project, uptime_sub)
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_sub
            ).count()
            == 1
        )


class DeleteProjectUptimeSubscriptionTest(TestCase):
    def test_other_subscriptions(self):
        other_project = self.create_project()
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(self.project, uptime_sub)
        create_project_uptime_subscription(other_project, uptime_sub)
        with self.tasks():
            delete_project_uptime_subscription(self.project, uptime_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()

    def test_single_subscriptions(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        proj_sub = create_project_uptime_subscription(self.project, uptime_sub)
        with self.tasks():
            delete_project_uptime_subscription(self.project, uptime_sub)

        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            proj_sub.refresh_from_db()

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_does_not_exist(self):
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        with self.tasks():
            delete_project_uptime_subscription(self.project, uptime_sub)

        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_sub.refresh_from_db()

    def test_does_not_exist_other_subs(self):
        other_project = self.create_project()
        uptime_sub = create_uptime_subscription("https://sentry.io", 3600, 1000)
        create_project_uptime_subscription(other_project, uptime_sub)
        with self.tasks():
            delete_project_uptime_subscription(self.project, uptime_sub)

        assert UptimeSubscription.objects.filter(id=uptime_sub.id).exists()
