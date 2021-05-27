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

    def _run_test(self, minutes, value, passes, add_events=False):
        if not self.environment:
            self.environment = self.create_environment(name="prod")

        data = {"interval": "1m", "value": value}
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
                value + 1,
                environment=self.environment.name,
                timestamp=now() - timedelta(minutes=minutes),
            )
            self.increment(
                event,
                value + 1,
                timestamp=now() - timedelta(minutes=minutes),
            )

        with freeze_time(before_now(minutes=minutes)):
            if passes:
                self.assertPasses(rule, event)
                self.assertPasses(environment_rule, event)
            else:
                self.assertDoesNotPass(rule, event)
                self.assertDoesNotPass(environment_rule, event)

    def test_one_minute_with_events(self):
        self._run_test(value=6, minutes=1, passes=True, add_events=True)
        self._run_test(value=16, minutes=1, passes=False)

    def test_one_hour_with_events(self):
        self._run_test(value=6, minutes=60, passes=True, add_events=True)
        self._run_test(value=16, minutes=60, passes=False)

    def test_one_day_with_events(self):
        self._run_test(value=6, minutes=1440, passes=True, add_events=True)
        self._run_test(value=16, minutes=1440, passes=False)

    def test_one_minute_no_events(self):
        self._run_test(value=6, minutes=1, passes=False)

    def test_one_hour_no_events(self):
        self._run_test(value=6, minutes=60, passes=False)

    def test_one_day_no_events(self):
        self._run_test(value=6, minutes=1440, passes=False)


class EventFrequencyConditionTestCase(FrequencyConditionMixin, RuleTestCase, SnubaTestCase):
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
    FrequencyConditionMixin,
    RuleTestCase,
    SnubaTestCase,
):
    rule_cls = EventFrequencyPercentCondition

    def _run_test(self, minutes, value, passes, add_events=False):
        if not self.environment or self.environment.name != "prod":
            self.environment = self.create_environment(name="prod")
        received = time.time() - minutes * 60
        session_started = received // 60 * 60

        def make_session():
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
                started=session_started,
                received=received,
            )

        for _ in range(19):
            self.store_session(make_session())

        super()._run_test(value=value, minutes=minutes, passes=passes, add_events=add_events)

    def increment(self, event, count, environment=None, timestamp=None):
        data = {
            "fingerprint": event.data["fingerprint"],
            "timestamp": iso_format(timestamp) if timestamp else iso_format(before_now(minutes=1)),
        }
        if environment:
            data["environment"] = environment

        for _ in range(10):
            event_data = deepcopy(data)
            event_data["user"] = {"id": uuid4().hex}

            self.store_event(
                data=event_data,
                project_id=self.project.id,
            )

    def test_one_minute_with_events(self):
        self._run_test(value=50, minutes=1, add_events=True, passes=True)
        self._run_test(value=200, minutes=1, passes=False)

    def test_one_hour_with_events(self):
        self._run_test(value=50, minutes=60, add_events=True, passes=True)
        self._run_test(value=200, minutes=60, passes=False)

    def test_one_day_with_events(self):
        self._run_test(value=50, minutes=1440, passes=True, add_events=True)
        self._run_test(value=200, minutes=60, passes=False)

    def test_one_minute_no_events(self):
        self._run_test(value=50, minutes=1, passes=False)

    def test_one_hour_no_events(self):
        self._run_test(value=50, minutes=60, passes=False)

    def test_one_day_no_events(self):
        self._run_test(value=50, minutes=1440, passes=False)
