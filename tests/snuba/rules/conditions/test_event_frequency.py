from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.utils.timezone import now

from sentry import tsdb
from sentry.models import Rule
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.testutils.cases import RuleTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


def disable_cache(func):
    def inner(*args, use_cache=False, **kwargs):
        return func(*args, use_cache=False, **kwargs)

    return inner


class FrequencyConditionMixin:
    def increment(self, event, count, environment=None, timestamp=None):
        raise NotImplementedError

    def disable_cache(self):
        raise NotImplementedError

    def test_one_minute(self):
        with self.disable_cache():
            event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(minutes=5)),
                    "user": {"id": uuid4().hex},
                },
                project_id=self.project.id,
            )
            value = 2
            data = {"interval": "1m", "value": str(value)}

            rule = self.get_rule(data=data, rule=Rule(environment_id=None))

            environment = self.create_environment()
            environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment.id))

            self.increment(
                event,
                value + 1,
                environment=environment.name,
                timestamp=now() - timedelta(minutes=5),
            )
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(
                event, value, environment=environment.name, timestamp=now() - timedelta(seconds=30)
            )
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(
                event, 1, environment=environment.name, timestamp=now() - timedelta(seconds=30)
            )
            self.assertPasses(rule, event)
            self.assertPasses(environment_rule, event)

    def test_one_hour(self):
        with self.disable_cache():
            event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(hours=5)),
                    "user": {"id": uuid4().hex},
                },
                project_id=self.project.id,
            )
            value = 2
            data = {"interval": "1h", "value": str(value)}

            rule = self.get_rule(data=data, rule=Rule(environment_id=None))

            environment = self.create_environment()
            environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment.id))

            self.increment(
                event,
                value + 1,
                environment=environment.name,
                timestamp=now() - timedelta(minutes=90),
            )
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(event, value, environment=environment.name)
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(event, 1, environment=environment.name)
            self.assertPasses(rule, event)
            self.assertPasses(environment_rule, event)

    def test_one_day(self):
        with self.disable_cache():
            event = self.store_event(
                data={
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(days=5)),
                    "user": {"id": uuid4().hex},
                },
                project_id=self.project.id,
            )
            value = 2
            data = {"interval": "1d", "value": str(value)}

            rule = self.get_rule(data=data, rule=Rule(environment_id=None))

            environment = self.create_environment()
            environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment.id))

            self.increment(
                event,
                value + 1,
                environment=environment.name,
                timestamp=now() - timedelta(hours=36),
            )
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(
                event, value, environment=environment.name, timestamp=now() - timedelta(hours=12)
            )
            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(event, 1, environment=environment.name)
            self.assertPasses(rule, event)
            self.assertPasses(environment_rule, event)

    def test_more_than_zero(self):
        with self.disable_cache():
            event = self.store_event(
                data={
                    "event_id": "a" * 32,
                    "fingerprint": ["something_random"],
                    "timestamp": iso_format(before_now(hours=2)),
                    "user": {"id": uuid4().hex},
                },
                project_id=self.project.id,
            )

            data = {"interval": "1h", "value": "0"}

            rule = self.get_rule(data=data, rule=Rule(environment_id=None))

            env = self.create_environment()

            environment_id = env.id
            environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment_id))

            self.assertDoesNotPass(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(event, 1)
            self.assertPasses(rule, event)
            self.assertDoesNotPass(environment_rule, event)

            self.increment(event, 1, environment=env.name)

            self.assertPasses(rule, event)
            self.assertPasses(environment_rule, event)

    def test_cache(self):
        event = self.store_event(
            data={
                "fingerprint": ["something_random"],
                "timestamp": iso_format(before_now(days=5)),
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        value = 2
        data = {"interval": "1d", "value": str(value)}

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))

        self.increment(event, value, timestamp=now() - timedelta(hours=12))
        self.assertDoesNotPass(rule, event)

        # Should not pass, since we'll hit the cache
        self.increment(event, 1, timestamp=now() - timedelta(hours=12))
        self.assertDoesNotPass(rule, event)


class EventFrequencyConditionTestCase(FrequencyConditionMixin, SnubaTestCase, RuleTestCase):
    rule_cls = EventFrequencyCondition

    def disable_cache(self):
        return patch.object(tsdb, "get_sums", side_effect=disable_cache(tsdb.get_sums))

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
    SnubaTestCase,
    RuleTestCase,
):
    rule_cls = EventUniqueUserFrequencyCondition

    def disable_cache(self):
        return patch.object(
            tsdb,
            "get_distinct_counts_totals",
            side_effect=disable_cache(tsdb.get_distinct_counts_totals),
        )

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
