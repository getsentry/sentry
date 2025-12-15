from unittest import mock

import pytest
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers import serialize
from sentry.quotas.base import SeatAssignmentResult
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class ProjectUptimeAlertDetailsBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-project-uptime-alert-details"


class ProjectUptimeAlertDetailsGetEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    def test_simple(self) -> None:
        detector = self.create_uptime_detector()

        resp = self.get_success_response(self.organization.slug, detector.project.slug, detector.id)
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())

    def test_not_found(self) -> None:
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404

    def test_onboarding_detector_returns_404(self) -> None:
        from sentry.uptime.types import UptimeMonitorMode

        onboarding_detector = self.create_uptime_detector(
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING
        )

        resp = self.get_error_response(
            self.organization.slug, onboarding_detector.project.slug, onboarding_detector.id
        )
        assert resp.status_code == 404


class ProjectUptimeAlertDetailsPutEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    method = "put"

    def test_all(self) -> None:
        detector = self.create_uptime_detector()
        uptime_sub = get_uptime_subscription(detector)
        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            environment="uptime-prod",
            name="test",
            owner=f"user:{self.user.id}",
            url="https://santry.io",
            interval_seconds=300,
            timeout_ms=1500,
            headers=[["hello", "world"]],
            body="something",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        # Verify the detector config was updated
        assert detector.config.get("environment") == "uptime-prod"
        assert detector.name == "test"
        assert detector.owner
        assert detector.owner.identifier == f"user:{self.user.id}"
        uptime_sub = get_uptime_subscription(detector)
        assert uptime_sub.url == "https://santry.io"
        assert uptime_sub.interval_seconds == 300
        assert uptime_sub.timeout_ms == 1500
        assert uptime_sub.headers == [["hello", "world"]]
        assert uptime_sub.body == "something"
        assert uptime_sub.trace_sampling is False

        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test",
            owner=f"user:{self.user.id}",
            url="https://santry.io",
            interval_seconds=300,
            timeout_ms=1500,
            headers=[["hello", "world"]],
            body=None,
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.name == "test"
        assert detector.owner
        assert detector.owner.identifier == f"user:{self.user.id}"
        uptime_sub = get_uptime_subscription(detector)
        assert uptime_sub.url == "https://santry.io"
        assert uptime_sub.interval_seconds == 300
        assert uptime_sub.timeout_ms == 1500
        assert uptime_sub.headers == [["hello", "world"]]
        assert uptime_sub.body is None
        assert uptime_sub.trace_sampling is False

    def test_enviroment(self) -> None:
        detector = self.create_uptime_detector()

        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test",
            environment="uptime-prod",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.name == "test"
        assert detector.config.get("environment") == "uptime-prod"

    def test_user(self) -> None:
        detector = self.create_uptime_detector()

        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test",
            owner=f"user:{self.user.id}",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.name == "test"
        assert detector.owner
        assert detector.owner.identifier == f"user:{self.user.id}"

    def test_team(self) -> None:
        detector = self.create_uptime_detector()
        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test_2",
            owner=f"team:{self.team.id}",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.name == "test_2"
        assert detector.owner
        assert detector.owner.identifier == f"team:{self.team.id}"

    def test_invalid_owner(self) -> None:
        detector = self.create_uptime_detector()
        bad_user = self.create_user()

        resp = self.get_error_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            owner=f"user:{bad_user.id}",
        )
        assert resp.data == {
            "owner": [
                ErrorDetail(string="User is not a member of this organization", code="invalid")
            ]
        }

        bad_team = self.create_team(organization=self.create_organization())

        resp = self.get_error_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            owner=f"team:{bad_team.id}",
        )
        assert resp.data == {
            "owner": [
                ErrorDetail(string="Team is not a member of this organization", code="invalid")
            ]
        }

    def test_not_found(self) -> None:
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404

    @mock.patch("sentry.uptime.subscriptions.subscriptions.MAX_MONITORS_PER_DOMAIN", 1)
    def test_domain_limit(self) -> None:
        # First monitor is for test-one.example.com
        self.create_uptime_detector(
            uptime_subscription=self.create_uptime_subscription(
                url="test-one.example.com",
                url_domain="example",
                url_domain_suffix="com",
            )
        )

        # Update second monitor to use the same domain. This will fail with a
        # validation error
        detector = self.create_uptime_detector()
        resp = self.get_error_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            status_code=400,
            url="https://test-two.example.com",
        )
        assert (
            resp.data["url"][0]
            == "The domain *.example.com has already been used in 1 uptime monitoring alerts, which is the limit. You cannot create any additional alerts for this domain."
        )

    def test_status_disable(self) -> None:
        detector = self.create_uptime_detector()
        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test_2",
            status="disabled",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.enabled is False
        assert get_uptime_subscription(detector).status == UptimeSubscription.Status.DISABLED.value

    def test_status_enable(self) -> None:
        detector = self.create_uptime_detector(enabled=False)
        resp = self.get_success_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test_2",
            status="active",
        )
        detector.refresh_from_db()
        assert resp.data == serialize(detector, self.user, UptimeDetectorSerializer())
        assert detector.enabled is True

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=1,  # Outcome.RATE_LIMITED (anything != Outcome.ACCEPTED)
    )
    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="Assignment failed in test"),
    )
    def test_status_enable_no_seat_assignment(
        self, _mock_check_assign_seat: mock.MagicMock, _mock_assign_seat: mock.MagicMock
    ) -> None:
        detector = self.create_uptime_detector(enabled=False)
        resp = self.get_error_response(
            self.organization.slug,
            detector.project.slug,
            detector.id,
            name="test_2",
            status="active",
        )

        # The request should have failed with a 400 error
        # Check that we got an error response about seat assignment
        assert "status" in resp.data or "non_field_errors" in resp.data


class ProjectUptimeAlertDetailsDeleteEndpointTest(ProjectUptimeAlertDetailsBaseEndpointTest):
    method = "delete"

    def test_user(self) -> None:
        detector = self.create_uptime_detector()

        with self.tasks():
            self.get_success_response(
                self.organization.slug,
                detector.project.slug,
                detector.id,
                status_code=202,
            )

        with pytest.raises(UptimeSubscription.DoesNotExist):
            get_uptime_subscription(detector)

    def test_not_found(self) -> None:
        resp = self.get_error_response(self.organization.slug, self.project.slug, 3)
        assert resp.status_code == 404
