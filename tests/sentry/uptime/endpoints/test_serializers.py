from sentry.api.serializers import serialize
from sentry.testutils.cases import UptimeTestCase


class ProjectUptimeSubscriptionSerializerTest(UptimeTestCase):
    def test(self):
        uptime_monitor = self.create_project_uptime_subscription()
        result = serialize(uptime_monitor)

        assert result == {
            "id": str(uptime_monitor.id),
            "projectSlug": self.project.slug,
            "name": uptime_monitor.name,
            "status": uptime_monitor.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": None,
        }

    def test_default_name(self):
        """
        Right now no monitors have names. Once we name everything we can remove this
        """
        uptime_monitor = self.create_project_uptime_subscription(name="")
        result = serialize(uptime_monitor)

        assert result == {
            "id": str(uptime_monitor.id),
            "projectSlug": self.project.slug,
            "name": f"Uptime Monitoring for {uptime_monitor.uptime_subscription.url}",
            "status": uptime_monitor.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": None,
        }

    def test_owner(self):
        uptime_monitor = self.create_project_uptime_subscription(owner=self.user)
        result = serialize(uptime_monitor)

        assert result == {
            "id": str(uptime_monitor.id),
            "projectSlug": self.project.slug,
            "name": uptime_monitor.name,
            "status": uptime_monitor.uptime_status,
            "mode": uptime_monitor.mode,
            "url": uptime_monitor.uptime_subscription.url,
            "intervalSeconds": uptime_monitor.uptime_subscription.interval_seconds,
            "timeoutMs": uptime_monitor.uptime_subscription.timeout_ms,
            "owner": {
                "email": self.user.email,
                "id": str(self.user.id),
                "name": self.user.get_username(),
                "type": "user",
            },
        }
