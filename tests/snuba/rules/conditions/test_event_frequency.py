from typing import int
import time
from copy import deepcopy
from datetime import timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from django.utils import timezone
from snuba_sdk import Op

from sentry.issues.constants import get_issue_tsdb_group_model
from sentry.issues.grouptype import GroupCategory, PerformanceNPlusOneGroupType
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
    EventUniqueUserFrequencyConditionWithConditions,
)
from sentry.rules.match import MatchType
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import (
    BaseMetricsTestCase,
    PerformanceIssueTestCase,
    RuleTestCase,
    SnubaTestCase,
)
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class BaseEventFrequencyPercentTest(BaseMetricsTestCase):
    def _make_sessions(
        self,
        num: int,
        environment_name: str | None = None,
        project: Project | None = None,
        received: float | None = None,
    ):
        if received is None:
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
    def setUp(self) -> None:
        super().setUp()

        self.start = before_now(minutes=1)
        self.end = timezone.now()

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=30).isoformat(),
                "fingerprint": ["group-1"],
                "user": {"id": uuid4().hex},
            },
            project_id=self.project.id,
        )
        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=12).isoformat(),
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
                "timestamp": before_now(seconds=12).isoformat(),
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

    def test_batch_query(self) -> None:
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

    @patch("sentry.tsdb.snuba.LIMIT", 3)
    def test_batch_query_group_on_time(self) -> None:
        """
        Test that if we hit the snuba query limit we get incorrect results when group_on_time is enabled
        """

        def _store_events(fingerprint: str, offset=True) -> int:
            hours = 1
            group_id = None

            for i in range(4):
                if offset:
                    hours += 1
                event = self.store_event(
                    data={
                        "event_id": str(i) * 32,
                        "timestamp": before_now(hours=hours).isoformat(),
                        "fingerprint": [fingerprint],
                    },
                    project_id=self.project.id,
                )
                hours += 1
                group_id = event.group_id
            assert group_id
            return group_id

        group_1_id = _store_events("group-hb")
        group_2_id = _store_events("group-pb", offset=False)

        condition_inst = self.get_rule(
            data={"interval": "1w", "value": 1},
            project=self.project.id,
            rule=Rule(),
        )
        start = before_now(days=7)
        end = timezone.now()

        batch_query = condition_inst.get_chunked_result(
            tsdb_function=condition_inst.tsdb.get_timeseries_sums,
            model=get_issue_tsdb_group_model(GroupCategory.ERROR),
            group_ids=[group_1_id, group_2_id],
            organization_id=self.organization.id,
            start=start,
            end=end,
            environment_id=None,
            referrer_suffix="batch_alert_event_frequency",
            group_on_time=True,
        )

        assert batch_query == {
            group_1_id: 1,
            group_2_id: 2,
        }

        batch_query = condition_inst.get_chunked_result(
            tsdb_function=condition_inst.tsdb.get_sums,
            model=get_issue_tsdb_group_model(GroupCategory.ERROR),
            group_ids=[group_1_id, group_2_id],
            organization_id=self.organization.id,
            start=start,
            end=end,
            environment_id=None,
            referrer_suffix="batch_alert_event_frequency",
            group_on_time=False,
        )
        assert batch_query == {
            group_1_id: 4,
            group_2_id: 4,
        }

    def test_get_error_and_generic_group_ids(self) -> None:
        groups = Group.objects.filter(
            id__in=[self.event.group_id, self.event2.group_id, self.perf_event.group_id]
        ).values("id", "type", "project__organization_id")
        error_issue_ids, generic_issue_ids = self.condition_inst.get_error_and_generic_group_ids(
            groups
        )
        assert self.event.group_id in error_issue_ids
        assert self.event2.group_id in error_issue_ids
        assert self.perf_event.group_id in generic_issue_ids

    def test_upsampled_aggregation_with_real_events_error_groups(self) -> None:
        """Test that real events with sample weights produce upsampled counts for error groups"""
        with self.options({"issues.client_error_sampling.project_allowlist": [self.project.id]}):
            # Store 2 error events with 0.2 sample rate (5x weight = 10 total count)
            sampled_event1 = self.store_event(
                data={
                    "event_id": "d" * 32,
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=30).isoformat(),
                    "fingerprint": ["sampled-group"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "event_id": "e" * 32,
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=20).isoformat(),
                    "fingerprint": ["sampled-group"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                },
                project_id=self.project.id,
            )

            # Query using the EventFrequency condition's query_hook for proper integration
            group_event = sampled_event1.for_group(sampled_event1.group)
            count = self.condition_inst.query_hook(
                event=group_event,
                start=self.start,
                end=self.end,
                environment_id=self.environment.id,
            )

            # Expect upsampled count: 2 events * 5 sample_weight = 10
            assert count == 10

    def test_regular_aggregation_with_real_events_when_disabled(self) -> None:
        """Test that real events with sample weights produce regular counts when upsampling is disabled"""
        # Store 2 error events with 0.2 sample rate
        sampled_event1 = self.store_event(
            data={
                "event_id": "f" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=30).isoformat(),
                "fingerprint": ["non-upsampled-group"],
                "user": {"id": uuid4().hex},
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": str(uuid4()).replace("-", ""),
                "environment": self.environment.name,
                "timestamp": before_now(seconds=20).isoformat(),
                "fingerprint": ["non-upsampled-group"],
                "user": {"id": uuid4().hex},
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
            },
            project_id=self.project.id,
        )

        # Query using EventFrequency condition WITHOUT upsampling enabled - should return raw count
        group_event = sampled_event1.for_group(sampled_event1.group)
        count = self.condition_inst.query_hook(
            event=group_event,
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )

        # Expect regular count: 2 events (no upsampling)
        assert count == 2

    def test_regular_aggregation_with_real_events_performance_groups(self) -> None:
        """Test that performance groups use regular counts even when upsampling is enabled"""
        with self.options({"issues.client_error_sampling.project_allowlist": [self.project.id]}):
            # Query using EventFrequency condition for performance groups - should use regular count
            count = self.condition_inst.query_hook(
                event=self.perf_event,  # self.perf_event is already a GroupEvent
                start=self.start,
                end=self.end,
                environment_id=self.environment.id,
            )

            # Expect regular count: 1 event (no upsampling for performance)
            # The perf_event was created in setUp, so we expect count of 1
            assert count == 1

    def test_upsampled_aggregation_with_real_events_batch_query_error_groups(self) -> None:
        """Test that real events with sample weights produce upsampled counts in batch queries for error groups"""
        with self.options({"issues.client_error_sampling.project_allowlist": [self.project.id]}):
            # Store 2 error events with 0.2 sample rate for first group (5x weight = 10 total count)
            batch_event1_1 = self.store_event(
                data={
                    "event_id": str(uuid4()).replace("-", ""),
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=30).isoformat(),
                    "fingerprint": ["batch-group-1"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "event_id": str(uuid4()).replace("-", ""),
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=25).isoformat(),
                    "fingerprint": ["batch-group-1"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
                },
                project_id=self.project.id,
            )

            # Store 3 error events with 0.1 sample rate for second group (10x weight = 30 total count)
            batch_event2_1 = self.store_event(
                data={
                    "event_id": str(uuid4()).replace("-", ""),
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=20).isoformat(),
                    "fingerprint": ["batch-group-2"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.1}},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "event_id": str(uuid4()).replace("-", ""),
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=15).isoformat(),
                    "fingerprint": ["batch-group-2"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.1}},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "event_id": str(uuid4()).replace("-", ""),
                    "environment": self.environment.name,
                    "timestamp": before_now(seconds=10).isoformat(),
                    "fingerprint": ["batch-group-2"],
                    "user": {"id": uuid4().hex},
                    "contexts": {"error_sampling": {"client_sample_rate": 0.1}},
                },
                project_id=self.project.id,
            )

            # Query using batch_query_hook - should return upsampled counts
            result = self.condition_inst.batch_query_hook(
                group_ids={batch_event1_1.group_id, batch_event2_1.group_id},
                start=self.start,
                end=self.end,
                environment_id=self.environment.id,
            )

            # Expect upsampled counts:
            # Group 1: 2 events * 5 sample_weight = 10
            # Group 2: 3 events * 10 sample_weight = 30
            expected_results = {
                batch_event1_1.group_id: 10,
                batch_event2_1.group_id: 30,
            }
            assert result == expected_results

    def test_regular_aggregation_with_real_events_batch_query_when_disabled(self) -> None:
        """Test that real events with sample weights produce regular counts in batch queries when upsampling is disabled"""
        # Store 2 error events with 0.2 sample rate for first group
        batch_event1_1 = self.store_event(
            data={
                "event_id": str(uuid4()).replace("-", ""),
                "environment": self.environment.name,
                "timestamp": before_now(seconds=30).isoformat(),
                "fingerprint": ["batch-non-upsampled-1"],
                "user": {"id": uuid4().hex},
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": str(uuid4()).replace("-", ""),
                "environment": self.environment.name,
                "timestamp": before_now(seconds=25).isoformat(),
                "fingerprint": ["batch-non-upsampled-1"],
                "user": {"id": uuid4().hex},
                "contexts": {"error_sampling": {"client_sample_rate": 0.2}},
            },
            project_id=self.project.id,
        )

        # Store 1 error event for second group
        batch_event2_1 = self.store_event(
            data={
                "event_id": str(uuid4()).replace("-", ""),
                "environment": self.environment.name,
                "timestamp": before_now(seconds=20).isoformat(),
                "fingerprint": ["batch-non-upsampled-2"],
                "user": {"id": uuid4().hex},
                "contexts": {"error_sampling": {"client_sample_rate": 0.1}},
            },
            project_id=self.project.id,
        )

        # Query using batch_query_hook WITHOUT upsampling enabled - should return raw counts
        result = self.condition_inst.batch_query_hook(
            group_ids={batch_event1_1.group_id, batch_event2_1.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )

        # Expect regular counts: Group 1: 2 events, Group 2: 1 event (no upsampling)
        expected_results = {
            batch_event1_1.group_id: 2,
            batch_event2_1.group_id: 1,
        }
        assert result == expected_results


class EventUniqueUserFrequencyQueryTest(EventFrequencyQueryTestBase):
    rule_cls = EventUniqueUserFrequencyCondition

    def test_batch_query_user(self) -> None:
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
    def test_batch_query_percent(self) -> None:
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
            self.perf_event.group_id: 0,
        }
        batch_query = self.condition_inst2.batch_query_hook(
            group_ids=[self.event3.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: percent_of_sessions}

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 100)
    def test_batch_query_percent_no_avg_sessions_in_interval(self) -> None:
        self._make_sessions(60, self.environment2.name)
        self._make_sessions(60, self.environment.name)
        batch_query = self.condition_inst.batch_query_hook(
            group_ids=[self.event.group_id, self.event2.group_id, self.perf_event.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        percent = 0
        assert batch_query == {
            self.event.group_id: percent,
            self.event2.group_id: percent,
            self.perf_event.group_id: percent,
        }

        batch_query = self.condition_inst2.batch_query_hook(
            group_ids=[self.event3.group_id],
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: percent}


class ErrorEventMixin(SnubaTestCase):
    def add_event(self, data, project_id, timestamp):
        data["timestamp"] = timestamp.isoformat()
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
            raise AssertionError("expected `environment` tag")

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

    def test_comparison_interval_empty_string(self) -> None:
        data = {
            "interval": "1m",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "",
        }
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_minute_with_events(self) -> None:
        data = {"interval": "1m", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1, passes=True, add_events=True)
        data = {
            "interval": "1m",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_with_events(self) -> None:
        data = {"interval": "1h", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=60, passes=True, add_events=True)
        data = {
            "interval": "1h",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_with_events(self) -> None:
        data = {"interval": "1d", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1440, passes=True, add_events=True)
        data = {
            "interval": "1d",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_with_events(self) -> None:
        data = {"interval": "1w", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=10080, passes=True, add_events=True)
        data = {
            "interval": "1w",
            "value": 16,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10080, passes=False)

    def test_one_minute_no_events(self) -> None:
        data = {"interval": "1m", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1, passes=False)

    def test_one_hour_no_events(self) -> None:
        data = {"interval": "1h", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=60, passes=False)

    def test_one_day_no_events(self) -> None:
        data = {"interval": "1d", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=1440, passes=False)

    def test_one_week_no_events(self) -> None:
        data = {"interval": "1w", "value": 6, "comparisonType": "count", "comparisonInterval": "5m"}
        self._run_test(data=data, minutes=10080, passes=False)

    def test_comparison(self) -> None:
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

    def test_comparison_empty_comparison_period(self) -> None:
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
    def test_is_new_issue_skips_snuba(self, mock_get_rate: MagicMock) -> None:
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


@with_feature("organizations:event-unique-user-frequency-condition-with-conditions")
class EventUniqueUserFrequencyConditionWithConditionsTestCase(StandardIntervalTestBase):
    __test__ = Abstract(__module__, __qualname__)

    rule_cls = EventUniqueUserFrequencyConditionWithConditions

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

    def test_comparison(self) -> None:
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
            "id": "EventFrequencyConditionWithConditions",
        }

        rule = self.get_rule(
            data=data,
            rule=Rule(
                environment_id=None,
                project_id=self.project.id,
                data={
                    "conditions": [data],
                    "filter_match": "all",
                },
            ),
        )
        self.assertPasses(rule, event, is_new=False)

        data = {
            "interval": "1h",
            "value": 101,
            "comparisonType": "percent",
            "comparisonInterval": "1d",
            "id": "EventFrequencyConditionWithConditions",
        }

        rule = self.get_rule(
            data=data,
            rule=Rule(
                environment_id=None,
                project_id=self.project.id,
                data={
                    "conditions": [data],
                    "filter_match": "all",
                },
            ),
        )
        self.assertDoesNotPass(rule, event, is_new=False)

    def test_comparison_empty_comparison_period(self) -> None:
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
            "filter_match": "all",
            "conditions": [
                {
                    "interval": "1h",
                    "value": 0,
                    "comparisonType": "percent",
                    "comparisonInterval": "1d",
                }
            ],
        }
        rule = self.get_rule(
            data=data, rule=Rule(environment_id=None, project_id=self.project.id, data=data)
        )
        self.assertDoesNotPass(rule, event, is_new=False)

        data = {
            "filter_match": "all",
            "conditions": [
                {
                    "interval": "1h",
                    "value": 100,
                    "comparisonType": "percent",
                    "comparisonInterval": "1d",
                }
            ],
        }
        rule = self.get_rule(
            data=data, rule=Rule(environment_id=None, project_id=self.project.id, data=data)
        )
        self.assertDoesNotPass(rule, event, is_new=False)

    def _run_test(self, minutes, data, passes, add_events=False):
        data["filter_match"] = "all"
        data["conditions"] = data.get("conditions", [])
        rule = self.get_rule(
            data=data,
            rule=Rule(environment_id=None, project_id=self.project.id, data=data),
        )
        environment_rule = self.get_rule(
            data=data,
            rule=Rule(
                environment_id=self.environment.id,
                project_id=self.project.id,
                data=data,
            ),
        )

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


def test_convert_rule_condition_to_snuba_condition() -> None:

    # Test non-TaggedEventFilter condition
    condition = {"id": "some.other.condition"}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            condition
        )
        is None
    )

    # Test TaggedEventFilter conditions
    base_condition = {
        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
        "key": "test_key",
        "value": "test_value",
    }

    # Test equality
    eq_condition = {**base_condition, "match": MatchType.EQUAL}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            eq_condition
        )
        == (
            "tags[test_key]",
            Op.EQ.value,
            "test_value",
        )
    )

    # Test inequality
    ne_condition = {**base_condition, "match": MatchType.NOT_EQUAL}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            ne_condition
        )
        == (
            "tags[test_key]",
            Op.NEQ.value,
            "test_value",
        )
    )

    # Test starts with
    sw_condition = {**base_condition, "match": MatchType.STARTS_WITH}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            sw_condition
        )
        == (
            "tags[test_key]",
            Op.LIKE.value,
            "test_value%",
        )
    )

    # Test not starts with
    nsw_condition = {**base_condition, "match": MatchType.NOT_STARTS_WITH}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            nsw_condition
        )
        == (
            "tags[test_key]",
            Op.NOT_LIKE.value,
            "test_value%",
        )
    )

    # Test ends with
    ew_condition = {**base_condition, "match": MatchType.ENDS_WITH}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            ew_condition
        )
        == (
            "tags[test_key]",
            Op.LIKE.value,
            "%test_value",
        )
    )

    # Test not ends with
    new_condition = {**base_condition, "match": MatchType.NOT_ENDS_WITH}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            new_condition
        )
        == (
            "tags[test_key]",
            Op.NOT_LIKE.value,
            "%test_value",
        )
    )

    # Test contains
    co_condition = {**base_condition, "match": MatchType.CONTAINS}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            co_condition
        )
        == (
            "tags[test_key]",
            Op.LIKE.value,
            "%test_value%",
        )
    )

    # Test not contains
    nc_condition = {**base_condition, "match": MatchType.NOT_CONTAINS}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            nc_condition
        )
        == (
            "tags[test_key]",
            Op.NOT_LIKE.value,
            "%test_value%",
        )
    )

    # Test is set
    is_condition = {**base_condition, "match": MatchType.IS_SET}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            is_condition
        )
        == (
            "tags[test_key]",
            Op.IS_NOT_NULL.value,
            None,
        )
    )

    # Test not set
    ns_condition = {**base_condition, "match": MatchType.NOT_SET}
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            ns_condition
        )
        == (
            "tags[test_key]",
            Op.IS_NULL.value,
            None,
        )
    )

    # Test is in
    in_condition = {
        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
        "key": "test_key",
        "value": "test_value_1,test_value_2",
        "match": MatchType.IS_IN,
    }
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            in_condition
        )
        == (
            "tags[test_key]",
            Op.IN.value,
            ["test_value_1", "test_value_2"],
        )
    )

    # Test not in
    not_in_condition = {
        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
        "key": "test_key",
        "value": "test_value_1,test_value_2",
        "match": MatchType.NOT_IN,
    }
    assert (
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            not_in_condition
        )
        == (
            "tags[test_key]",
            Op.NOT_IN.value,
            ["test_value_1", "test_value_2"],
        )
    )

    # Test unsupported match type
    with pytest.raises(ValueError, match="Unsupported match type: unsupported"):
        EventUniqueUserFrequencyConditionWithConditions.convert_rule_condition_to_snuba_condition(
            {**base_condition, "match": "unsupported"}
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
    def test_five_minutes_with_events(self) -> None:
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
    def test_ten_minutes_with_events(self) -> None:
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
    def test_thirty_minutes_with_events(self) -> None:
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
    def test_one_hour_with_events(self) -> None:
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
    def test_five_minutes_no_events(self) -> None:
        self._make_sessions(60)
        data = {
            "interval": "5m",
            "value": 39,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=5, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_ten_minutes_no_events(self) -> None:
        self._make_sessions(60)
        data = {
            "interval": "10m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=10, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_thirty_minutes_no_events(self) -> None:
        self._make_sessions(60)
        data = {
            "interval": "30m",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=30, passes=True, add_events=True)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_one_hour_no_events(self) -> None:
        self._make_sessions(60)
        data = {
            "interval": "1h",
            "value": 49,
            "comparisonType": "count",
            "comparisonInterval": "5m",
        }
        self._run_test(data=data, minutes=60, passes=False)

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_comparison(self) -> None:
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
class ErrorIssueUniqueUserFrequencyConditionWithConditionsTestCase(
    ErrorEventMixin,
    EventUniqueUserFrequencyConditionWithConditionsTestCase,
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
