from sentry.api.serializers import serialize
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.models import get_detector


class UptimeDetectorSerializerTest(UptimeTestCase):
    def test(self) -> None:
        uptime_monitor = self.create_project_uptime_subscription()
        detector = get_detector(uptime_monitor.uptime_subscription)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": detector.name,
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
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
        detector = get_detector(uptime_monitor.uptime_subscription)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": f"Uptime Monitoring for {uptime_monitor.uptime_subscription.url}",
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
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
        detector = get_detector(uptime_monitor.uptime_subscription)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "detectorId": detector.id,
            "projectSlug": self.project.slug,
            "name": detector.name,
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
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
        detector = get_detector(uptime_monitor.uptime_subscription)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result["traceSampling"] is True

    def test_bulk_detector_id_lookup(self) -> None:
        """Test that detector IDs are properly included when serializing multiple monitors."""
        # Create multiple monitors
        monitors = [
            self.create_project_uptime_subscription(name="Monitor 1"),
            self.create_project_uptime_subscription(name="Monitor 2"),
            self.create_project_uptime_subscription(name="Monitor 3"),
        ]

        # Get the detectors and serialize them
        detectors = [get_detector(monitor.uptime_subscription) for monitor in monitors]
        results = serialize(detectors, serializer=UptimeDetectorSerializer())

        # Verify each has a detector ID
        for i, result in enumerate(results):
            assert result["detectorId"] == detectors[i].id
            assert result["name"] == detectors[i].name
