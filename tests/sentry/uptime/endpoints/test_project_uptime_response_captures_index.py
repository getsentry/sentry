from io import BytesIO

from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase, UptimeTestCase
from sentry.uptime.models import UptimeResponseCapture


class ProjectUptimeResponseCapturesIndexEndpointTest(APITestCase, UptimeTestCase):
    endpoint = "sentry-api-0-project-uptime-response-captures-index"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.uptime_subscription = self.create_uptime_subscription(url="https://example.com")
        self.detector = self.create_uptime_detector(
            uptime_subscription=self.uptime_subscription,
            project=self.project,
        )

    def test_delete_all_response_captures(self):
        files = [
            File.objects.create(name=f"test-response-{i}", type="uptime.response") for i in range(3)
        ]
        for i, file in enumerate(files):
            file.putfile(BytesIO(f"test content {i}".encode()))

        captures = UptimeResponseCapture.objects.bulk_create(
            [
                UptimeResponseCapture(
                    uptime_subscription=self.uptime_subscription,
                    file_id=file.id,
                    scheduled_check_time_ms=1234567890 + i,
                )
                for i, file in enumerate(files)
            ]
        )

        file_ids = [f.id for f in files]
        capture_ids = [c.id for c in captures]

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            method="delete",
            status_code=200,
        )

        assert response.data["deletedCount"] == 3
        assert UptimeResponseCapture.objects.filter(id__in=capture_ids).count() == 0
        assert File.objects.filter(id__in=file_ids).count() == 0

    def test_delete_all_response_captures_empty(self):
        """Deleting when there are no captures should succeed."""
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            method="delete",
            status_code=200,
        )
        assert response.data["deletedCount"] == 0

    def test_delete_only_affects_own_subscription(self):
        """Deleting captures should not affect other subscriptions."""
        file1 = File.objects.create(name="test-response-1", type="uptime.response")
        file1.putfile(BytesIO(b"test content 1"))
        capture1 = UptimeResponseCapture.objects.create(
            uptime_subscription=self.uptime_subscription,
            file_id=file1.id,
            scheduled_check_time_ms=1234567890,
        )
        other_subscription = self.create_uptime_subscription(url="https://other.com")
        file2 = File.objects.create(name="test-response-2", type="uptime.response")
        file2.putfile(BytesIO(b"test content 2"))
        capture2 = UptimeResponseCapture.objects.create(
            uptime_subscription=other_subscription,
            file_id=file2.id,
            scheduled_check_time_ms=1234567890,
        )
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.detector.id,
            method="delete",
            status_code=200,
        )
        assert response.data["deletedCount"] == 1
        assert not UptimeResponseCapture.objects.filter(id=capture1.id).exists()
        assert not File.objects.filter(id=file1.id).exists()
        assert UptimeResponseCapture.objects.filter(id=capture2.id).exists()
        assert File.objects.filter(id=file2.id).exists()
