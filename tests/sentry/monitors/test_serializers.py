from sentry.api.serializers import serialize
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment
from sentry.monitors.serializers import MonitorCheckInSerializer, MonitorEnvironmentSerializer
from sentry.testutils.cases import TestCase


class MonitorEnvironmentSerializerTest(TestCase):
    def test_serialize_with_deleted_environment(self):
        """
        Test that MonitorEnvironmentSerializer handles missing environments gracefully.
        This can happen when an environment is deleted but MonitorEnvironment records still reference it.

        Regression test for https://sentry.sentry.io/issues/SENTRY-5CTA/
        """
        monitor = self.create_monitor()
        # Create a monitor environment with a non-existent environment_id
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=999999,  # Non-existent environment ID
        )

        # This should not raise a KeyError
        result = serialize([monitor_env], self.user, MonitorEnvironmentSerializer())

        assert len(result) == 1
        # When environment is missing, the serialization should still work
        # The name will be "[removed]" since the environment doesn't exist
        assert result[0]["name"] == "[removed]"


class MonitorCheckInSerializerTest(TestCase):
    def test_serialize_with_deleted_environment(self):
        """
        Test that MonitorCheckInSerializer handles missing environments gracefully.
        This can happen when an environment is deleted but check-ins still reference it.

        Regression test for https://sentry.sentry.io/issues/SENTRY-5CTA/
        """
        monitor = self.create_monitor()
        # Create a monitor environment with a non-existent environment_id
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=999999,  # Non-existent environment ID
        )

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=monitor.project_id,
            status=CheckInStatus.OK,
        )

        # This should not raise a KeyError
        result = serialize([checkin], self.user, MonitorCheckInSerializer())

        assert len(result) == 1
        # When environment is missing, environment should be "[removed]"
        assert result[0]["environment"] == "[removed]"
