from sentry.api.serializers import serialize
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment
from sentry.monitors.serializers import (
    MonitorCheckInSerializer,
    MonitorEnvironmentSerializer,
    MonitorSerializer,
)
from sentry.testutils.cases import TestCase


class MonitorEnvironmentSerializerTest(TestCase):
    def test_serialize_with_deleted_environment(self) -> None:
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


class MonitorSerializerOwnerTest(TestCase):
    def test_serialize_with_user_owner(self) -> None:
        monitor = self.create_monitor(owner_user_id=self.user.id)

        result = serialize(monitor, self.user, MonitorSerializer())

        assert result["owner"] == {
            "type": "user",
            "id": str(self.user.id),
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

    def test_serialize_with_team_owner(self) -> None:
        team = self.create_team(organization=self.organization)
        monitor = self.create_monitor(owner_user_id=None, owner_team_id=team.id)

        result = serialize(monitor, self.user, MonitorSerializer())

        assert result["owner"] == {
            "type": "team",
            "id": str(team.id),
            "name": team.slug,
        }

    def test_serialize_with_no_owner(self) -> None:
        monitor = self.create_monitor(owner_user_id=None, owner_team_id=None)

        result = serialize(monitor, self.user, MonitorSerializer())

        assert result["owner"] is None

    def test_serialize_with_unresolved_owner(self) -> None:
        """
        Tests a case where an invalid user ID is provided. While contrived
        in this test, it can happen if a user is deleted in control, but
        awaiting tombstone cleanup in cell.
        """
        monitor = self.create_monitor(owner_user_id=123456789)

        result = serialize(monitor, self.user, MonitorSerializer())

        assert result["owner"] is None

    def test_serialize_mixed_resolved_and_unresolved_owners(self) -> None:
        """
        Regression test for a case where a monitor has an unresolvable actor,
        which can cause misalignment in serialized actor data.
        """
        team = self.create_team(organization=self.organization)
        user_owned = self.create_monitor(owner_user_id=self.user.id)
        unresolved_owned = self.create_monitor(owner_user_id=123456789)
        team_owned = self.create_monitor(owner_user_id=None, owner_team_id=team.id)

        result = serialize(
            [user_owned, unresolved_owned, team_owned], self.user, MonitorSerializer()
        )

        by_slug = {item["slug"]: item for item in result}
        assert by_slug[user_owned.slug]["owner"] == {
            "type": "user",
            "id": str(self.user.id),
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }
        assert by_slug[team_owned.slug]["owner"] == {
            "type": "team",
            "id": str(team.id),
            "name": team.slug,
        }
        assert by_slug[unresolved_owned.slug]["owner"] is None


class MonitorCheckInSerializerTest(TestCase):
    def test_serialize_with_deleted_environment(self) -> None:
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
