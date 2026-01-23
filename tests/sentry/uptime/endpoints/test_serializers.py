from sentry.api.serializers import serialize
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.models import get_uptime_subscription


class UptimeDetectorSerializerTest(UptimeTestCase):
    def test(self) -> None:
        detector = self.create_uptime_detector()
        uptime_subscription = get_uptime_subscription(detector)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "projectSlug": self.project.slug,
            "name": detector.name,
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
            "url": uptime_subscription.url,
            "method": uptime_subscription.method,
            "body": uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_subscription.interval_seconds,
            "timeoutMs": uptime_subscription.timeout_ms,
            "owner": None,
            "traceSampling": False,
            "recoveryThreshold": detector.config["recovery_threshold"],
            "downtimeThreshold": detector.config["downtime_threshold"],
            "assertion": None,
        }

    def test_default_name(self) -> None:
        """
        Right now no monitors have names. Once we name everything we can remove this
        """
        detector = self.create_uptime_detector(name="")
        uptime_subscription = get_uptime_subscription(detector)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "projectSlug": self.project.slug,
            "name": f"Uptime Monitoring for {uptime_subscription.url}",
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
            "url": uptime_subscription.url,
            "method": uptime_subscription.method,
            "body": uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_subscription.interval_seconds,
            "timeoutMs": uptime_subscription.timeout_ms,
            "owner": None,
            "traceSampling": False,
            "recoveryThreshold": detector.config["recovery_threshold"],
            "downtimeThreshold": detector.config["downtime_threshold"],
            "assertion": None,
        }

    def test_owner(self) -> None:
        detector = self.create_uptime_detector(owner=self.user)
        uptime_subscription = get_uptime_subscription(detector)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result == {
            "id": str(detector.id),
            "projectSlug": self.project.slug,
            "name": detector.name,
            "environment": detector.config.get("environment"),
            "status": "active",
            "uptimeStatus": 1,  # UptimeStatus.OK from detector state
            "mode": detector.config.get("mode", 1),
            "url": uptime_subscription.url,
            "method": uptime_subscription.method,
            "body": uptime_subscription.body,
            "headers": [],
            "intervalSeconds": uptime_subscription.interval_seconds,
            "timeoutMs": uptime_subscription.timeout_ms,
            "owner": {
                "email": self.user.email,
                "id": str(self.user.id),
                "name": self.user.get_username(),
                "type": "user",
            },
            "traceSampling": False,
            "recoveryThreshold": detector.config["recovery_threshold"],
            "downtimeThreshold": detector.config["downtime_threshold"],
            "assertion": None,
        }

    def test_trace_sampling(self) -> None:
        uptime_subscription = self.create_uptime_subscription(trace_sampling=True)
        detector = self.create_uptime_detector(uptime_subscription=uptime_subscription)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result["traceSampling"] is True

    def test_custom_thresholds(self) -> None:
        """Test that custom threshold values are properly serialized."""
        detector = self.create_uptime_detector(recovery_threshold=2, downtime_threshold=5)
        result = serialize(detector, serializer=UptimeDetectorSerializer())

        assert result["recoveryThreshold"] == 2
        assert result["downtimeThreshold"] == 5

    def test_bulk_detector_id_lookup(self) -> None:
        """Test that detector IDs are properly included when serializing multiple monitors."""
        # Create multiple monitors
        detectors = [
            self.create_uptime_detector(name="Monitor 1"),
            self.create_uptime_detector(name="Monitor 2"),
            self.create_uptime_detector(name="Monitor 3"),
        ]

        # Get the detectors and serialize them
        results = serialize(detectors, serializer=UptimeDetectorSerializer())

        # Verify each has the correct ID
        for i, result in enumerate(results):
            assert result["id"] == str(detectors[i].id)
            assert result["name"] == detectors[i].name
