from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.quotas.base import SeatAssignmentResult
from sentry.uptime.endpoints.validators import MAX_REQUEST_SIZE_BYTES
from sentry.uptime.models import ProjectUptimeSubscription, ProjectUptimeSubscriptionMode
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class ProjectUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-project-uptime-alert-index"


class ProjectUptimeAlertIndexPostEndpointTest(ProjectUptimeAlertIndexBaseEndpointTest):
    method = "post"

    def test(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            environment="uptime-prod",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            body=None,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_monitor.name == "test"
        assert uptime_monitor.environment == Environment.get_or_create(
            project=self.project, name="uptime-prod"
        )
        assert uptime_monitor.owner_user_id == self.user.id
        assert uptime_monitor.owner_team_id is None
        assert uptime_monitor.mode == ProjectUptimeSubscriptionMode.MANUAL
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == 1500
        assert uptime_subscription.body is None
        assert uptime_subscription.trace_sampling is False

    def test_set_trace_sampling(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            environment="uptime-prod",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            body=None,
            trace_sampling=True,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_subscription.trace_sampling is True

    def test_no_environment(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            body=None,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert uptime_monitor.environment is None

    def test_no_owner(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            url="http://sentry.io",
            owner=None,
            interval_seconds=60,
            timeout_ms=1000,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert uptime_monitor.owner_user_id is None
        assert uptime_monitor.owner_team_id is None

        # Test without passing the owner
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            url="http://getsentry.com",
            interval_seconds=60,
            timeout_ms=1000,
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert uptime_monitor.owner_user_id is None
        assert uptime_monitor.owner_team_id is None

    def test_mode_no_superadmin(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            status_code=400,
        )
        assert resp.data == {
            "mode": [ErrorDetail(string="Only superusers can modify `mode`", code="invalid")]
        }

    def test_mode_superadmin(self):
        self.login_as(self.user, superuser=True)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
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
        assert uptime_subscription.timeout_ms == 1000

    def test_headers_body_method(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body='{"key": "value"}',
            headers=[["header", "value"]],
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        uptime_subscription = uptime_monitor.uptime_subscription
        assert uptime_subscription.body == '{"key": "value"}'
        assert uptime_subscription.headers == [["header", "value"]]

    def test_headers_body_method_already_exists(self):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body='{"key": "value"}',
            headers=[["header", "value"]],
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        new_proj = self.create_project()
        resp = self.get_success_response(
            self.organization.slug,
            new_proj.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body='{"key": "value"}',
            headers=[["header", "value"]],
        )
        new_uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert uptime_monitor.uptime_subscription_id != new_uptime_monitor.uptime_subscription_id
        assert new_uptime_monitor.project_id != uptime_monitor.project_id
        resp = self.get_success_response(
            self.organization.slug,
            new_proj.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body='{"key": "value"}',
            headers=[["header", "different value"]],
        )
        newer_uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert (
            newer_uptime_monitor.uptime_subscription_id != new_uptime_monitor.uptime_subscription_id
        )

    def test_headers_invalid_format(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body='{"key": "value"}',
            headers={"header", "value"},
            status_code=400,
        )
        assert resp.data == {
            "headers": [ErrorDetail(string="Expected array of header tuples.", code="invalid")]
        }

    def test_size_too_big(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            method="POST",
            body="body" * 250,
            headers=[["header", "value"]],
        )
        assert resp.data == {
            "nonFieldErrors": [
                ErrorDetail(
                    string=f"Request is too large, max size is {MAX_REQUEST_SIZE_BYTES} bytes",
                    code="invalid",
                )
            ]
        }

    def test_over_limit(self):
        with mock.patch(
            "sentry.uptime.subscriptions.subscriptions.MAX_MANUAL_SUBSCRIPTIONS_PER_ORG", new=1
        ):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                environment=self.environment.name,
                name="test",
                url="http://sentry.io",
                interval_seconds=60,
                timeout_ms=1000,
                owner=f"user:{self.user.id}",
            )
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                environment=self.environment.name,
                name="test",
                url="http://santry.io",
                interval_seconds=60,
                timeout_ms=1000,
                owner=f"user:{self.user.id}",
            )

    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="Testing"),
    )
    def test_no_seat_assignment(self, _mock_check_assign_seat):
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            owner=f"user:{self.user.id}",
        )
        uptime_monitor = ProjectUptimeSubscription.objects.get(id=resp.data["id"])
        assert uptime_monitor.status == ObjectStatus.DISABLED
