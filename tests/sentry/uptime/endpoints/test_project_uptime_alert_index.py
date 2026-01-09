from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry.uptime.endpoints.validators import MAX_REQUEST_SIZE_BYTES
from sentry.uptime.models import get_uptime_subscription
from sentry.uptime.types import (
    DEFAULT_DOWNTIME_THRESHOLD,
    DEFAULT_RECOVERY_THRESHOLD,
    UptimeMonitorMode,
)
from sentry.utils.outcomes import Outcome
from sentry.workflow_engine.models import Detector
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class ProjectUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-project-uptime-alert-index"


class ProjectUptimeAlertIndexPostEndpointTest(ProjectUptimeAlertIndexBaseEndpointTest):
    method = "post"

    def test(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        uptime_subscription = get_uptime_subscription(detector)
        assert detector.name == "test"
        assert detector.config["environment"] == "uptime-prod"
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None
        assert detector.config["mode"] == UptimeMonitorMode.MANUAL
        assert detector.config["recovery_threshold"] == DEFAULT_RECOVERY_THRESHOLD
        assert detector.config["downtime_threshold"] == DEFAULT_DOWNTIME_THRESHOLD
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == 1500
        assert uptime_subscription.body is None
        assert uptime_subscription.trace_sampling is False

    def test_set_trace_sampling(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.trace_sampling is True

    def test_custom_thresholds(self) -> None:
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            environment="uptime-prod",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            recovery_threshold=2,
            downtime_threshold=5,
        )
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.config["recovery_threshold"] == 2
        assert detector.config["downtime_threshold"] == 5

    def test_no_environment(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.config.get("environment") is None

    def test_no_owner(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None

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
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None

    def test_mode_no_superadmin(self) -> None:
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1000,
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
            status_code=400,
        )
        assert resp.data == {
            "mode": [ErrorDetail(string="Only superusers can modify `mode`", code="invalid")]
        }

    def test_mode_superadmin(self) -> None:
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
            mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        )
        detector = Detector.objects.get(id=resp.data["id"])
        uptime_subscription = get_uptime_subscription(detector)
        assert detector.name == "test"
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None
        assert detector.config["mode"] == UptimeMonitorMode.AUTO_DETECTED_ACTIVE
        assert uptime_subscription.url == "http://sentry.io"
        assert uptime_subscription.interval_seconds == 60
        assert uptime_subscription.timeout_ms == 1000

    def test_headers_body_method(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.body == '{"key": "value"}'
        assert uptime_subscription.headers == [["header", "value"]]

    def test_headers_body_method_already_exists(self) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        uptime_subscription = get_uptime_subscription(detector)
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
        new_detector = Detector.objects.get(id=resp.data["id"])
        new_uptime_subscription = get_uptime_subscription(new_detector)
        assert uptime_subscription.id != new_uptime_subscription.id
        assert new_detector.project_id != detector.project_id
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
        newer_detector = Detector.objects.get(id=resp.data["id"])
        newer_uptime_subscription = get_uptime_subscription(newer_detector)
        assert newer_uptime_subscription.id != new_uptime_subscription.id

    def test_headers_invalid_format(self) -> None:
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

    def test_size_too_big(self) -> None:
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

    def test_over_limit(self) -> None:
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
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.RATE_LIMITED,
    )
    def test_no_seat_assignment(self, _mock_assign_seat: mock.MagicMock) -> None:
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
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.enabled is False

    def test_timeout_too_large(self) -> None:
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            environment=self.environment.name,
            name="test",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=60_001,
            method="POST",
            body="body",
            headers=[["header", "value"]],
        )
        assert resp.data == {
            "timeoutMs": [
                ErrorDetail(
                    string="Ensure this value is less than or equal to 60000.",
                    code="max_value",
                )
            ]
        }

    def test_owner_team_not_member_denied(self) -> None:
        """
        Test that members cannot assign a team they are not a member of as owner.
        This is a regression test for an IDOR vulnerability.
        """
        # Create a second team that the user is NOT a member of
        other_team = self.create_team(organization=self.organization, name="other-team")

        # Create a user who is only a member of the project's team
        user_with_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_with_team,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(user_with_team)

        # Attempt to create an uptime monitor with the other team as owner
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            owner=f"team:{other_team.id}",
            status_code=400,
        )
        assert resp.data == {
            "owner": [
                ErrorDetail(
                    string="You do not have permission to assign this owner",
                    code="invalid",
                )
            ]
        }

    def test_owner_team_member_allowed(self) -> None:
        """
        Test that members CAN assign a team they are a member of as owner.
        """
        # Create a user who is a member of the project's team
        user_with_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_with_team,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(user_with_team)

        # Should succeed since user is a member of self.team
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            owner=f"team:{self.team.id}",
        )
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.owner_team_id == self.team.id

    def test_owner_team_admin_can_assign_any_team(self) -> None:
        """
        Test that users with team:admin scope CAN assign any team as owner.
        """
        # Create a second team that the user is NOT a member of
        other_team = self.create_team(organization=self.organization, name="other-team")

        # Create a user with admin role (has team:admin scope)
        admin_user = self.create_user(is_superuser=False)
        self.create_member(
            user=admin_user,
            organization=self.organization,
            role="admin",
            teams=[self.team],
        )
        self.login_as(admin_user)

        # Admin should be able to assign any team as owner
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            url="http://sentry.io",
            interval_seconds=60,
            timeout_ms=1500,
            owner=f"team:{other_team.id}",
        )
        detector = Detector.objects.get(id=resp.data["id"])
        assert detector.owner_team_id == other_team.id
