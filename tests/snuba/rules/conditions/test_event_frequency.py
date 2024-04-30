import time
from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import (
    BaseMetricsTestCase,
    PerformanceIssueTestCase,
    RuleTestCase,
    SnubaTestCase,
)
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class BaseEventFrequencyPercentTest(BaseMetricsTestCase):
    def _make_sessions(
        self, num: int, environment_name: str | None = None, project: Project | None = None
    ):
        received = time.time()

        def make_session(i):
            return dict(
                distinct_id=uuid4().hex,
                session_id=uuid4().hex,
                org_id=project.organization_id if project else self.project.organization_id,
                project_id=project.id if project else self.project.id,
                status="ok",
                seq=0,
                release="foo@1.0.0",
                environment=environment_name if environment_name else "prod",
                retention_days=90,
                duration=None,
                errors=0,
                # The line below is crucial to spread sessions throughout the time period.
                started=received - i - 1,
                received=received,
            )

        self.bulk_store_sessions([make_session(i) for i in range(num)])


class EventFrequencyQueryTestBase(SnubaTestCase, RuleTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()

        self.start = before_now(minutes=1)
        self.end = timezone.now()

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": self.environment.name,
                "timestamp": iso_format(before_now(seconds=30)),
                "fingerprint": ["group-1"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": self.environment.name,
                "timestamp": iso_format(before_now(seconds=12)),
                "fingerprint": ["group-2"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        self.environment2 = self.create_environment(name="staging")
        self.event3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": self.environment2.name,
                "timestamp": iso_format(before_now(seconds=12)),
                "fingerprint": ["group-3"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )

        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-something_random"
        perf_event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(seconds=12),
            start_timestamp=before_now(seconds=13),
            fingerprint=[fingerprint],
        )
        perf_event_data["user"] = {"id": uuid4().hex}
        perf_event_data["environment"] = self.environment.name

        # Store a performance event
        self.perf_event = self.create_performance_issue(
            event_data=perf_event_data,
            project_id=self.project.id,
            fingerprint=fingerprint,
        )
        self.data = {"interval": "5m", "value": 30}
        self.condition_inst = self.get_rule(
            data=self.data,
            project=self.event.group.project,
            rule=Rule(environment_id=self.environment.id),
        )

        self.condition_inst2 = self.get_rule(
            data=self.data,
            project=self.event.group.project,
            rule=Rule(environment_id=self.environment2.id),
        )


class EventFrequencyQueryTest(EventFrequencyQueryTestBase):
    rule_cls = EventFrequencyCondition

    def test_batch_query(self):
        batch_query = self.condition_inst.batch_query_hook(
            group_ids=[self.event.group_id, self.event2.group_id, self.perf_event.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 1,
        }

        batch_query = self.condition_inst2.batch_query_hook(
            group_ids=[self.event3.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}


class EventUniqueUserFrequencyQueryTest(EventFrequencyQueryTestBase):
    rule_cls = EventUniqueUserFrequencyCondition

    def test_batch_query_user(self):
        batch_query = self.condition_inst.batch_query_hook(
            group_ids=[self.event.group_id, self.event2.group_id, self.perf_event.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 1,
        }

        batch_query = self.condition_inst2.batch_query_hook(
            group_ids=[self.event3.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}


class EventFrequencyPercentConditionQueryTest(
    EventFrequencyQueryTestBase, BaseEventFrequencyPercentTest
):
    rule_cls = EventFrequencyPercentCondition

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_batch_query_percent(self):
        self._make_sessions(60, self.environment2.name)
        self._make_sessions(60, self.environment.name)
        batch_query = self.condition_inst.batch_query_hook(
            group_ids=[self.event.group_id, self.event2.group_id, self.perf_event.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        percent_of_sessions = 20
        assert batch_query == {
            self.event.group_id: percent_of_sessions,
            self.event2.group_id: percent_of_sessions,
        }
        batch_query = self.condition_inst2.batch_query_hook(
            group_ids=[self.event3.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: percent_of_sessions}


class ErrorEventMixin(SnubaTestCase):
    def add_event(self, data, project_id, timestamp):
        data["timestamp"] = iso_format(timestamp)
        # Store an error event
        event = self.store_event(
            data=data,
            project_id=project_id,
        )
        return event.for_group(event.group)


class PerfIssuePlatformEventMixin(PerformanceIssueTestCase):
    def add_event(self, data, project_id, timestamp):
        fingerprint = data["fingerprint"][0]
        fingerprint = (
            fingerprint
            if "-" in fingerprint
            else f"{PerformanceNPlusOneGroupType.type_id}-{data['fingerprint'][0]}"
        )
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=timestamp,
            start_timestamp=timestamp,
            fingerprint=[fingerprint],
        )
        event_data["user"] = {"id": uuid4().hex}
        event_data["environment"] = data.get("environment")
        for tag in event_data["tags"]:
            if tag[0] == "environment":
                tag[1] = data.get("environment")
                break
        else:
            event_data["tags"].append(data.get("environment"))

        # Store a performance event
        event = self.create_performance_issue(
            event_data=event_data,
            project_id=project_id,
            fingerprint=fingerprint,
        )
        return event


@pytest.mark.snuba_ci
class StandardIntervalTestBase(SnubaTestCase, RuleTestCase, PerformanceIssueTestCase):
    __test__ = Abstract(__module__, __qualname__)

    def add_event(self, data, project_id, timestamp):
        raise NotImplementedError

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
                timestamp=timezone.now() - timedelta(minutes=minutes),
            )
            self.increment(
                event,
                data["value"] + 1,
                timestamp=timezone.now() - timedelta(minutes=minutes),
            )

        if passes:
            self.assertPasses(rule, event, is_new=False)
            self.assertPasses(environment_rule, event, is_new=False)
        else:
            self.assertDoesNotPass(rule, event, is_new=False)
            self.assertDoesNotPass(environment_rule, event, is_new=False)

    def test_one_minute_with_events(self):
        data = {"interval": "1m", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1, passes=True, add_events=True)
        data = {
            "interval": "1m",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_with_events(self):
        data = {"interval": "1h", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=60, passes=True, add_events=True)
        data = {
            "interval": "1h",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_with_events(self):
        data = {"interval": "1d", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1440, passes=True, add_events=True)
        data = {
            "interval": "1d",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_with_events(self):
        data = {"interval": "1w", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=10080, passes=True, add_events=True)
        data = {
            "interval": "1w",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10080, passes=False)

    def test_one_minute_no_events(self):
        data = {"interval": "1m", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_no_events(self):
        data = {"interval": "1h", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_no_events(self):
        data = {"interval": "1d", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_no_events(self):
        data = {"interval": "1w", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
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
            timestamp=timezone.now() - timedelta(minutes=1),
        )
        self.increment(
            event,
            2,
            timestamp=timezone.now() - timedelta(days=1, minutes=20),
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertPasses(rule, event, is_new=False)

        data = {
            "interval": "1h",
            "value": 101,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event, is_new=False)

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
        self.assertDoesNotPass(rule, event, is_new=False)

        data = {
            "interval": "1h",
            "value": 100,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event, is_new=False)

    @patch("sentry.rules.conditions.event_frequency.BaseEventFrequencyCondition.get_rate")
    def test_is_new_issue_skips_snuba(self, mock_get_rate):
        # Looking for more than 1 event
        data = {"interval": "1m", "value": 6}
        minutes = 1
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
        # Issue is new and is the first event
        self.assertDoesNotPass(rule, event, is_new=True)
        self.assertDoesNotPass(environment_rule, event, is_new=True)
        assert mock_get_rate.call_count == 0


class EventFrequencyConditionTestCase(StandardIntervalTestBase):
    __test__ = Abstract(__module__, __qualname__)

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


class EventUniqueUserFrequencyConditionTestCase(StandardIntervalTestBase):
    __test__ = Abstract(__module__, __qualname__)

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


class EventFrequencyPercentConditionTestCase(BaseEventFrequencyPercentTest, RuleTestCase):
    __test__ = Abstract(__module__, __qualname__)

    rule_cls = EventFrequencyPercentCondition

    def add_event(self, data, project_id, timestamp):
        raise NotImplementedError

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
                timestamp=timezone.now() - timedelta(minutes=minutes),
            )
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=self.environment.id))
        if passes:
            self.assertPasses(rule, self.test_event, is_new=False)
            self.assertPasses(environment_rule, self.test_event, is_new=False)
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
        data = {
            "interval": "5m",
            "value": 39,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=5, passes=True, add_events=True)
        data = {
            "interval": "5m",
            "value": 41,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=5, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_with_events(self):
        self._make_sessions(60)
        data = {
            "interval": "10m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10, passes=True, add_events=True)
        data = {
            "interval": "10m",
            "value": 51,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_with_events(self):
        self._make_sessions(60)
        data = {
            "interval": "30m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=30, passes=True, add_events=True)
        data = {
            "interval": "30m",
            "value": 51,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=30, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_with_events(self):
        self._make_sessions(60)
        data = {
            "interval": "1h",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, add_events=True, passes=True)
        data = {
            "interval": "1h",
            "value": 51,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_five_minutes_no_events(self):
        self._make_sessions(60)
        data = {
            "interval": "5m",
            "value": 39,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=5, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_no_events(self):
        self._make_sessions(60)
        data = {
            "interval": "10m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_no_events(self):
        self._make_sessions(60)
        data = {
            "interval": "30m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=30, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_no_events(self):
        self._make_sessions(60)
        data = {
            "interval": "1h",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_comparison(self):
        self._make_sessions(10)
        # Create sessions for previous period
        self._make_sessions(10)

        # Test data is 2 events in the current period and 1 events in the comparison period.
        # Number of sessions is 20 in each period, so current period is 20% of sessions, prev
        # is 10%. Overall a 100% increase comparatively.
        event = self.add_event(
            data={"fingerprint": ["something_random"]},
            project_id=self.project.id,
            timestamp=before_now(minutes=1),
        )
        self.increment(
            event,
            1,
            timestamp=timezone.now() - timedelta(minutes=1),
        )
        self.increment(
            event,
            1,
            timestamp=timezone.now() - timedelta(days=1, minutes=20),
        )
        data = {
            "interval": "1h",
            "value": 99,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertPasses(rule, event, is_new=False)

        data = {
            "interval": "1h",
            "value": 101,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
        }
        rule = self.get_rule(data=data, rule=Rule(environment_id=None))
        self.assertDoesNotPass(rule, event, is_new=False)


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class ErrorIssueFrequencyConditionTestCase(ErrorEventMixin, EventFrequencyConditionTestCase):
    pass


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class PerfIssuePlatformIssueFrequencyConditionTestCase(
    PerfIssuePlatformEventMixin,
    EventFrequencyConditionTestCase,
):
    pass


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class ErrorIssueUniqueUserFrequencyConditionTestCase(
    ErrorEventMixin,
    EventUniqueUserFrequencyConditionTestCase,
):
    pass


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class PerfIssuePlatformIssueUniqueUserFrequencyConditionTestCase(
    PerfIssuePlatformEventMixin,
    EventUniqueUserFrequencyConditionTestCase,
):
    pass


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class ErrorIssueEventFrequencyPercentConditionTestCase(
    ErrorEventMixin, EventFrequencyPercentConditionTestCase
):
    pass


@freeze_time(
    (timezone.now() - timedelta(days=2)).replace(hour=12, minute=40, second=0, microsecond=0)
)
class PerfIssuePlatformIssueEventFrequencyPercentConditionTestCase(
    PerfIssuePlatformEventMixin,
    EventFrequencyPercentConditionTestCase,
):
    pass
