from sentry.api.serializers import serialize
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.models import get_detector


class ProjectUptimeSubscriptionSerializerTest(UptimeTestCase):
    def test(self) -> None:
        uptime_monitor = self.create_project_uptime_subscription()
        result = serialize(uptime_monitor)

        detector = get_detector(uptime_monitor.uptime_subscription)

        assert result == {
            "id": str(uptime_monitor.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": uptime_monitor.name,
            "environment": uptime_monitor.environment.name if uptime_monitor.environment else None,
            "status": uptime_monitor.get_status_display(),
            "uptimeStatus": uptime_monitor.uptime_subscription.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "method": uptime_monitor.uptime_subscription.method,
            "body": uptime_monitor.uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": None,
            "traceSampling": False,
        }

    def test_default_name(self) -> None:
        """
        Right now no monitors have names. Once we name everything we can remove this
        """
        uptime_monitor = self.create_project_uptime_subscription(name="")
        result = serialize(uptime_monitor)

        detector = get_detector(uptime_monitor.uptime_subscription)

        assert result == {
            "id": str(uptime_monitor.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": f"Uptime Monitoring for {uptime_monitor.uptime_subscription.url}",
            "environment": uptime_monitor.environment.name if uptime_monitor.environment else None,
            "status": uptime_monitor.get_status_display(),
            "uptimeStatus": uptime_monitor.uptime_subscription.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "method": uptime_monitor.uptime_subscription.method,
            "body": uptime_monitor.uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": None,
            "traceSampling": False,
        }

    def test_owner(self) -> None:
        uptime_monitor = self.create_project_uptime_subscription(owner=self.user)
        result = serialize(uptime_monitor)

        detector = get_detector(uptime_monitor.uptime_subscription)

        assert result == {
            "id": str(uptime_monitor.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": uptime_monitor.name,
            "environment": uptime_monitor.environment.name if uptime_monitor.environment else None,
            "status": uptime_monitor.get_status_display(),
            "uptimeStatus": uptime_monitor.uptime_subscription.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "method": uptime_monitor.uptime_subscription.method,
            "body": uptime_monitor.uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": {
                "email": self.user.email,
                "id": str(self.user.id),
                "name": self.user.get_username(),
                "type": "user",
            },
            "traceSampling": False,
        }

    def test_trace_sampling(self) -> None:
        subscription = self.create_uptime_subscription(trace_sampling=True)
        uptime_monitor = self.create_project_uptime_subscription(uptime_subscription=subscription)
        result = serialize(uptime_monitor)

        assert result["traceSampling"] is True

    def test_bulk_detector_id_lookup(self) -> None:
        """Test that detector IDs are properly included when serializing multiple monitors."""
        # Create multiple monitors
        monitors = [
            self.create_project_uptime_subscription(name="Monitor 1"),
            self.create_project_uptime_subscription(name="Monitor 2"),
            self.create_project_uptime_subscription(name="Monitor 3"),
        ]

        # Serialize all at once (this should trigger bulk lookup)
        results = serialize(monitors)

        # Verify each has a detector ID
        for i, result in enumerate(results):
            detector = get_detector(monitors[i].uptime_subscription)
            assert result["detectorId"] == detector.id
            assert result["id"] == str(monitors[i].id)
            assert result["name"] == f"Monitor {i + 1}"
