from rest_framework.exceptions import ErrorDetail

from sentry.testutils.helpers import with_feature
from sentry.uptime.models import ProjectUptimeSubscription, ProjectUptimeSubscriptionMode
from sentry.uptime.subscriptions.subscriptions import DEFAULT_SUBSCRIPTION_TIMEOUT_MS
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class ProjectUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-project-uptime-alert-index"


class ProjectUptimeAlertIndexPostEndpointTest(ProjectUptimeAlertIndexBaseEndpointTest):
    method = "post"

    def test_no_feature(self):
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            status_code=404,
        )

    @with_feature("organizations:uptime-api-create-update")
    def test(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_monitor.name == "test"
        assert uptime_monitor.owner_user_id == self.user.id
        assert uptime_monitor.owner_team_id is None
        assert uptime_monitor.mode == ProjectUptimeSubscriptionMode.MANUAL
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == DEFAULT_SUBSCRIPTION_TIMEOUT_MS

    @with_feature("organizations:uptime-api-create-update")
    def test_no_owner(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            url="http://sentry.io",
            owner=None,
            interval_seconds=60,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_monitor.name == "test"
        assert uptime_monitor.owner_user_id is None
        assert uptime_monitor.owner_team_id is None
        assert uptime_monitor.mode == ProjectUptimeSubscriptionMode.MANUAL
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == DEFAULT_SUBSCRIPTION_TIMEOUT_MS

    @with_feature("organizations:uptime-api-create-update")
    def test_mode_no_superadmin(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            status_code=400,
        )
        assert resp.data == {
            "mode": [ErrorDetail(string="Only superusers can modify `mode`", code="invalid")]
        }

    @with_feature("organizations:uptime-api-create-update")
    def test_mode_superadmin(self):
        self.login_as(self.user, superuser=True)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_monitor.name == "test"
        assert uptime_monitor.owner_user_id == self.user.id
        assert uptime_monitor.owner_team_id is None
        assert uptime_monitor.mode == ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == DEFAULT_SUBSCRIPTION_TIMEOUT_MS
