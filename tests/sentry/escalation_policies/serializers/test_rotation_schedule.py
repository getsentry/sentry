from datetime import datetime
from datetime import timezone as tz

from sentry.api.serializers import serialize
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule
from sentry.testutils.cases import TestCase


class EscalationPolicySerializerTest(TestCase):
    def test_simple(self):
        schedule = RotationSchedule.objects.create(
            name="schedule A",
            organization=self.organization,
        )
        userA = self.create_user()
        userB = self.create_user()
        userC = self.create_user()
        userD = self.create_user()
        self.create_rotation_schedule_layer(
            schedule,
            [userA.id, userB.id],
            1,
            restrictions={
                "Mon": [["00:00", "12:00"]],
                "Tue": [["00:00", "12:00"]],
                "Wed": [["00:00", "12:00"]],
                "Thu": [["00:00", "12:00"]],
                "Fri": [["00:00", "12:00"]],
            },
        )
        self.create_rotation_schedule_layer(
            schedule,
            [userC.id, userD.id],
            2,
            restrictions={
                "Mon": [["12:00", "24:00"]],
                "Tue": [["12:00", "24:00"]],
                "Wed": [["12:00", "24:00"]],
                "Thu": [["12:00", "24:00"]],
                "Fri": [["12:00", "24:00"]],
            },
        )

        result = serialize(schedule)

        assert result["id"] == str(schedule.id)
        assert result["name"] == str(schedule.name)
        assert len(result["layers"]) == 2
        assert result["team"] is None
        assert result["user"] is None

        assert result["layers"][0]["rotation_type"] == "weekly"
        assert result["layers"][0]["handoff_time"] == "0 16 * * 1"
        assert result["layers"][0]["start_time"] == datetime(2020, 1, 1).replace(tzinfo=tz.utc)
        assert result["layers"][0]["schedule_layer_restrictions"]["Mon"] == [["00:00", "12:00"]]
        assert result["layers"][0]["users"][0].id == userA.id
        assert result["layers"][0]["users"][1].id == userB.id
        assert result["layers"][1]["rotation_type"] == "weekly"
        assert result["layers"][1]["handoff_time"] == "0 16 * * 1"
        assert result["layers"][1]["start_time"] == datetime(2020, 1, 1).replace(tzinfo=tz.utc)
        assert result["layers"][1]["schedule_layer_restrictions"]["Mon"] == [["12:00", "24:00"]]
        assert result["layers"][1]["users"][0].id == userC.id
        assert result["layers"][1]["users"][1].id == userD.id
