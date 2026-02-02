from io import BytesIO

from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase, UptimeTestCase
from sentry.uptime.models import UptimeResponseCapture


class ProjectUptimeResponseCaptureEndpointTest(APITestCase, UptimeTestCase):
    endpoint = "sentry-api-0-project-uptime-response-capture"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.uptime_subscription = self.create_uptime_subscription(url="https://example.com")
        self.detector = self.create_uptime_detector(
            uptime_subscription=self.uptime_subscription,
            project=self.project,
        )

    def test_get_response_capture(self):
        response_content = b"Content-Type: text/html\r\nX-Custom: value\r\n\r\n---BODY---\r\n\r\n<html>Error</html>"
        file = File.objects.create(name="test-response", type="uptime.response")
        file.putfile(BytesIO(response_content))

        capture = UptimeResponseCapture.objects.create(
            uptime_subscription=self.uptime_subscription,
            file_id=file.id,
            scheduled_check_time_ms=1234567890,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            capture.id,
        )

        assert response.data["id"] == str(capture.id)
        assert response.data["headers"] == [
            ["Content-Type", "text/html"],
            ["X-Custom", "value"],
        ]
        assert response.data["body"] == "<html>Error</html>"
        assert response.data["bodySize"] == len(b"<html>Error</html>")

    def test_get_response_capture_not_found(self):
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            999999,
            status_code=404,
        )

    def test_get_response_capture_wrong_detector(self):
        """Capture belongs to a different detector's subscription."""
        other_subscription = self.create_uptime_subscription(url="https://other.com")
        other_detector = self.create_uptime_detector(
            uptime_subscription=other_subscription,
            project=self.project,
        )

        file = File.objects.create(name="test-response", type="uptime.response")
        file.putfile(BytesIO(b"test"))

        capture = UptimeResponseCapture.objects.create(
            uptime_subscription=other_subscription,
            file_id=file.id,
            scheduled_check_time_ms=1234567890,
        )

        # Try to access capture using wrong detector
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            capture.id,
            status_code=404,
        )

        # Should work with correct detector
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            other_detector.id,
            capture.id,
        )

    def test_get_response_capture_no_body(self):
        response_content = b"Content-Type: text/html\r\nX-Custom: value"
        file = File.objects.create(name="test-response", type="uptime.response")
        file.putfile(BytesIO(response_content))

        capture = UptimeResponseCapture.objects.create(
            uptime_subscription=self.uptime_subscription,
            file_id=file.id,
            scheduled_check_time_ms=1234567890,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            capture.id,
        )

        assert response.data["headers"] == [
            ["Content-Type", "text/html"],
            ["X-Custom", "value"],
        ]
        assert response.data["body"] == ""
        assert response.data["bodySize"] == 0

    def test_delete_response_capture(self):
        file = File.objects.create(name="test-response", type="uptime.response")
        file.putfile(BytesIO(b"test content"))
        capture = UptimeResponseCapture.objects.create(
            uptime_subscription=self.uptime_subscription,
            file_id=file.id,
            scheduled_check_time_ms=1234567890,
        )
        capture_id = capture.id
        file_id = file.id
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            capture.id,
            method="delete",
            status_code=204,
        )
        assert not UptimeResponseCapture.objects.filter(id=capture_id).exists()
        assert not File.objects.filter(id=file_id).exists()

    def test_delete_response_capture_not_found(self):
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            999999,
            method="delete",
            status_code=404,
        )

    def test_delete_response_capture_wrong_detector(self):
        """Cannot delete capture belonging to a different detector."""
        other_subscription = self.create_uptime_subscription(url="https://other.com")
        file = File.objects.create(name="test-response", type="uptime.response")
        file.putfile(BytesIO(b"test"))
        capture = UptimeResponseCapture.objects.create(
            uptime_subscription=other_subscription,
            file_id=file.id,
            scheduled_check_time_ms=1234567890,
        )
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            capture.id,
            method="delete",
            status_code=404,
        )
        assert UptimeResponseCapture.objects.filter(id=capture.id).exists()
