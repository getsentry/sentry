from datetime import date, datetime, timedelta
from typing import TypedDict

from sentry.escalation_policies.logic import (
    RotationPeriod,
    apply_layer_restrictions,
    coalesce_rotation_period,
    coalesce_schedule_layers,
    invert_daily_layer_restrictions,
)
from sentry.escalation_policies.models.rotation_schedule import (
    DEFAULT_ROTATION_START_TIME,
    RotationSchedule,
    RotationScheduleLayerRotationType,
    ScheduleLayerRestriction,
)
from sentry.testutils.cases import TestCase

time_format = "%Y-%m-%d %H:%M"


class RotationScheduleLogicTest(TestCase):
    def test_coalesce_rotation_period(self):
        class TestData(TypedDict):
            schedule: list[RotationPeriod]
            period: RotationPeriod
            expected_results: list[RotationPeriod]

        tests: list[TestData] = [
            {
                "schedule": [
                    {
                        "start_time": datetime(2024, 1, 1, 0, 0),
                        "end_time": datetime(2024, 1, 1, 12, 0),
                        "user_id": 2,
                    }
                ],
                "period": {
                    "start_time": datetime(2024, 1, 2, 0, 0),
                    "end_time": datetime(2024, 1, 2, 12, 0),
                    "user_id": 3,
                },
                "expected_results": [
                    {
                        "start_time": datetime(2024, 1, 1, 0, 0),
                        "end_time": datetime(2024, 1, 1, 12, 0),
                        "user_id": 2,
                    },
                    {
                        "start_time": datetime(2024, 1, 2, 0, 0),
                        "end_time": datetime(2024, 1, 2, 12, 0),
                        "user_id": 3,
                    },
                ],
            },
        ]
        for test in tests:
            result = coalesce_rotation_period(
                test["schedule"],
                test["period"],
            )
            self.assertEqual(result, test["expected_results"])

    def test_invert_daily_layer_restrictions(self):
        class TestData(TypedDict):
            date: date
            layer_restriction: ScheduleLayerRestriction
            expected_results: list[RotationPeriod]

        tests: list[TestData] = [
            # Start section
            {
                "date": date(2024, 1, 1),  # Mon
                "layer_restriction": {
                    "Mon": [("00:00", "12:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime(2024, 1, 1, 12, 0, 0),
                        end_time=datetime(2024, 1, 2, 0, 0, 0),
                        user_id=None,
                    ),
                ],
            },
            # Middle section
            {
                "date": date(2024, 1, 1),  # Mon
                "layer_restriction": {
                    "Mon": [("08:00", "17:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime(2024, 1, 1, 0, 0, 0),
                        end_time=datetime(2024, 1, 1, 8, 0, 0),
                        user_id=None,
                    ),
                    RotationPeriod(
                        start_time=datetime(2024, 1, 1, 17, 0, 0),
                        end_time=datetime(2024, 1, 2, 0, 0, 0),
                        user_id=None,
                    ),
                ],
            },
            # End section
            {
                "date": date(2024, 1, 1),  # Mon
                "layer_restriction": {
                    "Mon": [("12:00", "24:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime(2024, 1, 1, 0, 0, 0),
                        end_time=datetime(2024, 1, 1, 12, 0, 0),
                        user_id=None,
                    ),
                ],
            },
        ]

        for i, test in enumerate(tests):
            result = invert_daily_layer_restrictions(test["date"], test["layer_restriction"])
            assert result == test["expected_results"], "Test %d failed" % i

    def test_apply_layer_restrictions(self):
        class TestData(TypedDict):
            period: RotationPeriod
            layer_restrictions: ScheduleLayerRestriction
            expected_results: list[RotationPeriod]

        tests: list[TestData] = [
            # Simple
            {
                "period": {
                    "start_time": datetime.strptime("2024-01-01 01:00", time_format),  # Monday
                    "end_time": datetime.strptime("2024-01-02 00:00", time_format),
                    "user_id": 1,
                },
                "layer_restrictions": {
                    "Mon": [("00:00", "12:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-01 01:00", time_format),
                        end_time=datetime.strptime("2024-01-01 12:00", time_format),
                        user_id=1,
                    ),
                ],
            },
            # Simple split
            {
                "period": {
                    "start_time": datetime.strptime("2024-01-01 00:00", time_format),  # Monday
                    "end_time": datetime.strptime("2024-01-02 00:00", time_format),
                    "user_id": 1,
                },
                "layer_restrictions": {
                    "Mon": [("08:00", "17:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-01 08:00", time_format),
                        end_time=datetime.strptime("2024-01-01 17:00", time_format),
                        user_id=1,
                    ),
                ],
            },
            # week-day business hours
            {
                "period": {
                    "start_time": datetime.strptime("2024-01-01 00:00", time_format),  # Monday
                    "end_time": datetime.strptime("2024-01-08 00:00", time_format),
                    "user_id": 1,
                },
                "layer_restrictions": {
                    "Mon": [("08:00", "17:00")],
                    "Tue": [("08:00", "17:00")],
                    "Wed": [("08:00", "17:00")],
                    "Thu": [("08:00", "17:00")],
                    "Fri": [("08:00", "17:00")],
                },
                "expected_results": [
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-01 08:00", time_format),
                        end_time=datetime.strptime("2024-01-01 17:00", time_format),
                        user_id=1,
                    ),
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-02 08:00", time_format),
                        end_time=datetime.strptime("2024-01-02 17:00", time_format),
                        user_id=1,
                    ),
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-03 08:00", time_format),
                        end_time=datetime.strptime("2024-01-03 17:00", time_format),
                        user_id=1,
                    ),
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-04 08:00", time_format),
                        end_time=datetime.strptime("2024-01-04 17:00", time_format),
                        user_id=1,
                    ),
                    RotationPeriod(
                        start_time=datetime.strptime("2024-01-05 08:00", time_format),
                        end_time=datetime.strptime("2024-01-05 17:00", time_format),
                        user_id=1,
                    ),
                ],
            },
        ]

        for i, test in enumerate(tests):
            result = apply_layer_restrictions(
                test["period"],
                test["layer_restrictions"],
            )
            assert result == test["expected_results"], "Test %d failed" % i

    def test_coalesce_schedule_layers_basic(self):
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
            },
        )
        periods = coalesce_schedule_layers(
            schedule.layers.all(),
            DEFAULT_ROTATION_START_TIME - timedelta(days=1),
            DEFAULT_ROTATION_START_TIME + timedelta(days=3),
        )
        assert periods == [
            # Mon
            RotationPeriod(
                start_time=datetime.strptime("2024-01-01 00:00", time_format),
                end_time=datetime.strptime("2024-01-01 12:00", time_format),
                user_id=userA.id,
            ),
            RotationPeriod(
                start_time=datetime.strptime("2024-01-01 12:00", time_format),
                end_time=datetime.strptime("2024-01-02 00:00", time_format),
                user_id=userC.id,
            ),
            # Tue
            RotationPeriod(
                start_time=datetime.strptime("2024-01-02 00:00", time_format),
                end_time=datetime.strptime("2024-01-02 12:00", time_format),
                user_id=userB.id,
            ),
            RotationPeriod(
                start_time=datetime.strptime("2024-01-02 12:00", time_format),
                end_time=datetime.strptime("2024-01-03 00:00", time_format),
                user_id=userD.id,
            ),
            # Wed - schedule 2 no restrictions
            RotationPeriod(
                start_time=datetime.strptime("2024-01-03 00:00", time_format),
                end_time=datetime.strptime("2024-01-04 00:00", time_format),
                user_id=userC.id,
            ),
            # Thursday - schedule 2 no restrictions
            RotationPeriod(
                start_time=datetime.strptime("2024-01-04 00:00", time_format),
                end_time=datetime.strptime("2024-01-05 00:00", time_format),
                user_id=userD.id,
            ),
        ]
