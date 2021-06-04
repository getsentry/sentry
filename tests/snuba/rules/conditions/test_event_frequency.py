import time
from copy import deepcopy
from datetime import timedelta
from uuid import uuid4

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


class FrequencyConditionMixin:
    def increment(self, event, count, environment=None, timestamp=None):
        raise NotImplementedError

    def _run_test(self, minutes, data, passes, add_events=False):
        if not self.environment:
            self.environment = self.create_environment(name="prod")

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=self.environment.id))

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
            )
            self.increment(
                event,
                data["value"] + 1,
                timestamp=now() - timedelta(minutes=minutes),
            )

        with freeze_time(before_now(minutes=minutes)):
            if passes:
                self.assertPasses(rule, event)
                self.assertPasses(environment_rule, event)
            else:
                self.assertDoesNotPass(rule, event)
                self.assertDoesNotPass(environment_rule, event)


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

    def test_thirty_days_with_events(self):
        data = {"interval": "30d", "value": 6}
        self._run_test(data=data, minutes=43200 - 1, passes=True, add_events=True)
        data = {"interval": "30d", "value": 16}
        self._run_test(data=data, minutes=43200 - 1, passes=False)

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

    def test_thirty_days_no_events(self):
        data = {"interval": "30d", "value": 6}
        self._run_test(data=data, minutes=43200 - 1, passes=False)


class EventFrequencyConditionTestCase(
    FrequencyConditionMixin, StandardIntervalMixin, RuleTestCase, SnubaTestCase
):
    rule_cls = EventFrequencyCondition

    def increment(self, event, count, environment=None, timestamp=None):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            self.store_event(
                data=data,
                project_id=self.project.id,
            )


class EventUniqueUserFrequencyConditionTestCase(
    FrequencyConditionMixin,
    StandardIntervalMixin,
    RuleTestCase,
    SnubaTestCase,
):
    rule_cls = EventUniqueUserFrequencyCondition

    def increment(self, event, count, environment=None, timestamp=None):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.store_event(
                data=event_data,
                project_id=self.project.id,
            )


class EventFrequencyPercentConditionTestCase(
    RuleTestCase,
    SnubaTestCase,
):
    rule_cls = EventFrequencyPercentCondition
    test_event = None

    def _make_sessions(self, num, minutes):
        received = time.time() - minutes * 60
        session_started = received // 60 * 60

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
                started=session_started - (i * (minutes / 30)),
                received=received,
            )

        self.bulk_store_sessions([make_session(i) for i in range(num)])

    def _run_test(self, minutes, data, passes, add_events=False):
        if not self.environment or self.environment.name != "prod":
            self.environment = self.create_environment(name="prod")
        if not self.test_event:
            self.test_event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(minutes=minutes)),
                    "user": {"id": uuid4().hex},
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
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
        with freeze_time(before_now(minutes=minutes)):
            if passes:
                self.assertPasses(rule, self.test_event)
                self.assertPasses(environment_rule, self.test_event)
            else:
                self.assertDoesNotPass(rule, self.test_event)
                self.assertDoesNotPass(environment_rule, self.test_event)

    def increment(self, event, count, environment=None, timestamp=None):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(count):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}
            self.store_event(
                data=event_data,
                project_id=self.project.id,
            )

    def test_one_minute_with_events(self):
        self._make_sessions(60, 1)
        data = {"interval": "1m", "value": 99}
        self._run_test(data=data, minutes=1, add_events=True, passes=True)
        data = {"interval": "1m", "value": 101}
        self._run_test(data=data, minutes=1, passes=False)

    def test_five_minutes_with_events(self):
        self._make_sessions(60, 5)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)
        data = {"interval": "5m", "value": 41}
        self._run_test(data=data, minutes=5, passes=False)

    def test_ten_minutes_with_events(self):
        self._make_sessions(60, 10)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)
        data = {"interval": "10m", "value": 51}
        self._run_test(data=data, minutes=10, passes=False)

    def test_thirty_minutes_with_events(self):
        self._make_sessions(60, 30)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)
        data = {"interval": "30m", "value": 51}
        self._run_test(data=data, minutes=30, passes=False)

    def test_one_hour_with_events(self):
        self._make_sessions(60, 60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, add_events=True, passes=True)
        data = {"interval": "1h", "value": 51}
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_minute_no_events(self):
        self._make_sessions(60, 1)
        data = {"interval": "1m", "value": 101}
        self._run_test(data=data, minutes=1, passes=False)

    def test_five_minutes_no_events(self):
        self._make_sessions(60, 5)
        data = {"interval": "5m", "value": 39}
        self._run_test(data=data, minutes=5, passes=True, add_events=True)

    def test_ten_minutes_no_events(self):
        self._make_sessions(60, 10)
        data = {"interval": "10m", "value": 49}
        self._run_test(data=data, minutes=10, passes=True, add_events=True)

    def test_thirty_minutes_no_events(self):
        self._make_sessions(60, 30)
        data = {"interval": "30m", "value": 49}
        self._run_test(data=data, minutes=30, passes=True, add_events=True)

    def test_one_hour_no_events(self):
        self._make_sessions(60, 60)
        data = {"interval": "1h", "value": 49}
        self._run_test(data=data, minutes=60, passes=False)
