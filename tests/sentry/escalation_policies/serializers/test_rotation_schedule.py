from datetime import UTC, datetime

from sentry.api.serializers import serialize
from sentry.escalation_policies.endpoints.serializers.rotation_schedule import (
    RotationScheduleSerializer,
)
from sentry.escalation_policies.models.rotation_schedule import (
    RotationSchedule,
    RotationScheduleLayerRotationType,
)
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
            rotation_type=RotationScheduleLayerRotationType.DAILY,
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
            rotation_type=RotationScheduleLayerRotationType.DAILY,
            restrictions={
                "Mon": [["12:00", "24:00"]],
                "Tue": [["12:00", "24:00"]],
                "Wed": [["12:00", "24:00"]],
                "Thu": [["12:00", "24:00"]],
                "Fri": [["12:00", "24:00"]],
            },
        )

        serializer = RotationScheduleSerializer(
            start_date=datetime(2024, 1, 1, tzinfo=UTC),
            end_date=datetime(2024, 1, 5, tzinfo=UTC),
        )
        result = serialize(schedule, serializer=serializer)

        assert result["id"] == schedule.id
        assert result["name"] == str(schedule.name)
        assert len(result["scheduleLayers"]) == 2
        assert result["team"] is None
        assert result["user"] is None

        assert result["scheduleLayers"][0]["rotationType"] == "daily"
        assert result["scheduleLayers"][0]["handoffTime"] == "00:00"
        assert result["scheduleLayers"][0]["startTime"] == datetime(2024, 1, 1).date()
        assert result["scheduleLayers"][0]["scheduleLayerRestrictions"]["Mon"] == [
            ["00:00", "12:00"]
        ]
        assert result["scheduleLayers"][0]["users"][0].id == userA.id
        assert result["scheduleLayers"][0]["users"][1].id == userB.id
        assert len(result["scheduleLayers"][0]["rotationPeriods"]) > 0
        assert result["scheduleLayers"][1]["rotationType"] == "daily"
        assert result["scheduleLayers"][1]["handoffTime"] == "00:00"
        assert result["scheduleLayers"][1]["startTime"] == datetime(2024, 1, 1).date()
        assert result["scheduleLayers"][1]["scheduleLayerRestrictions"]["Mon"] == [
            ["12:00", "24:00"]
        ]
        assert result["scheduleLayers"][1]["users"][0].id == userC.id
        assert result["scheduleLayers"][1]["users"][1].id == userD.id
        assert len(result["scheduleLayers"][1]["rotationPeriods"]) > 0
        assert result["coalescedRotationPeriods"] == [
            {
                "startTime": datetime(2024, 1, 1, 0, 0, tzinfo=UTC),
                "endTime": datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
                "userId": userA.id,
            },
            {
                "endTime": datetime(2024, 1, 2, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
                "userId": userC.id,
            },
            {
                "endTime": datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 2, 0, 0, tzinfo=UTC),
                "userId": userB.id,
            },
            {
                "endTime": datetime(2024, 1, 3, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
                "userId": userD.id,
            },
            {
                "endTime": datetime(2024, 1, 3, 12, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 3, 0, 0, tzinfo=UTC),
                "userId": userA.id,
            },
            {
                "endTime": datetime(2024, 1, 4, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 3, 12, 0, tzinfo=UTC),
                "userId": userC.id,
            },
            {
                "endTime": datetime(2024, 1, 4, 12, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 4, 0, 0, tzinfo=UTC),
                "userId": userB.id,
            },
            {
                "endTime": datetime(2024, 1, 5, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 4, 12, 0, tzinfo=UTC),
                "userId": userD.id,
            },
            {
                "endTime": datetime(2024, 1, 5, 12, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 5, 0, 0, tzinfo=UTC),
                "userId": userA.id,
            },
            {
                "endTime": datetime(2024, 1, 6, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 5, 12, 0, tzinfo=UTC),
                "userId": userC.id,
            },
            {
                "endTime": datetime(2024, 1, 7, 0, 0, tzinfo=UTC),
                "startTime": datetime(2024, 1, 6, 0, 0, tzinfo=UTC),
                "userId": userB.id,
            },
        ]
