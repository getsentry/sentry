import time
from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytz
from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import Rule
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.testutils.cases import RuleTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.perfomance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


class FrequencyConditionMixin:
    def _run_test(self, minutes, data, passes, add_events=False, perf=False):
        if not self.environment:
            self.environment = self.create_environment(name="prod")

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=self.environment.id))
        if perf:
            event = self.store_transaction(
                project_id=self.project.id,
                user_id=str(1),
                fingerprint=[f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
            )
        else:
            event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(minutes=minutes)),
                    "user": {"id": uuid4().hex},
                },
                project_id=self.project.id,
            )
        if add_events:
            self.increment(
                event,
                data["value"] + 1,
                environment=self.environment.name,
                timestamp=now() - timedelta(minutes=minutes),
                perf=perf,
            )
            self.increment(
                event,
                data["value"] + 1,
                timestamp=now() - timedelta(minutes=minutes),
                perf=perf,
            )
        group = event.group if event.group is not None else event.groups[0]

        if passes:
            self.assertPasses(rule, event.for_group(group))
            self.assertPasses(environment_rule, event.for_group(group))
        else:
            self.assertDoesNotPass(rule, event.for_group(group))
            self.assertDoesNotPass(environment_rule, event.for_group(group))


class StandardIntervalMixin:
    def test_one_minute_with_events(self):
        data = {"interval": "1m", "value": 6}
        self._run_test(data=data, minutes=1, passes=True, add_events=True)
        self._run_test(data=data, minutes=1, passes=True, add_events=True, perf=True)
        data = {"interval": "1m", "value": 16}
        self._run_test(data=data, minutes=1, passes=False)
        self._run_test(data=data, minutes=1, passes=False, perf=True)

    def test_one_hour_with_events(self):
        data = {"interval": "1h", "value": 6}
        self._run_test(data=data, minutes=60, passes=True, add_events=True)
        # self._run_test(data=data, minutes=60, passes=True, add_events=True, perf=True)
        data = {"interval": "1h", "value": 16}
        self._run_test(data=data, minutes=60, passes=False)
        # self._run_test(data=data, minutes=60, passes=False, perf=True)

    def test_one_day_with_events(self):
        data = {"interval": "1d", "value": 6}
        self._run_test(data=data, minutes=1440, passes=True, add_events=True)
        # self._run_test(data=data, minutes=1440, passes=True, add_events=True, perf=True)
        data = {"interval": "1d", "value": 16}
        self._run_test(data=data, minutes=1440, passes=False)
        # self._run_test(data=data, minutes=1440, passes=False, perf=True)

    def test_one_week_with_events(self):
        data = {"interval": "1w", "value": 6}
        self._run_test(data=data, minutes=10080, passes=True, add_events=True)
        # self._run_test(data=data, minutes=10080, passes=True, add_events=True, perf=True)
        data = {"interval": "1w", "value": 16}
        self._run_test(data=data, minutes=10080, passes=False)
        # self._run_test(data=data, minutes=10080, passes=False, perf=True)

    def test_one_minute_no_events(self):
        data = {"interval": "1m", "value": 6}
        self._run_test(data=data, minutes=1, passes=False)
        # self._run_test(data=data, minutes=1, passes=False, perf=True)

    def test_one_hour_no_events(self):
        data = {"interval": "1h", "value": 6}
        self._run_test(data=data, minutes=60, passes=False)
        # self._run_test(data=data, minutes=60, passes=False, perf=True)

    def test_one_day_no_events(self):
        data = {"interval": "1d", "value": 6}
        self._run_test(data=data, minutes=1440, passes=False)
        # self._run_test(data=data, minutes=1440, passes=False, perf=True)

    def test_one_week_no_events(self):
        data = {"interval": "1w", "value": 6}
        self._run_test(data=data, minutes=10080, passes=False)
        # self._run_test(data=data, minutes=10080, passes=False, perf=True)

    def test_comparison(self):
        # Test data is 4 events in the current period and 2 events in the comparison period, so
        # a 100% increase.
        event = self.store_event(
            data={
                "fingerprint": ["something_random"],
                "timestamp": iso_format(before_now(minutes=1)),
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        self.increment(
            event,
            3,
            timestamp=now() - timedelta(minutes=1),
        )
        self.increment(
            event,
            2,
            timestamp=now() - timedelta(days=1, minutes=20),
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        group = event.group if event.group is not None else event.groups[0]
        self.assertPasses(rule, event.for_group(group))

        data["value"] = 101
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event.for_group(group))

    def test_comparison_txn_events(self):
        # Test data is 4 events in the current period and 2 events in the comparison period, so
        # a 100% increase.
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=uuid4().hex,
            fingerprint=[f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
            timestamp=before_now(minutes=1).replace(tzinfo=pytz.utc),
        )
        self.increment(
            event,
            3,
            timestamp=now() - timedelta(minutes=1),
            perf=True,
            pass_txn_timestamp=True,
        )
        self.increment(
            event,
            2,
            timestamp=now() - timedelta(days=1, minutes=20),
            perf=True,
            pass_txn_timestamp=True,
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        group = event.group if event.group is not None else event.groups[0]
        self.assertPasses(rule, event.for_group(group))

        data["value"] = 101
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event.for_group(group))

    def test_comparison_empty_comparison_period(self):
        # Test data is 1 event in the current period and 0 events in the comparison period. This
        # should always result in 0 and never fire.
        event = self.store_event(
            data={
                "fingerprint": ["something_random"],
                "timestamp": iso_format(before_now(minutes=1)),
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        data = {
            "interval": "1h",
            "value": 0,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)

        data["value"] = 100
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)

    def test_comparison_empty_comparison_period_txn_events(self):
        # Test data is 1 event in the current period and 0 events in the comparison period. This
        # should always result in 0 and never fire.
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=uuid4().hex,
            fingerprint=[f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
            timestamp=before_now(minutes=1).replace(tzinfo=pytz.utc),
        )
        data = {
            "interval": "1h",
            "value": 0,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        group = event.group if event.group is not None else event.groups[0]
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event.for_group(group))

        data["value"] = 100
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event.for_group(group))


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class EventFrequencyConditionTestCase(
    # FrequencyConditionMixin,
    # StandardIntervalMixin,
    RuleTestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
):
    rule_cls = EventFrequencyCondition

    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Should create the event specific to this issue type
        raise NotImplementedError()

    def increment(
        self, event, count, environment=None, timestamp=None, perf=False, pass_txn_timestamp=False
    ):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            self.incr_event(data, self.project.id, timestamp, pass_txn_timestamp)


class ErrorEventFrequencyConditionTestCase(
    EventFrequencyConditionTestCase, FrequencyConditionMixin, StandardIntervalMixin
):
    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Store an error event
        self.store_event(
            data=data,
            project_id=project_id,
        )


class PerformanceEventFrequencyConditionTestCase(
    EventFrequencyConditionTestCase, FrequencyConditionMixin, StandardIntervalMixin
):
    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Store a performance event
        self.store_transaction(
            environment=data.get("environment"),
            project_id=project_id,
            user_id=data.get("user", uuid4().hex),
            fingerprint=data["fingerprint"],
            timestamp=timestamp if pass_txn_timestamp else None,
        )


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class EventUniqueUserFrequencyConditionTestCase(
    # FrequencyConditionMixin,
    # StandardIntervalMixin,
    RuleTestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
):
    rule_cls = EventUniqueUserFrequencyCondition

    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Should create the event specific to this issue type
        raise NotImplementedError()

    def increment(
        self, event, count, environment=None, timestamp=None, perf=False, pass_txn_timestamp=False
    ):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.incr_event(data, self.project.id, timestamp, pass_txn_timestamp)


class ErrorEventUniqueUserFrequencyConditionTestCase(
    EventUniqueUserFrequencyConditionTestCase, FrequencyConditionMixin, StandardIntervalMixin
):
    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Store an error event
        self.store_event(
            data=data,
            project_id=project_id,
        )


# class PerformanceEventUniqueUserFrequencyConditionTestCase(EventUniqueUserFrequencyConditionTestCase, FrequencyConditionMixin, StandardIntervalMixin):
#     def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
#         # Store a performance event
#         self.store_transaction(
#             environment=data.get("environment"),
#             project_id=project_id,
#             user_id=data["user"],
#             fingerprint=data["fingerprint"],
#             timestamp=timestamp if pass_txn_timestamp else None,
#         )


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class EventFrequencyPercentConditionTestCase(
    RuleTestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
):
    rule_cls = EventFrequencyPercentCondition

    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Should create the event specific to this issue type
        raise NotImplementedError()

    def _make_sessions(self, num):
        received = time.time()

        def make_session(i):
            return dict(
                distinct_id=uuid4().hex,
                session_id=uuid4().hex,
                org_id=self.project.organization_id,
                project_id=self.project.id,
                status="ok",
                seq=0,
                release="foo@1.0.0",
                environment="prod",
                retention_days=90,
                duration=None,
                errors=0,
                # The line below is crucial to spread sessions throughout the time period.
                started=received - i,
                received=received,
            )

        self.bulk_store_sessions([make_session(i) for i in range(num)])

    def _run_test(self, minutes, data, passes, add_events=False, perf=False):
        if not self.environment or self.environment.name != "prod":
            self.environment = self.create_environment(name="prod")
        if not hasattr(self, "test_event"):
            self.test_event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(minutes=minutes)),
                    "user": {"id": uuid4().hex},
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
            )
        if perf:
            self.store_transaction(
                environment=self.environment.name,
                project_id=self.project.id,
                user_id=str(1),
                fingerprint=[f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
            )
        if add_events:
            self.increment(
                self.test_event,
                max(1, int(minutes / 2)) - 1,
                environment=self.environment.name,
                timestamp=now() - timedelta(minutes=minutes),
            )
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=self.environment.id))
        if passes:
            self.assertPasses(rule, self.test_event)
            self.assertPasses(environment_rule, self.test_event)
        else:
            self.assertDoesNotPass(rule, self.test_event)
            self.assertDoesNotPass(environment_rule, self.test_event)

    def increment(
        self, event, count, environment=None, timestamp=None, perf=False, pass_txn_timestamp=False
    ):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.incr_event(data, self.project.id, timestamp, pass_txn_timestamp)


