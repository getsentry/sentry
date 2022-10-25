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
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


class FrequencyConditionMixin:
    def increment(self, event, count, environment=None, timestamp=None):
        raise NotImplementedError

    def _run_test(self, minutes, data, passes, add_events=False):
        if not self.environment:
            self.environment = self.create_environment(name="prod")

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=self.environment.id))

        event = self.add_event(
            data={
                "fingerprint": ["something_random"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
            timestamp=before_now(minutes=minutes),
        )
        if add_events:
            self.increment(
                event,
                data["value"] + 1,
                environment=self.environment.name,
                timestamp=now() - timedelta(minutes=minutes),
            )
            self.increment(
                event,
                data["value"] + 1,
                timestamp=now() - timedelta(minutes=minutes),
            )

        if passes:
            self.assertPasses(rule, event)
            self.assertPasses(environment_rule, event)
        else:
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)


class ErrorEventMixin:
    def add_event(self, data, project_id, timestamp):
        data["timestamp"] = iso_format(timestamp)
        # Store an error event
        event = self.store_event(
            data=data,
            project_id=project_id,
        )
        return event.for_group(event.group)


class PerfEventMixin(PerfIssueTransactionTestMixin):
    def add_event(self, data, project_id, timestamp):
        fingerprint = data["fingerprint"][0]
        fingerprint = (
            fingerprint
            if "-" in fingerprint
            else f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-{data['fingerprint'][0]}"
        )
        # Store a performance event
        event = self.store_transaction(
            environment=data.get("environment"),
            project_id=project_id,
            user_id=data.get("user", uuid4().hex),
            fingerprint=[fingerprint],
            timestamp=timestamp.replace(tzinfo=pytz.utc),
        )
        return event.for_group(event.groups[0])


class StandardIntervalMixin:
    def test_one_minute_with_events(self):
        data = {"interval": "1m", "value": 6}
        self._run_test(data=data, minutes=1, passes=True, add_events=True)
        data = {"interval": "1m", "value": 16}
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_with_events(self):
        data = {"interval": "1h", "value": 6}
        self._run_test(data=data, minutes=60, passes=True, add_events=True)
        data = {"interval": "1h", "value": 16}
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_with_events(self):
        data = {"interval": "1d", "value": 6}
        self._run_test(data=data, minutes=1440, passes=True, add_events=True)
        data = {"interval": "1d", "value": 16}
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_with_events(self):
        data = {"interval": "1w", "value": 6}
        self._run_test(data=data, minutes=10080, passes=True, add_events=True)
        data = {"interval": "1w", "value": 16}
        self._run_test(data=data, minutes=10080, passes=False)

    def test_one_minute_no_events(self):
        data = {"interval": "1m", "value": 6}
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_no_events(self):
        data = {"interval": "1h", "value": 6}
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_no_events(self):
        data = {"interval": "1d", "value": 6}
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_no_events(self):
        data = {"interval": "1w", "value": 6}
        self._run_test(data=data, minutes=10080, passes=False)

    def test_comparison(self):
        # Test data is 4 events in the current period and 2 events in the comparison period, so
        # a 100% increase.
        event = self.add_event(
            data={
                "fingerprint": ["something_random"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
            timestamp=before_now(minutes=1),
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
        self.assertPasses(rule, event)

        data = {
            "interval": "1h",
            "value": 101,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)

    def test_comparison_empty_comparison_period(self):
        # Test data is 1 event in the current period and 0 events in the comparison period. This
        # should always result in 0 and never fire.
        event = self.add_event(
            data={
                "fingerprint": ["something_random"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
            timestamp=before_now(minutes=1),
        )
        data = {
            "interval": "1h",
            "value": 0,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)

        data = {
            "interval": "1h",
            "value": 100,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)


class EventFrequencyConditionTestCase(
    FrequencyConditionMixin, StandardIntervalMixin, SnubaTestCase
):
    rule_cls = EventFrequencyCondition

    def increment(self, event, count, environment=None, timestamp=None):
        timestamp = timestamp if timestamp else before_now(minutes=1)
        data = {"fingerprint": event.data["fingerprint"]}
        if environment:
            data["environment"] = environment

        for _ in range(count):
            self.add_event(
                data=data,
                project_id=self.project.id,
                timestamp=timestamp,
            )


class EventUniqueUserFrequencyConditionTestCase(
    FrequencyConditionMixin,
    StandardIntervalMixin,
    SnubaTestCase,
):
    rule_cls = EventUniqueUserFrequencyCondition

    def increment(self, event, count, environment=None, timestamp=None):
        timestamp = timestamp if timestamp else before_now(minutes=1)
        data = {"fingerprint": event.data["fingerprint"]}
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.add_event(
                data=event_data,
                project_id=self.project.id,
                timestamp=timestamp,
            )


class EventFrequencyPercentConditionTestCase(SnubaTestCase):
    rule_cls = EventFrequencyPercentCondition

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

    def _run_test(self, minutes, data, passes, add_events=False):
        if not self.environment or self.environment.name != "prod":
            self.environment = self.create_environment(name="prod")
        if not hasattr(self, "test_event"):
            self.test_event = self.add_event(
                data={
                    "fingerprint": ["something_random"],
                    "user": {"id": uuid4().hex},
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
                timestamp=before_now(minutes=minutes),
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

    def increment(self, event, count, environment=None, timestamp=None):
        data = {
            "fingerprint": event.data["fingerprint"],
        }
        timestamp = timestamp if timestamp else before_now(minutes=1)
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.add_event(
                data=event_data,
                project_id=self.project.id,
                timestamp=timestamp,
            )

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_five_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)
        data = {"interval": "5m", "value": 41}
        self._run_test(data=data, minutes=5, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)
        data = {"interval": "10m", "value": 51}
        self._run_test(data=data, minutes=10, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_with_events(self):
        self._make_sessions(60)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)
        data = {"interval": "30m", "value": 51}
        self._run_test(data=data, minutes=30, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_with_events(self):
        self._make_sessions(60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, add_events=True, passes=True)
        data = {"interval": "1h", "value": 51}
        self._run_test(data=data, minutes=60, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_five_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_no_events(self):
        self._make_sessions(60)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_no_events(self):
        self._make_sessions(60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_comparison(self):
        self._make_sessions(10)
        # Create sessions for previous period
        self._make_sessions(10)

        # Test data is 2 events in the current period and 1 events in the comparison period.
        # Number of sessions is 20 in each period, so current period is 20% of sessions, prev
        # is 10%. Overall a 100% increase comparitively.
        event = self.add_event(
            data={"fingerprint": ["something_random"]},
            project_id=self.project.id,
            timestamp=before_now(minutes=1),
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

        data = {
            "interval": "1h",
            "value": 101,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event)


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class ErrorIssueFrequencyConditionTestCase(
    EventFrequencyConditionTestCase, RuleTestCase, ErrorEventMixin
):
    pass


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class PerfIssueFrequencyConditionTestCase(
    EventFrequencyConditionTestCase, RuleTestCase, PerfEventMixin
):
    pass


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class ErrorIssueUniqueUserFrequencyConditionTestCase(
    EventUniqueUserFrequencyConditionTestCase, RuleTestCase, ErrorEventMixin
):
    pass


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class PerfIssueUniqueUserFrequencyConditionTestCase(
    EventUniqueUserFrequencyConditionTestCase, RuleTestCase, PerfEventMixin
):
    pass


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class ErrorIssueEventFrequencyPercentConditionTestCase(
    EventFrequencyPercentConditionTestCase, RuleTestCase, ErrorEventMixin
):
    pass


@freeze_time((now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0))
@region_silo_test
class PerfIssueEventFrequencyPercentConditionTestCase(
    EventFrequencyPercentConditionTestCase, RuleTestCase, PerfEventMixin
):
    pass