class ErrorEventUniqueUserFrequencyConditionTestCase(EventFrequencyPercentConditionTestCase):
    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Store an error event
        self.store_event(
            data=data,
            project_id=project_id,
        )

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_five_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)
        # self._run_test(data=data, minutes=5, passes=True, add_events=True, perf=True)
        data = {"interval": "5m", "value": 41}
        self._run_test(data=data, minutes=5, passes=False)
        # self._run_test(data=data, minutes=5, passes=False, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)
        # self._run_test(data=data, minutes=10, passes=True, add_events=True, perf=True)
        data = {"interval": "10m", "value": 51}
        self._run_test(data=data, minutes=10, passes=False)
        # self._run_test(data=data, minutes=10, passes=False, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)
        # self._run_test(data=data, minutes=30, passes=True, add_events=True, perf=True)
        data = {"interval": "30m", "value": 51}
        self._run_test(data=data, minutes=30, passes=False)
        # self._run_test(data=data, minutes=30, passes=False, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_with_events(self):
        self._make_sessions(60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, add_events=True, passes=True)
        # self._run_test(data=data, minutes=60, add_events=True, passes=True, perf=True)
        data = {"interval": "1h", "value": 51}
        self._run_test(data=data, minutes=60, passes=False)
        # self._run_test(data=data, minutes=60, passes=False, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_five_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)
        # self._run_test(data=data, minutes=5, passes=True, add_events=True, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)
        # self._run_test(data=data, minutes=10, passes=True, add_events=True, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)
        # self._run_test(data=data, minutes=30, passes=True, add_events=True, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_no_events(self):
        self._make_sessions(60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, passes=False)
        # self._run_test(data=data, minutes=60, passes=False, perf=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_comparison(self):
        self._make_sessions(10)
        # Create sessions for previous period
        self._make_sessions(10)

        # Test data is 2 events in the current period and 1 events in the comparison period.
        # Number of sessions is 20 in each period, so current period is 20% of sessions, prev
        # is 10%. Overall a 100% increase comparitively.
        event = self.store_event(
            data={
                "fingerprint": ["something_random"],
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        self.increment(
            event,
            1,
            timestamp=now() - timedelta(minutes=1),
        )
        self.increment(
            event,
            1,
            timestamp=now() - timedelta(days=1, minutes=20),
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertPasses(rule, event)

        data["value"] = 101
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)


class PerformanceEventUniqueUserFrequencyConditionTestCase(EventFrequencyPercentConditionTestCase):
    def incr_event(self, data, project_id, timestamp, pass_txn_timestamp):
        # Store a performance event
        self.store_transaction(
            environment=data.get("environment"),
            project_id=project_id,
            user_id=uuid4().hex,
            fingerprint=data["fingerprint"],
            timestamp=timestamp if pass_txn_timestamp else None,
        )

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_comparison_txn_events(self):
        self._make_sessions(10)
        # Create sessions for previous period
        self._make_sessions(10)

        # Test data is 2 events in the current period and 1 events in the comparison period.
        # Number of sessions is 20 in each period, so current period is 20% of sessions, prev
        # is 10%. Overall a 100% increase comparitively.
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=uuid4().hex,
            fingerprint=[f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
            timestamp=before_now(minutes=1).replace(tzinfo=pytz.utc),
        )
        self.increment(
            event,
            1,
            timestamp=now() - timedelta(minutes=1),
            perf=True,
            pass_txn_timestamp=True,
        )
        self.increment(
            event,
            1,
            timestamp=now() - timedelta(days=1, minutes=20),
            perf=True,
            pass_txn_timestamp=True,
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        group = event.group if event.group is not None else event.groups[0]
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertPasses(rule, event.for_group(group))

        data["value"] = 101
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event.for_group(group))
