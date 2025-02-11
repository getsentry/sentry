import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone
from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot

from sentry import options
from sentry.api.issue_search import convert_query_values, issue_search_config, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import (
    FeedbackGroup,
    NoiseConfig,
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    ProfileFileIOGroupType,
)
from sentry.issues.ingest import send_issue_occurrence_to_eventstream
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.groupowner import GroupOwner
from sentry.models.groupsubscription import GroupSubscription
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend, SnubaSearchBackendBase
from sentry.search.snuba.executors import TrendsSortWeights
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import SnubaTestCase, TestCase, TransactionTestCase
from sentry.testutils.helpers import Feature, apply_feature_flag_on_cls
from sentry.testutils.helpers.datetime import before_now
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.utils import json
from sentry.utils.snuba import SENTRY_SNUBA_MAP
from tests.sentry.issues.test_utils import OccurrenceTestMixin


def date_to_query_format(date):
    return date.strftime("%Y-%m-%dT%H:%M:%S")


class SharedSnubaMixin(SnubaTestCase):
    @property
    def backend(self) -> SnubaSearchBackendBase:
        raise NotImplementedError(self)

    def build_search_filter(self, query, projects=None, user=None, environments=None):
        user = user if user is not None else self.user
        projects = projects if projects is not None else [self.project]
        return convert_query_values(parse_search_query(query), projects, user, environments)

    def make_query(
        self,
        projects=None,
        search_filter_query=None,
        user=None,
        environments=None,
        sort_by="date",
        limit=None,
        count_hits=False,
        date_from=None,
        date_to=None,
        cursor=None,
        aggregate_kwargs=None,
    ):
        search_filters = []
        projects = projects if projects is not None else [self.project]
        if search_filter_query is not None:
            search_filters = self.build_search_filter(
                search_filter_query, projects, user=user, environments=environments
            )

        kwargs = {}
        if limit is not None:
            kwargs["limit"] = limit
        if aggregate_kwargs:
            kwargs["aggregate_kwargs"] = {"trends": {**aggregate_kwargs}}

        return self.backend.query(
            projects,
            search_filters=search_filters,
            environments=environments,
            count_hits=count_hits,
            sort_by=sort_by,
            date_from=date_from,
            date_to=date_to,
            cursor=cursor,
            **kwargs,
        )

    def store_event(self, data, *args, **kwargs):
        event = super().store_event(data, *args, **kwargs)
        environment_name = data.get("environment")
        if environment_name:
            GroupEnvironment.objects.filter(
                group_id=event.group_id,
                environment__name=environment_name,
                first_seen__gt=event.datetime,
            ).update(first_seen=event.datetime)
        return event


class EventsDatasetTestSetup(SharedSnubaMixin):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def setUp(self):
        super().setUp()
        self.base_datetime = before_now(days=3).replace(microsecond=0)

        event1_timestamp = (self.base_datetime - timedelta(days=21)).isoformat()
        self.event1 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "a" * 32,
                "message": "foo. Indeed, this message is intended to be greater than 256 characters such that we can put this unique string identifier after that point in the string. The purpose of this is in order to verify we are using snuba to search messages instead of Postgres (postgres truncates at 256 characters and clickhouse does not). santryrox.",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event1@example.com"},
                "timestamp": event1_timestamp,
                "stacktrace": {"frames": [{"module": "group1"}]},
                "level": "fatal",
            },
            project_id=self.project.id,
        )
        self.event3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "c" * 32,
                "message": "group1",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event3@example.com"},
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
                "level": "fatal",
            },
            project_id=self.project.id,
        )

        self.group1 = Group.objects.get(id=self.event1.group.id)
        assert self.group1.id == self.event1.group.id
        assert self.group1.id == self.event3.group.id

        assert self.group1.first_seen == self.event1.datetime
        assert self.group1.last_seen == self.event3.datetime

        self.group1.times_seen = 5
        self.group1.status = GroupStatus.UNRESOLVED
        self.group1.substatus = GroupSubStatus.ONGOING
        self.group1.priority = PriorityLevel.HIGH
        self.group1.update(type=ErrorGroupType.type_id)
        self.group1.save()
        self.store_group(self.group1)

        self.event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "event_id": "b" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "message": "bar",
                "stacktrace": {"frames": [{"module": "group2"}]},
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
                "level": "error",
            },
            project_id=self.project.id,
        )

        self.group2 = Group.objects.get(id=self.event2.group.id)
        assert self.group2.id == self.event2.group.id
        assert self.group2.first_seen == self.group2.last_seen == self.event2.datetime

        self.group2.status = GroupStatus.RESOLVED
        self.group2.substatus = None
        self.group2.times_seen = 10
        self.group2.update(type=ErrorGroupType.type_id)
        self.group2.priority = PriorityLevel.HIGH
        self.group2.save()
        self.store_group(self.group2)

        GroupBookmark.objects.create(
            user_id=self.user.id, group=self.group2, project=self.group2.project
        )

        GroupAssignee.objects.create(
            user_id=self.user.id, group=self.group2, project=self.group2.project
        )

        GroupSubscription.objects.create(
            user_id=self.user.id, group=self.group1, project=self.group1.project, is_active=True
        )

        GroupSubscription.objects.create(
            user_id=self.user.id, group=self.group2, project=self.group2.project, is_active=False
        )

        self.environments = {
            "production": self.event1.get_environment(),
            "staging": self.event2.get_environment(),
        }

    def set_up_multi_project(self):
        self.project2 = self.create_project(organization=self.project.organization)
        self.event_p2 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["put-me-in-groupP2"],
                "timestamp": (self.base_datetime - timedelta(days=21)).isoformat(),
                "message": "foo",
                "stacktrace": {"frames": [{"module": "group_p2"}]},
                "tags": {"server": "example.com"},
                "environment": "production",
            },
            project_id=self.project2.id,
        )

        self.group_p2 = Group.objects.get(id=self.event_p2.group.id)
        self.group_p2.times_seen = 6
        self.group_p2.last_seen = self.base_datetime - timedelta(days=1)
        self.group_p2.save()
        self.store_group(self.group_p2)

    def create_group_with_integration_external_issue(self, environment="production"):
        event = self.store_event(
            data={
                "fingerprint": ["linked_group1"],
                "event_id": uuid.uuid4().hex,
                "timestamp": self.base_datetime.isoformat(),
                "environment": environment,
            },
            project_id=self.project.id,
        )
        integration, _ = self.create_provider_integration_for(
            event.group.organization, self.user, provider="example", name="Example"
        )
        self.create_integration_external_issue(
            group=event.group,
            integration=integration,
            key="APP-123",
        )
        return event.group

    def create_group_with_platform_external_issue(self, environment="production"):
        event = self.store_event(
            data={
                "fingerprint": ["linked_group2"],
                "event_id": uuid.uuid4().hex,
                "timestamp": self.base_datetime.isoformat(),
                "environment": environment,
            },
            project_id=self.project.id,
        )
        self.create_platform_external_issue(
            group=event.group,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )
        return event.group

    def run_test_query(
        self, query, expected_groups, expected_negative_groups=None, environments=None, user=None
    ):
        results = self.make_query(search_filter_query=query, environments=environments, user=user)

        def sort_key(result):
            return result.id

        assert sorted(results, key=sort_key) == sorted(expected_groups, key=sort_key)

        if expected_negative_groups is not None:
            results = self.make_query(search_filter_query=f"!{query}", user=user)
            assert sorted(results, key=sort_key) == sorted(expected_negative_groups, key=sort_key)


class EventsSnubaSearchTestCases(EventsDatasetTestSetup):
    def test_query(self):
        results = self.make_query(search_filter_query="foo")
        assert set(results) == {self.group1}

        results = self.make_query(search_filter_query="bar")
        assert set(results) == {self.group2}

    def test_query_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], search_filter_query="foo")
        assert set(results) == {self.group1, self.group_p2}

    def test_query_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="foo"
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="bar"
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="bar"
        )
        assert set(results) == {self.group2}

    def test_query_for_text_in_long_message(self):
        results = self.make_query(
            [self.project],
            environments=[self.environments["production"]],
            search_filter_query="santryrox",
        )

        assert set(results) == {self.group1}

    def test_multi_environments(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"], self.environments["staging"]],
        )
        assert set(results) == {self.group1, self.group2, self.group_p2}

    def test_query_with_environment_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"]],
            search_filter_query="foo",
        )
        assert set(results) == {self.group1, self.group_p2}

        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"]],
            search_filter_query="bar",
        )
        assert set(results) == set()

    def test_query_timestamp(self):
        results = self.make_query(
            [self.project],
            environments=[self.environments["production"]],
            search_filter_query=f"timestamp:>{self.event1.datetime.isoformat()} timestamp:<{self.event3.datetime.isoformat()}",
        )

        assert set(results) == {self.group1}

    def test_sort(self):
        results = self.make_query(sort_by="date")
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by="new")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by="freq")
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by="trends")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by="user")
        assert list(results) == [self.group1, self.group2]

    def test_trends_sort(self):
        weights: TrendsSortWeights = {
            "log_level": 5,
            "has_stacktrace": 5,
            "relative_volume": 1,
            "event_halflife_hours": 4,
            "issue_halflife_hours": 24 * 7,
            "v2": False,
            "norm": False,
        }
        results = self.make_query(
            sort_by="trends",
            aggregate_kwargs=weights,
        )
        assert list(results) == [self.group2, self.group1]

    def test_sort_with_environment(self):
        for dt in [
            self.group1.first_seen + timedelta(days=1),
            self.group1.first_seen + timedelta(days=2),
            self.group1.last_seen + timedelta(days=1),
        ]:
            self.store_event(
                data={
                    "fingerprint": ["put-me-in-group2"],
                    "timestamp": dt.isoformat(),
                    "stacktrace": {"frames": [{"module": "group2"}]},
                    "environment": "production",
                    "message": "group2",
                },
                project_id=self.project.id,
            )

        results = self.make_query(environments=[self.environments["production"]], sort_by="date")
        assert list(results) == [self.group2, self.group1]
        results = self.make_query(environments=[self.environments["production"]], sort_by="new")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(environments=[self.environments["production"]], sort_by="freq")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(environments=[self.environments["production"]], sort_by="trends")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(environments=[self.environments["production"]], sort_by="user")
        assert list(results) == [self.group1, self.group2]

    def test_status(self):
        results = self.make_query(search_filter_query="is:unresolved")
        assert set(results) == {self.group1}

        results = self.make_query(search_filter_query="is:resolved")
        assert set(results) == {self.group2}

        event_3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group3"],
                "event_id": "c" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            },
            project_id=self.project.id,
        )
        group_3 = event_3.group
        group_3.status = GroupStatus.MUTED
        group_3.substatus = None
        group_3.save()

        self.run_test_query("status:[unresolved, resolved]", [self.group1, self.group2], [group_3])
        self.run_test_query("status:[resolved, muted]", [self.group2, group_3], [self.group1])

    def test_substatus(self):
        results = self.make_query(search_filter_query="is:ongoing")
        assert set(results) == {self.group1}

    def test_category(self):
        results = self.make_query(search_filter_query="issue.category:error")
        assert set(results) == {self.group1, self.group2}

        event_3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group3"],
                "event_id": "c" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            },
            project_id=self.project.id,
        )
        group_3 = event_3.group
        group_3.update(type=PerformanceNPlusOneGroupType.type_id)
        results = self.make_query(search_filter_query="issue.category:performance")
        assert set(results) == {group_3}

        results = self.make_query(search_filter_query="issue.category:[error, performance]")
        assert set(results) == {self.group1, self.group2, group_3}

        with pytest.raises(InvalidSearchQuery):
            self.make_query(search_filter_query="issue.category:hellboy")

    def test_not_perf_category(self):
        results = self.make_query(search_filter_query="issue.category:error foo")
        assert set(results) == {self.group1}

        not_results = self.make_query(search_filter_query="!issue.category:performance foo")
        assert set(not_results) == {self.group1}

    def test_type(self):
        results = self.make_query(search_filter_query="issue.type:error")
        assert set(results) == {self.group1, self.group2}

        event_3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group3"],
                "event_id": "c" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "type": PerformanceNPlusOneGroupType.type_id,
            },
            project_id=self.project.id,
        )
        group_3 = event_3.group
        group_3.update(type=PerformanceNPlusOneGroupType.type_id)

        results = self.make_query(
            search_filter_query="issue.type:performance_n_plus_one_db_queries"
        )
        assert set(results) == {group_3}

        event_4 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group4"],
                "event_id": "d" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            },
            project_id=self.project.id,
        )
        group_4 = event_4.group
        group_4.update(type=PerformanceRenderBlockingAssetSpanGroupType.type_id)
        results = self.make_query(
            search_filter_query="issue.type:performance_render_blocking_asset_span"
        )
        assert set(results) == {group_4}

        results = self.make_query(
            search_filter_query="issue.type:[performance_render_blocking_asset_span, performance_n_plus_one_db_queries, error]"
        )
        assert set(results) == {self.group1, self.group2, group_3, group_4}

        with pytest.raises(InvalidSearchQuery):
            self.make_query(search_filter_query="issue.type:performance_i_dont_exist")

    def test_status_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:unresolved"
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:resolved"
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:resolved"
        )
        assert set(results) == set()

    def test_tags(self):
        results = self.make_query(search_filter_query="environment:staging")
        assert set(results) == {self.group2}

        results = self.make_query(search_filter_query="environment:example.com")
        assert set(results) == set()

        results = self.make_query(search_filter_query="has:environment")
        assert set(results) == {self.group2, self.group1}

        results = self.make_query(search_filter_query="environment:staging server:example.com")
        assert set(results) == {self.group2}

        results = self.make_query(search_filter_query='url:"http://example.com"')
        assert set(results) == {self.group2}

        results = self.make_query(search_filter_query="environment:staging has:server")
        assert set(results) == {self.group2}

        results = self.make_query(search_filter_query="environment:staging server:bar.example.com")
        assert set(results) == set()

    def test_tags_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="server:example.com"
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="server:example.com"
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="has:server"
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query='url:"http://example.com"',
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query='url:"http://example.com"',
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="server:bar.example.com",
        )
        assert set(results) == set()

    def test_bookmarked_by(self):
        results = self.make_query(search_filter_query="bookmarks:%s" % self.user.username)
        assert set(results) == {self.group2}

    def test_bookmarked_by_in_syntax(self):
        self.run_test_query(f"bookmarks:[{self.user.username}]", [self.group2], [self.group1])
        user_2 = self.create_user()
        GroupBookmark.objects.create(
            user_id=user_2.id, group=self.group1, project=self.group2.project
        )
        self.run_test_query(
            f"bookmarks:[{self.user.username}, {user_2.username}]", [self.group2, self.group1], []
        )

    def test_bookmarked_by_with_environment(self):
        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="bookmarks:%s" % self.user.username,
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="bookmarks:%s" % self.user.username,
        )
        assert set(results) == set()

    def test_search_filter_query_with_custom_trends_tag(self):
        trends = "high"
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": (self.group2.first_seen + timedelta(days=1)).isoformat(),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"trends": trends},
            },
            project_id=self.project.id,
        )

        results = self.make_query(search_filter_query="trends:%s" % trends)

        assert set(results) == {self.group2}

    def test_search_filter_query_with_custom_trends_tag_and_trends_sort(self):
        trends = "high"
        for i in range(1, 3):
            self.store_event(
                data={
                    "fingerprint": ["put-me-in-group1"],
                    "timestamp": (self.group2.last_seen + timedelta(days=i)).isoformat(),
                    "stacktrace": {"frames": [{"module": "group1"}]},
                    "message": "group1",
                    "tags": {"trends": trends},
                },
                project_id=self.project.id,
            )
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": (self.group2.last_seen + timedelta(days=2)).isoformat(),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"trends": trends},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="trends:%s" % trends, sort_by="trends")
        assert list(results) == [self.group2, self.group1]

    def test_search_tag_overlapping_with_internal_fields(self):
        # Using a tag of email overlaps with the promoted user.email column in events.
        # We don't want to bypass public schema limits in issue search.
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": (self.group2.first_seen + timedelta(days=1)).isoformat(),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"email": "tags@example.com"},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="email:tags@example.com")
        assert set(results) == {self.group2}

    def test_project(self):
        results = self.make_query([self.create_project(name="other")])
        assert set(results) == set()

    def test_pagination(self):
        for options_set in [
            {"snuba.search.min-pre-snuba-candidates": None},
            {"snuba.search.min-pre-snuba-candidates": 500},
        ]:
            with self.options(options_set):
                results = self.backend.query([self.project], limit=1, sort_by="date")
                assert set(results) == {self.group1}
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == {self.group2}
                assert results.prev.has_results
                assert not results.next.has_results

                # note: previous cursor
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by="date"
                )
                assert set(results) == {self.group1}
                assert results.prev.has_results
                assert results.next.has_results

                # note: previous cursor, paging too far into 0 results
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by="date"
                )
                assert set(results) == set()
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == {self.group1}
                assert results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == {self.group2}
                assert results.prev.has_results
                assert not results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == set()
                assert results.prev.has_results
                assert not results.next.has_results

    def test_pagination_with_environment(self):
        for dt in [
            self.group1.first_seen + timedelta(days=1),
            self.group1.first_seen + timedelta(days=2),
            self.group1.last_seen + timedelta(days=1),
        ]:
            self.store_event(
                data={
                    "fingerprint": ["put-me-in-group2"],
                    "timestamp": dt.isoformat(),
                    "environment": "production",
                    "message": "group2",
                    "stacktrace": {"frames": [{"module": "group2"}]},
                },
                project_id=self.project.id,
            )

        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            sort_by="date",
            limit=1,
            count_hits=True,
        )
        assert list(results) == [self.group2]
        assert results.hits == 2

        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            sort_by="date",
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == [self.group1]
        assert results.hits == 2

        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            sort_by="date",
            limit=1,
            cursor=results.next,
            count_hits=True,
        )
        assert list(results) == []
        assert results.hits == 2

    def test_age_filter(self):
        results = self.make_query(
            search_filter_query="firstSeen:>=%s" % date_to_query_format(self.group2.first_seen)
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            search_filter_query="firstSeen:<=%s"
            % date_to_query_format(self.group1.first_seen + timedelta(minutes=1))
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            search_filter_query="firstSeen:>=%s firstSeen:<=%s"
            % (
                date_to_query_format(self.group1.first_seen),
                date_to_query_format(self.group1.first_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == {self.group1}

    def test_age_filter_with_environment(self):
        # add time instead to make it greater than or less than as needed.
        group1_first_seen = GroupEnvironment.objects.get(
            environment=self.environments["production"], group=self.group1
        ).first_seen
        assert group1_first_seen is not None

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:>=%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:<=%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:>%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set()
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": (group1_first_seen + timedelta(days=1)).isoformat(),
                "message": "group1",
                "stacktrace": {"frames": [{"module": "group1"}]},
                "environment": "development",
            },
            project_id=self.project.id,
        )

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:>%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="firstSeen:>%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == {self.group1}

    def test_times_seen_filter(self):
        results = self.make_query([self.project], search_filter_query="times_seen:2")
        assert set(results) == {self.group1}

        results = self.make_query([self.project], search_filter_query="times_seen:>=2")
        assert set(results) == {self.group1}

        results = self.make_query([self.project], search_filter_query="times_seen:<=1")
        assert set(results) == {self.group2}

    def test_last_seen_filter(self):
        results = self.make_query(
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen)
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            search_filter_query="lastSeen:>=%s lastSeen:<=%s"
            % (
                date_to_query_format(self.group1.last_seen),
                date_to_query_format(self.group1.last_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == {self.group1}

    def test_last_seen_filter_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:<=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:>%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set()

        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": (self.group1.last_seen + timedelta(days=1)).isoformat(),
                "message": "group1",
                "stacktrace": {"frames": [{"module": "group1"}]},
                "environment": "development",
            },
            project_id=self.project.id,
        )

        self.group1.update(last_seen=self.group1.last_seen + timedelta(days=1))

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:>%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="lastSeen:>%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == {self.group1}

    def test_date_filter(self):
        results = self.make_query(
            date_from=self.event2.datetime,
            search_filter_query="timestamp:>=%s" % date_to_query_format(self.event2.datetime),
        )
        assert set(results) == {self.group1, self.group2}

        results = self.make_query(
            date_to=self.event1.datetime + timedelta(minutes=1),
            search_filter_query="timestamp:<=%s"
            % date_to_query_format(self.event1.datetime + timedelta(minutes=1)),
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query="timestamp:>=%s timestamp:<=%s"
            % (
                date_to_query_format(self.event1.datetime),
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)),
            ),
        )
        assert set(results) == {self.group1, self.group2}

        # Test with `Z` utc marker, should be equivalent
        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query="timestamp:>=%s timestamp:<=%s"
            % (
                date_to_query_format(self.event1.datetime) + "Z",
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)) + "Z",
            ),
        )
        assert set(results) == {self.group1, self.group2}

    def test_date_filter_with_environment(self):
        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            date_from=self.event2.datetime,
        )
        assert set(results) == {self.group1}

        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert set(results) == {self.group1}

        results = self.backend.query(
            [self.project],
            environments=[self.environments["staging"]],
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert set(results) == {self.group2}

    def test_linked(self):
        linked_group1 = self.create_group_with_integration_external_issue()
        linked_group2 = self.create_group_with_platform_external_issue()

        results = self.make_query(search_filter_query="is:unlinked")
        assert set(results) == {self.group1, self.group2}

        results = self.make_query(search_filter_query="is:linked")
        assert set(results) == {linked_group1, linked_group2}

    def test_linked_with_only_integration_external_issue(self):
        linked_group = self.create_group_with_integration_external_issue()

        results = self.make_query(search_filter_query="is:unlinked")
        assert set(results) == {self.group1, self.group2}

        results = self.make_query(search_filter_query="is:linked")
        assert set(results) == {linked_group}

    def test_linked_with_only_platform_external_issue(self):
        linked_group = self.create_group_with_platform_external_issue()

        results = self.make_query(search_filter_query="is:unlinked")
        assert set(results) == {self.group1, self.group2}

        results = self.make_query(search_filter_query="is:linked")
        assert set(results) == {linked_group}

    def test_linked_with_environment(self):
        linked_group1 = self.create_group_with_integration_external_issue(environment="production")
        linked_group2 = self.create_group_with_platform_external_issue(environment="staging")

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:unlinked"
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:unlinked"
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:linked"
        )
        assert set(results) == {linked_group1}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:linked"
        )
        assert set(results) == {linked_group2}

    def test_unassigned(self):
        results = self.make_query(search_filter_query="is:unassigned")
        assert set(results) == {self.group1}

        results = self.make_query(search_filter_query="is:assigned")
        assert set(results) == {self.group2}

    def test_unassigned_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:unassigned"
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:assigned"
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:assigned"
        )
        assert set(results) == set()

    def test_assigned_to(self):
        results = self.make_query(search_filter_query="assigned:%s" % self.user.username)
        assert set(results) == {self.group2}

        # test team assignee
        ga = GroupAssignee.objects.get(
            user_id=self.user.id, group=self.group2, project=self.group2.project
        )
        ga.update(team=self.team, user_id=None)
        assert GroupAssignee.objects.get(id=ga.id).user_id is None

        results = self.make_query(search_filter_query="assigned:%s" % self.user.username)
        assert set(results) == set()

        # test when there should be no results
        other_user = self.create_user()
        results = self.make_query(search_filter_query="assigned:%s" % other_user.username)
        assert set(results) == set()

        owner = self.create_user()
        self.create_member(
            organization=self.project.organization, user=owner, role="owner", teams=[]
        )

        # test that owners don't see results for all teams
        results = self.make_query(search_filter_query="assigned:%s" % owner.username)
        assert set(results) == set()

    def test_assigned_to_me_my_teams(self):
        my_team_group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-my-teams"],
                "event_id": "f" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "message": "baz",
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
                "level": "error",
            },
            project_id=self.project.id,
        ).group

        # assign the issue to my team instead of me
        GroupAssignee.objects.create(
            user_id=None, team_id=self.team.id, group=my_team_group, project=my_team_group.project
        )

        self.run_test_query(
            "assigned:me",
            [self.group2],
            user=self.user,
        )
        assert not GroupAssignee.objects.filter(user_id=self.user.id, group=my_team_group).exists()

        self.run_test_query(
            "assigned:my_teams",
            [my_team_group],
            user=self.user,
        )

    def test_assigned_to_me_my_teams_in_syntax(self):
        my_team_group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-my-teams"],
                "event_id": "f" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "message": "baz",
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
                "level": "error",
            },
            project_id=self.project.id,
        ).group

        # assign the issue to my team instead of me
        GroupAssignee.objects.create(
            user_id=None, team_id=self.team.id, group=my_team_group, project=my_team_group.project
        )

        self.run_test_query(
            "assigned:[me]",
            [self.group2],
            user=self.user,
        )
        assert not GroupAssignee.objects.filter(user_id=self.user.id, group=my_team_group).exists()

        self.run_test_query(
            "assigned:[me]",
            [self.group2],
            user=self.user,
        )
        self.run_test_query(
            "assigned:[my_teams]",
            [my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned:[me, my_teams]",
            [self.group2, my_team_group],
            user=self.user,
        )

    def test_assigned_to_in_syntax(self):
        group_3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group3"],
                "event_id": "c" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            },
            project_id=self.project.id,
        ).group
        group_3.status = GroupStatus.MUTED
        group_3.substatus = None
        group_3.save()
        other_user = self.create_user()
        self.run_test_query(
            f"assigned:[{self.user.username}, {other_user.username}]",
            [self.group2],
            [self.group1, group_3],
        )

        GroupAssignee.objects.create(project=self.project, group=group_3, user_id=other_user.id)
        self.run_test_query(
            f"assigned:[{self.user.username}, {other_user.username}]",
            [self.group2, group_3],
            [self.group1],
        )

        self.run_test_query(
            f"assigned:[#{self.team.slug}, {other_user.username}]",
            [group_3],
            [self.group1, self.group2],
        )

        ga_2 = GroupAssignee.objects.get(
            user_id=self.user.id, group=self.group2, project=self.group2.project
        )
        ga_2.update(team=self.team, user_id=None)
        self.run_test_query(
            f"assigned:[{self.user.username}, {other_user.username}]",
            [group_3],
            [self.group1, self.group2],
        )
        self.run_test_query(
            f"assigned:[#{self.team.slug}, {other_user.username}]",
            [self.group2, group_3],
            [self.group1],
        )

        self.run_test_query(
            f"assigned:[me, none, {other_user.username}]",
            [self.group1, group_3],
            [self.group2],
        )

    def test_assigned_or_suggested_in_syntax(self):
        Group.objects.all().delete()
        group = self.store_event(
            data={
                "timestamp": before_now(seconds=180).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        group1 = self.store_event(
            data={
                "timestamp": before_now(seconds=185).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        group2 = self.store_event(
            data={
                "timestamp": before_now(seconds=190).isoformat(),
                "fingerprint": ["group-3"],
            },
            project_id=self.project.id,
        ).group

        assigned_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        ).group

        assigned_to_other_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        ).group

        self.run_test_query(
            "assigned_or_suggested:[me]",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group],
        )

        GroupOwner.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        self.run_test_query(
            "assigned_or_suggested:[me]",
            [group, assigned_to_other_group],
            [group1, group2, assigned_group],
        )

        # Because assigned_to_other_event is assigned to self.other_user, it should not show up in assigned_or_suggested search for anyone but self.other_user. (aka. they are now the only owner)
        other_user = self.create_user("other@user.com", is_superuser=False)
        GroupAssignee.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            user_id=other_user.id,
        )
        self.run_test_query(
            "assigned_or_suggested:[me]",
            [group],
            [group1, group2, assigned_group, assigned_to_other_group],
        )

        self.run_test_query(
            f"assigned_or_suggested:[{other_user.email}]",
            [assigned_to_other_group],
            [group, group1, group2, assigned_group],
        )

        GroupAssignee.objects.create(
            group=assigned_group, project=self.project, user_id=self.user.id
        )
        self.run_test_query(
            f"assigned_or_suggested:[{self.user.email}]",
            [assigned_group, group],
        )

        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=self.team.id,
            user_id=None,
        )
        self.run_test_query(
            f"assigned_or_suggested:[#{self.team.slug}]",
            [group],
        )

        self.run_test_query(
            "assigned_or_suggested:[me, none]",
            [group, group1, group2, assigned_group],
            [assigned_to_other_group],
        )

        not_me = self.create_user(email="notme@sentry.io")
        GroupOwner.objects.create(
            group=group2,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=not_me.id,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, none]",
            [group, group1, assigned_group],
            [assigned_to_other_group, group2],
        )
        GroupOwner.objects.filter(group=group, user_id=self.user.id).delete()
        self.run_test_query(
            f"assigned_or_suggested:[me, none, #{self.team.slug}]",
            [group, group1, assigned_group],
            [assigned_to_other_group, group2],
        )
        self.run_test_query(
            f"assigned_or_suggested:[me, none, #{self.team.slug}, {not_me.email}]",
            [group, group1, assigned_group, group2],
            [assigned_to_other_group],
        )

    def test_assigned_or_suggested_my_teams(self):
        Group.objects.all().delete()
        group = self.store_event(
            data={
                "timestamp": before_now(seconds=180).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        group1 = self.store_event(
            data={
                "timestamp": before_now(seconds=185).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        group2 = self.store_event(
            data={
                "timestamp": before_now(seconds=190).isoformat(),
                "fingerprint": ["group-3"],
            },
            project_id=self.project.id,
        ).group
        assigned_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        ).group
        assigned_to_other_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        ).group
        my_team_group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-my-teams"],
                "event_id": "f" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "message": "baz",
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
                "level": "error",
            },
            project_id=self.project.id,
        ).group

        self.run_test_query(
            "assigned_or_suggested:me",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group, my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:my_teams",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group, my_team_group],
            user=self.user,
        )

        GroupOwner.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupAssignee.objects.create(
            user_id=None, team_id=self.team.id, group=my_team_group, project=my_team_group.project
        )

        self.run_test_query(
            "assigned_or_suggested:me",
            [group, assigned_to_other_group],
            [group1, group2, assigned_group, my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:my_teams",
            [my_team_group],
            [group, group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )

        # Because assigned_to_other_event is assigned to self.other_user, it should not show up in assigned_or_suggested search for anyone but self.other_user. (aka. they are now the only owner)
        other_user = self.create_user("other@user.com", is_superuser=False)
        GroupAssignee.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            user_id=other_user.id,
        )

        self.run_test_query(
            "assigned_or_suggested:me",
            [group],
            [group1, group2, assigned_group, my_team_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:my_teams",
            [my_team_group],
            [group, group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:{other_user.email}",
            [assigned_to_other_group],
            [group, group1, group2, assigned_group, my_team_group],
            user=self.user,
        )

        GroupAssignee.objects.create(
            group=assigned_group, project=self.project, user_id=self.user.id
        )

        self.run_test_query(
            f"assigned_or_suggested:{self.user.email}",
            [assigned_group, group],
            [group1, group2, my_team_group, assigned_to_other_group],
            user=self.user,
        )

        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=self.team.id,
            user_id=None,
        )

        self.run_test_query(
            f"assigned_or_suggested:#{self.team.slug}",
            [group, my_team_group],
            [group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )

    def test_assigned_or_suggested_my_teams_in_syntax(self):
        Group.objects.all().delete()
        group = self.store_event(
            data={
                "timestamp": before_now(seconds=180).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        group1 = self.store_event(
            data={
                "timestamp": before_now(seconds=185).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        group2 = self.store_event(
            data={
                "timestamp": before_now(seconds=190).isoformat(),
                "fingerprint": ["group-3"],
            },
            project_id=self.project.id,
        ).group
        assigned_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        ).group
        assigned_to_other_group = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        ).group
        my_team_group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-my-teams"],
                "event_id": "f" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
                "message": "baz",
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
                "level": "error",
            },
            project_id=self.project.id,
        ).group

        self.run_test_query(
            "assigned_or_suggested:[me]",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group, my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[my_teams]",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group, my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, my_teams]",
            [],
            [group, group1, group2, assigned_group, assigned_to_other_group, my_team_group],
            user=self.user,
        )

        GroupOwner.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupAssignee.objects.create(
            user_id=None, team_id=self.team.id, group=my_team_group, project=my_team_group.project
        )

        self.run_test_query(
            "assigned_or_suggested:[me]",
            [group, assigned_to_other_group],
            [group1, group2, assigned_group, my_team_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[my_teams]",
            [my_team_group],
            [group, group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, my_teams]",
            [group, assigned_to_other_group, my_team_group],
            [group1, group2, assigned_group],
            user=self.user,
        )

        # Because assigned_to_other_event is assigned to self.other_user, it should not show up in assigned_or_suggested search for anyone but self.other_user. (aka. they are now the only owner)
        other_user = self.create_user("other@user.com", is_superuser=False)
        GroupAssignee.objects.create(
            group=assigned_to_other_group,
            project=self.project,
            user_id=other_user.id,
        )

        self.run_test_query(
            "assigned_or_suggested:[me]",
            [group],
            [group1, group2, assigned_group, my_team_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[my_teams]",
            [my_team_group],
            [group, group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, my_teams]",
            [group, my_team_group],
            [group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[{other_user.email}]",
            [assigned_to_other_group],
            [group, group1, group2, assigned_group, my_team_group],
            user=self.user,
        )

        GroupAssignee.objects.create(
            group=assigned_group, project=self.project, user_id=self.user.id
        )

        self.run_test_query(
            f"assigned_or_suggested:[{self.user.email}]",
            [assigned_group, group],
            [group1, group2, my_team_group, assigned_to_other_group],
            user=self.user,
        )

        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=self.team.id,
            user_id=None,
        )

        self.run_test_query(
            f"assigned_or_suggested:[#{self.team.slug}]",
            [group, my_team_group],
            [group1, group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, none]",
            [group, group1, group2, assigned_group],
            [my_team_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[my_teams, none]",
            [group, group1, group2, my_team_group],
            [assigned_to_other_group, assigned_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, my_teams, none]",
            [group, group1, group2, my_team_group, assigned_group],
            [assigned_to_other_group],
            user=self.user,
        )

        not_me = self.create_user(email="notme@sentry.io")
        GroupOwner.objects.create(
            group=group2,
            project=self.project,
            organization=self.organization,
            type=0,
            team_id=None,
            user_id=not_me.id,
        )

        self.run_test_query(
            "assigned_or_suggested:[me, none]",
            [group, group1, assigned_group],
            [group2, my_team_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[my_teams, none]",
            [group, group1, my_team_group],
            [group2, assigned_group, assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            "assigned_or_suggested:[me, my_teams, none]",
            [group, group1, my_team_group, assigned_group],
            [group2, assigned_to_other_group],
            user=self.user,
        )

        GroupOwner.objects.filter(group=group, user_id=self.user.id).delete()

        self.run_test_query(
            f"assigned_or_suggested:[me, none, #{self.team.slug}]",
            [group, group1, assigned_group, my_team_group],
            [assigned_to_other_group, group2],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[my_teams, none, #{self.team.slug}]",
            [group, group1, my_team_group],
            [assigned_to_other_group, group2, assigned_group],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[me, my_teams, none, #{self.team.slug}]",
            [group, group1, my_team_group, assigned_group],
            [assigned_to_other_group, group2],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[me, none, #{self.team.slug}, {not_me.email}]",
            [group, group1, group2, assigned_group, my_team_group],
            [assigned_to_other_group],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[my_teams, none, #{self.team.slug}, {not_me.email}]",
            [group, group1, group2, my_team_group],
            [assigned_to_other_group, assigned_group],
            user=self.user,
        )
        self.run_test_query(
            f"assigned_or_suggested:[me, my_teams, none, #{self.team.slug}, {not_me.email}]",
            [group, group1, group2, my_team_group, assigned_group],
            [assigned_to_other_group],
            user=self.user,
        )

    def test_assigned_to_with_environment(self):
        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="assigned:%s" % self.user.username,
        )
        assert set(results) == {self.group2}

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="assigned:%s" % self.user.username,
        )
        assert set(results) == set()

    def test_subscribed_by(self):
        results = self.make_query(
            [self.group1.project], search_filter_query="subscribed:%s" % self.user.username
        )
        assert set(results) == {self.group1}

    def test_subscribed_by_in_syntax(self):
        self.run_test_query(f"subscribed:[{self.user.username}]", [self.group1], [self.group2])
        user_2 = self.create_user()
        GroupSubscription.objects.create(
            user_id=user_2.id, group=self.group2, project=self.project, is_active=True
        )
        self.run_test_query(
            f"subscribed:[{self.user.username}, {user_2.username}]", [self.group1, self.group2], []
        )

    def test_subscribed_by_with_environment(self):
        results = self.make_query(
            [self.group1.project],
            environments=[self.environments["production"]],
            search_filter_query="subscribed:%s" % self.user.username,
        )
        assert set(results) == {self.group1}

        results = self.make_query(
            [self.group1.project],
            environments=[self.environments["staging"]],
            search_filter_query="subscribed:%s" % self.user.username,
        )
        assert set(results) == set()

    @mock.patch("sentry.search.snuba.executors.bulk_raw_query_with_override")
    def test_snuba_not_called_optimization(self, query_mock):
        assert self.make_query(search_filter_query="status:unresolved").results == [self.group1]
        assert not query_mock.called

        assert (
            self.make_query(
                search_filter_query="last_seen:>%s" % date_to_query_format(timezone.now()),
                sort_by="date",
            ).results
            == []
        )
        assert query_mock.called

    @mock.patch("sentry.search.snuba.executors.bulk_raw_query_with_override")
    def test_reduce_bulk_results_none_total(self, bulk_raw_query_mock):
        bulk_raw_query_mock.return_value = [
            {"data": [], "totals": {"total": None}},
            {"data": [], "totals": {"total": None}},
        ]

        assert (
            self.make_query(
                search_filter_query="last_seen:>%s" % date_to_query_format(timezone.now()),
                sort_by="date",
            ).results
            == []
        )
        assert bulk_raw_query_mock.called

    @mock.patch("sentry.search.snuba.executors.bulk_raw_query_with_override")
    def test_reduce_bulk_results_none_data(self, bulk_raw_query_mock):
        bulk_raw_query_mock.return_value = [
            {"data": None, "totals": {"total": 0}},
            {"data": None, "totals": {"total": 0}},
        ]

        assert (
            self.make_query(
                search_filter_query="last_seen:>%s" % date_to_query_format(timezone.now()),
                sort_by="date",
            ).results
            == []
        )
        assert bulk_raw_query_mock.called

    def test_pre_and_post_filtering(self):
        prev_max_pre = options.get("snuba.search.max-pre-snuba-candidates")
        options.set("snuba.search.max-pre-snuba-candidates", 1)
        try:
            # normal queries work as expected
            results = self.make_query(search_filter_query="foo")
            assert set(results) == {self.group1}
            results = self.make_query(search_filter_query="bar")
            assert set(results) == {self.group2}

            # no candidate matches in Sentry, immediately return empty paginator
            results = self.make_query(search_filter_query="NO MATCHES IN SENTRY")
            assert set(results) == set()

            # too many candidates, skip pre-filter, requires >1 postfilter queries
            results = self.make_query()
            assert set(results) == {self.group1, self.group2}
        finally:
            options.set("snuba.search.max-pre-snuba-candidates", prev_max_pre)

    def test_optimizer_enabled(self):
        prev_optimizer_enabled = options.get("snuba.search.pre-snuba-candidates-optimizer")
        options.set("snuba.search.pre-snuba-candidates-optimizer", True)

        try:
            results = self.make_query(
                search_filter_query="server:example.com",
                environments=[self.environments["production"]],
            )
            assert set(results) == {self.group1}
        finally:
            options.set("snuba.search.pre-snuba-candidates-optimizer", prev_optimizer_enabled)

    def test_search_out_of_range(self):
        the_date = datetime(2000, 1, 1, 0, 0, 0, tzinfo=UTC)
        results = self.make_query(
            search_filter_query=f"event.timestamp:>{the_date} event.timestamp:<{the_date}",
            date_from=the_date,
            date_to=the_date,
        )
        assert set(results) == set()

    def test_regressed_in_release(self):
        # expect no groups within the results since there are no releases
        results = self.make_query(search_filter_query="regressed_in_release:fake")
        assert set(results) == set()

        # expect no groups even though there is a release; since no group regressed in this release
        release_1 = self.create_release()

        results = self.make_query(search_filter_query="regressed_in_release:%s" % release_1.version)
        assert set(results) == set()

        # Create a new event so that we get a group in this release
        group = self.store_event(
            data={
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group

        # # Should still be no group since we didn't regress in this release
        results = self.make_query(search_filter_query="regressed_in_release:%s" % release_1.version)
        assert set(results) == set()

        record_group_history(group, GroupHistoryStatus.REGRESSED, release=release_1)
        results = self.make_query(search_filter_query="regressed_in_release:%s" % release_1.version)
        assert set(results) == {group}

        # Make sure this works correctly with multiple releases
        release_2 = self.create_release()
        group_2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group9001"],
                "event_id": "a" * 32,
                "release": release_2.version,
            },
            project_id=self.project.id,
        ).group
        record_group_history(group_2, GroupHistoryStatus.REGRESSED, release=release_2)

        results = self.make_query(search_filter_query="regressed_in_release:%s" % release_1.version)
        assert set(results) == {group}
        results = self.make_query(search_filter_query="regressed_in_release:%s" % release_2.version)
        assert set(results) == {group_2}

    def test_first_release(self):
        # expect no groups within the results since there are no releases

        results = self.make_query(search_filter_query="first_release:%s" % "fake")
        assert set(results) == set()

        # expect no groups even though there is a release; since no group
        # is attached to a release

        release_1 = self.create_release(self.project)

        results = self.make_query(search_filter_query="first_release:%s" % release_1.version)
        assert set(results) == set()

        # Create a new event so that we get a group in this release
        group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group9001"],
                "event_id": "a" * 32,
                "message": "hello",
                "environment": "production",
                "tags": {"server": "example.com"},
                "release": release_1.version,
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        ).group

        results = self.make_query(search_filter_query="first_release:%s" % release_1.version)
        assert set(results) == {group}

    def test_first_release_in_syntax(self):
        # expect no groups within the results since there are no releases
        self.run_test_query("first_release:[fake, fake2]", [])

        # expect no groups even though there is a release; since no group
        # is attached to a release
        release_1 = self.create_release(self.project)
        release_2 = self.create_release(self.project)

        self.run_test_query(f"first_release:[{release_1.version}, {release_2.version}]", [])

        # Create a new event so that we get a group in release 1
        group = self.store_event(
            data={
                "fingerprint": ["put-me-in-group9001"],
                "event_id": "a" * 32,
                "message": "hello",
                "environment": "production",
                "tags": {"server": "example.com"},
                "release": release_1.version,
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        ).group

        self.run_test_query(
            f"first_release:[{release_1.version}, {release_2.version}]",
            [group],
            [self.group1, self.group2],
        )

        # Create a new event so that we get a group in release 2
        group_2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group9002"],
                "event_id": "a" * 32,
                "message": "hello",
                "environment": "production",
                "tags": {"server": "example.com"},
                "release": release_2.version,
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        ).group

        self.run_test_query(
            f"first_release:[{release_1.version}, {release_2.version}]",
            [group, group_2],
            [self.group1, self.group2],
        )

    def test_first_release_environments(self):
        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="first_release:fake",
        )
        assert set(results) == set()

        release = self.create_release(self.project)
        group_env = GroupEnvironment.get_or_create(
            group_id=self.group1.id, environment_id=self.environments["production"].id
        )[0]

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query=f"first_release:{release.version}",
        )
        assert set(results) == set()

        group_env.first_release = release
        group_env.save()

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query=f"first_release:{release.version}",
        )
        assert set(results) == {self.group1}

    def test_first_release_environments_in_syntax(self):
        self.run_test_query(
            "first_release:[fake, fake2]",
            [],
            [self.group1, self.group2],
            environments=[self.environments["production"]],
        )

        release = self.create_release(self.project)
        group_1_env = GroupEnvironment.objects.get(
            group_id=self.group1.id, environment_id=self.environments["production"].id
        )
        group_1_env.update(first_release=release)
        self.group1.first_release = release
        self.group1.save()

        self.run_test_query(
            f"first_release:[{release.version}, fake2]",
            [self.group1],
            [self.group2],
            environments=[self.environments["production"]],
        )

        group_2_env = GroupEnvironment.objects.get(
            group_id=self.group2.id, environment_id=self.environments["staging"].id
        )
        group_2_env.update(first_release=release)
        self.group2.first_release = release
        self.group2.save()

        self.run_test_query(
            f"first_release:[{release.version}, fake2]",
            [self.group1, self.group2],
            [],
            environments=[self.environments["production"], self.environments["staging"]],
        )

        # Make sure we don't get duplicate groups
        GroupEnvironment.objects.create(
            group_id=self.group1.id,
            environment_id=self.environments["staging"].id,
            first_release=release,
        )
        self.run_test_query(
            f"first_release:[{release.version}, fake2]",
            [self.group1, self.group2],
            [],
            environments=[self.environments["production"], self.environments["staging"]],
        )

    def test_query_enclosed_in_quotes(self):
        results = self.make_query(search_filter_query='"foo"')
        assert set(results) == {self.group1}

        results = self.make_query(search_filter_query='"bar"')
        assert set(results) == {self.group2}

    def test_wildcard(self):
        escaped_event = self.store_event(
            data={
                "fingerprint": ["hello-there"],
                "event_id": "f" * 32,
                "message": "somet[hing]",
                "environment": "production",
                "tags": {"server": "example.net"},
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        )
        # Note: Adding in `environment:production` so that we make sure we query
        # in both snuba and postgres
        results = self.make_query(search_filter_query="environment:production so*t")
        assert set(results) == {escaped_event.group}
        # Make sure it's case insensitive
        results = self.make_query(search_filter_query="environment:production SO*t")
        assert set(results) == {escaped_event.group}
        results = self.make_query(search_filter_query="environment:production so*zz")
        assert set(results) == set()
        results = self.make_query(search_filter_query="environment:production [hing]")
        assert set(results) == {escaped_event.group}
        results = self.make_query(search_filter_query="environment:production s*]")
        assert set(results) == {escaped_event.group}
        results = self.make_query(search_filter_query="environment:production server:example.*")
        assert set(results) == {self.group1, escaped_event.group}
        results = self.make_query(search_filter_query="environment:production !server:*net")
        assert set(results) == {self.group1}
        # TODO: Disabling tests that use [] syntax for the moment. Re-enable
        # these if we decide to add back in, or remove if this comment has been
        # here a while.
        # results = self.make_query(
        #     search_filter_query='environment:production [s][of][mz]',
        # )
        # assert set(results) == set([escaped_event.group])
        # results = self.make_query(
        #     search_filter_query='environment:production [z][of][mz]',
        # )
        # assert set(results) == set()

    def test_null_tags(self):
        tag_event = self.store_event(
            data={
                "fingerprint": ["hello-there"],
                "event_id": "f" * 32,
                "message": "something",
                "environment": "production",
                "tags": {"server": "example.net"},
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        )
        no_tag_event = self.store_event(
            data={
                "fingerprint": ["hello-there-2"],
                "event_id": "5" * 32,
                "message": "something",
                "environment": "production",
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group2"}]},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="environment:production !server:*net")
        assert set(results) == {self.group1, no_tag_event.group}
        results = self.make_query(search_filter_query="environment:production server:*net")
        assert set(results) == {tag_event.group}
        results = self.make_query(search_filter_query="environment:production !server:example.net")
        assert set(results) == {self.group1, no_tag_event.group}
        results = self.make_query(search_filter_query="environment:production server:example.net")
        assert set(results) == {tag_event.group}
        results = self.make_query(search_filter_query="environment:production has:server")
        assert set(results) == {self.group1, tag_event.group}
        results = self.make_query(search_filter_query="environment:production !has:server")
        assert set(results) == {no_tag_event.group}

    def test_null_promoted_tags(self):
        tag_event = self.store_event(
            data={
                "fingerprint": ["hello-there"],
                "event_id": "f" * 32,
                "message": "something",
                "environment": "production",
                "tags": {"logger": "csp"},
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        )
        no_tag_event = self.store_event(
            data={
                "fingerprint": ["hello-there-2"],
                "event_id": "5" * 32,
                "message": "something",
                "environment": "production",
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group2"}]},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="environment:production !logger:*sp")
        assert set(results) == {self.group1, no_tag_event.group}
        results = self.make_query(search_filter_query="environment:production logger:*sp")
        assert set(results) == {tag_event.group}
        results = self.make_query(search_filter_query="environment:production !logger:csp")
        assert set(results) == {self.group1, no_tag_event.group}
        results = self.make_query(search_filter_query="environment:production logger:csp")
        assert set(results) == {tag_event.group}
        results = self.make_query(search_filter_query="environment:production has:logger")
        assert set(results) == {tag_event.group}
        results = self.make_query(search_filter_query="environment:production !has:logger")
        assert set(results) == {self.group1, no_tag_event.group}

    def test_sort_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], sort_by="date")
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by="new")
        assert list(results) == [self.group2, self.group_p2, self.group1]

        results = self.make_query([self.project, self.project2], sort_by="freq")
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by="trends")
        assert list(results) == [
            self.group_p2,
            self.group2,
            self.group1,
        ]

        results = self.make_query([self.project, self.project2], sort_by="user")
        assert list(results) == [self.group1, self.group2, self.group_p2]

    def test_in_syntax_is_invalid(self):
        with pytest.raises(InvalidSearchQuery, match='"in" syntax invalid for "is" search'):
            self.make_query(search_filter_query="is:[unresolved, resolved]")

    def test_first_release_any_or_no_environments(self):
        # test scenarios for tickets:
        # SEN-571
        # ISSUE-432

        # given the following setup:
        #
        # groups table:
        # group    first_release
        # A        1
        # B        1
        # C        2
        #
        # groupenvironments table:
        # group    environment    first_release
        # A        staging        1
        # A        production     2
        #
        # when querying by first release, the appropriate set of groups should be displayed:
        #
        #     first_release: 1
        #         env=[]: A, B
        #         env=[production, staging]: A
        #         env=[staging]: A
        #         env=[production]: nothing
        #
        #     first_release: 2
        #         env=[]: C
        #         env=[production, staging]: A
        #         env=[staging]: nothing
        #         env=[production]: A

        # create an issue/group whose events that occur in 2 distinct environments

        group_a_event_1 = self.store_event(
            data={
                "fingerprint": ["group_a"],
                "event_id": "aaa" + ("1" * 29),
                "environment": "example_staging",
                "release": "release_1",
            },
            project_id=self.project.id,
        )

        group_a_event_2 = self.store_event(
            data={
                "fingerprint": ["group_a"],
                "event_id": "aaa" + ("2" * 29),
                "environment": "example_production",
                "release": "release_2",
            },
            project_id=self.project.id,
        )

        group_a = group_a_event_1.group

        # get the environments for group_a

        prod_env = group_a_event_2.get_environment()
        staging_env = group_a_event_1.get_environment()

        # create an issue/group whose event that occur in no environments
        # but will be tied to release release_1

        group_b_event_1 = self.store_event(
            data={
                "fingerprint": ["group_b"],
                "event_id": "bbb" + ("1" * 29),
                "release": "release_1",
            },
            project_id=self.project.id,
        )
        assert group_b_event_1.get_environment().name == ""  # has no environment

        group_b = group_b_event_1.group

        # create an issue/group whose event that occur in no environments
        # but will be tied to release release_2

        group_c_event_1 = self.store_event(
            data={
                "fingerprint": ["group_c"],
                "event_id": "ccc" + ("1" * 29),
                "release": "release_2",
            },
            project_id=self.project.id,
        )
        assert group_c_event_1.get_environment().name == ""  # has no environment

        group_c = group_c_event_1.group

        # query by release release_1

        results = self.make_query(search_filter_query="first_release:release_1")
        assert set(results) == {group_a, group_b}

        results = self.make_query(
            environments=[staging_env, prod_env],
            search_filter_query="first_release:release_1",
        )
        assert set(results) == {group_a}

        results = self.make_query(
            environments=[staging_env], search_filter_query="first_release:release_1"
        )
        assert set(results) == {group_a}

        results = self.make_query(
            environments=[prod_env], search_filter_query="first_release:release_1"
        )
        assert set(results) == set()

        # query by release release_2

        results = self.make_query(search_filter_query="first_release:release_2")
        assert set(results) == {group_c}

        results = self.make_query(
            environments=[staging_env, prod_env],
            search_filter_query="first_release:release_2",
        )
        assert set(results) == {group_a}

        results = self.make_query(
            environments=[staging_env], search_filter_query="first_release:release_2"
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[prod_env], search_filter_query="first_release:release_2"
        )
        assert set(results) == {group_a}

    @pytest.mark.skip(reason="test runs far too slowly, causing timeouts atm.")
    def test_all_fields_do_not_error(self):
        # Just a sanity check to make sure that all fields can be successfully
        # searched on without returning type errors and other schema related
        # issues.
        def test_query(query):
            self.make_query(search_filter_query=query)

        for key in SENTRY_SNUBA_MAP:
            if key in ["project.id", "issue.id", "performance.issue_ids", "status"]:
                continue
            test_query("has:%s" % key)
            test_query("!has:%s" % key)
            if key == "error.handled":
                val: Any = 1
            elif key in issue_search_config.numeric_keys:
                val = "123"
            elif key in issue_search_config.date_keys:
                val = self.base_datetime.isoformat()
            elif key in issue_search_config.boolean_keys:
                val = "true"
            elif key in {"trace.span", "trace.parent_span"}:
                val = "abcdef1234abcdef"
                test_query(f"!{key}:{val}")
            else:
                val = "abadcafedeadbeefdeaffeedabadfeed"
                test_query(f"!{key}:{val}")

            test_query(f"{key}:{val}")

    def test_message_negation(self):
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "2" * 32,
                "message": "something",
                "timestamp": self.base_datetime.isoformat(),
            },
            project_id=self.project.id,
        )

        results = self.make_query(search_filter_query="!message:else")
        results2 = self.make_query(search_filter_query="!message:else")

        assert list(results) == list(results2)

    def test_error_main_thread_true(self):
        myProject = self.create_project(
            name="Foo", slug="foo", teams=[self.team], fire_project_created=True
        )

        event = self.store_event(
            data={
                "event_id": "1" * 32,
                "message": "something",
                "timestamp": self.base_datetime.isoformat(),
                "exception": {
                    "values": [
                        {
                            "type": "SyntaxError",
                            "value": "hello world",
                            "thread_id": 1,
                        },
                    ],
                },
                "threads": {
                    "values": [
                        {
                            "id": 1,
                            "main": True,
                        },
                    ],
                },
            },
            project_id=myProject.id,
        )

        myGroup = event.groups[0]

        results = self.make_query(
            projects=[myProject],
            search_filter_query="error.main_thread:1",
            sort_by="date",
        )

        assert list(results) == [myGroup]

    def test_error_main_thread_false(self):
        myProject = self.create_project(
            name="Foo2", slug="foo2", teams=[self.team], fire_project_created=True
        )

        event = self.store_event(
            data={
                "event_id": "2" * 32,
                "message": "something",
                "timestamp": self.base_datetime.isoformat(),
                "exception": {
                    "values": [
                        {
                            "type": "SyntaxError",
                            "value": "hello world",
                            "thread_id": 1,
                        },
                    ],
                },
                "threads": {
                    "values": [
                        {
                            "id": 1,
                            "main": False,
                        },
                    ],
                },
            },
            project_id=myProject.id,
        )

        myGroup = event.groups[0]

        results = self.make_query(
            projects=[myProject],
            search_filter_query="error.main_thread:0",
            sort_by="date",
        )

        assert list(results) == [myGroup]

    def test_error_main_thread_no_results(self):
        myProject = self.create_project(
            name="Foo3", slug="foo3", teams=[self.team], fire_project_created=True
        )

        self.store_event(
            data={
                "event_id": "3" * 32,
                "message": "something",
                "timestamp": self.base_datetime.isoformat(),
                "exception": {
                    "values": [
                        {
                            "type": "SyntaxError",
                            "value": "hello world",
                            "thread_id": 1,
                        },
                    ],
                },
                "threads": {
                    "values": [
                        {
                            "id": 1,
                        },
                    ],
                },
            },
            project_id=myProject.id,
        )

        results = self.make_query(
            projects=[myProject],
            search_filter_query="error.main_thread:1",
            sort_by="date",
        )

        assert len(results) == 0


class EventsSnubaSearchTest(TestCase, EventsSnubaSearchTestCases):
    pass


@apply_feature_flag_on_cls("organizations:issue-search-group-attributes-side-query")
class EventsJoinedGroupAttributesSnubaSearchTest(TransactionTestCase, EventsSnubaSearchTestCases):
    def setUp(self):
        def post_insert(snapshot: GroupAttributesSnapshot) -> None:
            from sentry.utils import snuba

            resp = snuba._snuba_pool.urlopen(
                "POST",
                "/tests/entities/group_attributes/insert",
                body=json.dumps([snapshot]),
                headers={},
            )
            assert resp.status == 200

        with mock.patch("sentry.issues.attributes.produce_snapshot_to_kafka", post_insert):
            super().setUp()

    @mock.patch("sentry.utils.metrics.timer")
    @mock.patch("sentry.utils.metrics.incr")
    def test_is_unresolved_query_logs_metric(self, metrics_incr, metrics_timer):
        results = self.make_query(search_filter_query="is:unresolved")
        assert set(results) == {self.group1}

        # introduce a slight delay so the async future has time to run and log the metric
        time.sleep(1)

        metrics_incr_called = False
        for call in metrics_incr.call_args_list:
            args, kwargs = call
            if "snuba.search.group_attributes_joined.events_compared" in set(args):
                metrics_incr_called = True
        assert metrics_incr_called

        metrics_timer_called = False
        for call in metrics_timer.call_args_list:
            args, kwargs = call
            if "snuba.search.group_attributes_joined.duration" in set(args):
                metrics_timer_called = True
        assert metrics_timer_called

    def test_issue_priority(self):
        results = self.make_query(search_filter_query="issue.priority:high")
        assert set(results) == {self.group1, self.group2}

        event_3 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group3"],
                "event_id": "c" * 32,
                "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            },
            project_id=self.project.id,
        )
        group_3 = event_3.group
        group_3.update(priority=PriorityLevel.LOW)
        results = self.make_query(search_filter_query="issue.priority:low")
        assert set(results) == {group_3}

        results = self.make_query(search_filter_query="issue.priority:[high, low]")
        assert set(results) == {self.group1, self.group2, group_3}

        with pytest.raises(InvalidSearchQuery):
            self.make_query(search_filter_query="issue.category:wrong")


class EventsTrendsTest(TestCase, SharedSnubaMixin, OccurrenceTestMixin):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def test_trends_sort_old_and_new_events(self):
        """Test that an issue with only one old event is ranked lower than an issue with only one new event"""
        new_project = self.create_project(organization=self.project.organization)
        base_datetime = before_now(days=3)

        recent_event = self.store_event(
            data={
                "fingerprint": ["put-me-in-recent-group"],
                "event_id": "c" * 32,
                "message": "group1",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event3@example.com"},
                "timestamp": base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=new_project.id,
        )
        old_event = self.store_event(
            data={
                "fingerprint": ["put-me-in-old-group"],
                "event_id": "a" * 32,
                "message": "foo. Also, this message is intended to be greater than 256 characters so that we can put some unique string identifier after that point in the string. The purpose of this is in order to verify we are using snuba to search messages instead of Postgres (postgres truncates at 256 characters and clickhouse does not). santryrox.",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "old_event@example.com"},
                "timestamp": (base_datetime - timedelta(days=20)).isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=new_project.id,
        )
        # datetime(2017, 9, 6, 0, 0)
        old_event.data["timestamp"] = 1504656000.0

        weights: TrendsSortWeights = {
            "log_level": 0,
            "has_stacktrace": 0,
            "relative_volume": 1,
            "event_halflife_hours": 4,
            "issue_halflife_hours": 24 * 7,
            "v2": False,
            "norm": False,
        }
        results = self.make_query(
            sort_by="trends",
            projects=[new_project],
            aggregate_kwargs=weights,
        )
        recent_group = Group.objects.get(id=recent_event.group.id)
        old_group = Group.objects.get(id=old_event.group.id)
        assert list(results) == [recent_group, old_group]

    def test_trends_sort_v2(self):
        """Test that the v2 formula works."""
        new_project = self.create_project(organization=self.project.organization)
        base_datetime = before_now(days=3)

        recent_event = self.store_event(
            data={
                "fingerprint": ["put-me-in-recent-group"],
                "event_id": "c" * 32,
                "message": "group1",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event3@example.com"},
                "timestamp": base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=new_project.id,
        )
        old_event = self.store_event(
            data={
                "fingerprint": ["put-me-in-old-group"],
                "event_id": "a" * 32,
                "message": "foo. Also, this message is intended to be greater than 256 characters so that we can put some unique string identifier after that point in the string. The purpose of this is in order to verify we are using snuba to search messages instead of Postgres (postgres truncates at 256 characters and clickhouse does not). santryrox.",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "old_event@example.com"},
                "timestamp": (base_datetime - timedelta(days=20)).isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=new_project.id,
        )
        # datetime(2017, 9, 6, 0, 0)
        old_event.data["timestamp"] = 1504656000.0

        weights: TrendsSortWeights = {
            "log_level": 0,
            "has_stacktrace": 0,
            "relative_volume": 1,
            "event_halflife_hours": 4,
            "issue_halflife_hours": 24 * 7,
            "v2": True,
            "norm": False,
        }
        results = self.make_query(
            sort_by="trends",
            projects=[new_project],
            aggregate_kwargs=weights,
        )
        recent_group = Group.objects.get(id=recent_event.group.id)
        old_group = Group.objects.get(id=old_event.group.id)
        assert list(results) == [recent_group, old_group]

    def test_trends_log_level_results(self):
        """Test that the scoring results change when we pass in different log level weights"""
        base_datetime = before_now(hours=1)
        event1 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "c" * 32,
                "timestamp": (base_datetime - timedelta(hours=1)).isoformat(),
                "message": "foo",
                "stacktrace": {"frames": [{"module": "group1"}]},
                "environment": "staging",
                "level": "fatal",
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "event_id": "d" * 32,
                "timestamp": base_datetime.isoformat(),
                "message": "bar",
                "stacktrace": {"frames": [{"module": "group2"}]},
                "environment": "staging",
                "level": "error",
            },
            project_id=self.project.id,
        )
        group1 = Group.objects.get(id=event1.group.id)
        group2 = Group.objects.get(id=event2.group.id)

        agg_kwargs = {
            "trends": {
                "log_level": 0,
                "has_stacktrace": 0,
                "relative_volume": 1,
                "event_halflife_hours": 4,
                "issue_halflife_hours": 24 * 7,
                "v2": False,
                "norm": False,
            }
        }
        query_executor = self.backend._get_query_executor()
        results_zero_log_level = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score_before = results_zero_log_level[0][1]
        group2_score_before = results_zero_log_level[1][1]
        # initially group 2's score is higher since it has a more recent event
        assert group2_score_before > group1_score_before

        agg_kwargs["trends"].update({"log_level": 5})

        results2 = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score_after = results2[0][1]
        group2_score_after = results2[1][1]
        # ensure fatal has a higher score than error
        assert group1_score_after > group2_score_after

    def test_trends_has_stacktrace_results(self):
        """Test that the scoring results change when we pass in different has_stacktrace weights"""
        base_datetime = before_now(hours=1)
        agg_kwargs = {
            "trends": {
                "log_level": 0,
                "has_stacktrace": 0,
                "relative_volume": 1,
                "event_halflife_hours": 4,
                "issue_halflife_hours": 24 * 7,
                "v2": False,
                "norm": False,
            }
        }
        query_executor = self.backend._get_query_executor()

        no_stacktrace_event = self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "oh no",
                "timestamp": (base_datetime - timedelta(hours=1)).isoformat(),
            },
            project_id=self.project.id,
        )
        group1 = Group.objects.get(id=no_stacktrace_event.group.id)

        stacktrace_event = self.store_event(
            data={
                "event_id": "d" * 32,
                "exception": {
                    "values": [
                        {
                            "type": "AnError",
                            "value": "Bad request",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "module": "<my module>",
                                    },
                                ]
                            },
                        }
                    ]
                },
                "timestamp": (base_datetime - timedelta(hours=1)).isoformat(),
            },
            project_id=self.project.id,
        )
        group2 = Group.objects.get(id=stacktrace_event.group.id)

        results = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score = results[0][1]
        group2_score = results[1][1]
        assert group1_score == group2_score

        agg_kwargs["trends"].update({"has_stacktrace": 3})
        results = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score = results[0][1]
        group2_score = results[1][1]
        # check that a group with an event with a stacktrace has a higher weight than one without
        assert group1_score < group2_score

    def test_trends_event_halflife_results(self):
        """Test that the scoring results change when we pass in different event halflife weights"""
        base_datetime = before_now(hours=1)
        event1 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "a" * 32,
                "timestamp": (base_datetime - timedelta(hours=1)).isoformat(),
                "message": "foo",
                "stacktrace": {"frames": [{"module": "group1"}]},
                "environment": "staging",
                "level": "fatal",
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "event_id": "b" * 32,
                "timestamp": base_datetime.isoformat(),
                "message": "bar",
                "stacktrace": {"frames": [{"module": "group2"}]},
                "environment": "staging",
                "level": "error",
            },
            project_id=self.project.id,
        )
        group1 = Group.objects.get(id=event1.group.id)
        group2 = Group.objects.get(id=event2.group.id)

        agg_kwargs = {
            "trends": {
                "log_level": 0,
                "has_stacktrace": 0,
                "relative_volume": 1,
                "event_halflife_hours": 4,
                "issue_halflife_hours": 24 * 7,
                "v2": False,
                "norm": False,
            }
        }
        query_executor = self.backend._get_query_executor()
        results = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score_before = results[0][1]
        group2_score_before = results[1][1]
        # initially group 2's score is higher since it has a more recent event
        assert group2_score_before > group1_score_before

        agg_kwargs["trends"].update({"event_halflife_hours": 2})
        results = query_executor.snuba_search(
            start=None,
            end=None,
            project_ids=[self.project.id],
            environment_ids=[],
            sort_field="trends",
            organization=self.organization,
            group_ids=[group1.id, group2.id],
            limit=150,
            aggregate_kwargs=agg_kwargs,
        )[0]
        group1_score_after = results[0][1]
        group2_score_after = results[1][1]
        assert group1_score_after < group2_score_after

    def test_trends_mixed_group_types(self):
        base_datetime = before_now(hours=1)

        error_event = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "a" * 32,
                "timestamp": (base_datetime - timedelta(hours=1)).isoformat(),
                "message": "foo",
                "stacktrace": {"frames": [{"module": "group1"}]},
                "environment": "staging",
                "level": "fatal",
            },
            project_id=self.project.id,
        )
        error_group = error_event.group

        profile_event_id = uuid.uuid4().hex
        _, group_info = self.process_occurrence(
            event_id=profile_event_id,
            project_id=self.project.id,
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"my_tag": "1"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        profile_group_1 = group_info.group

        agg_kwargs = {
            "trends": {
                "log_level": 0,
                "has_stacktrace": 0,
                "relative_volume": 1,
                "event_halflife_hours": 4,
                "issue_halflife_hours": 24 * 7,
                "v2": False,
                "norm": False,
            }
        }
        query_executor = self.backend._get_query_executor()
        with self.feature(
            [
                ProfileFileIOGroupType.build_visible_feature_name(),
            ]
        ):
            results = query_executor.snuba_search(
                start=None,
                end=None,
                project_ids=[self.project.id],
                environment_ids=[],
                sort_field="trends",
                organization=self.organization,
                group_ids=[profile_group_1.id, error_group.id],
                limit=150,
                aggregate_kwargs=agg_kwargs,
            )[0]
        error_group_score = results[0][1]
        profile_group_score = results[1][1]
        assert error_group_score > 0
        assert profile_group_score > 0


class EventsTransactionsSnubaSearchTest(TestCase, SharedSnubaMixin):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def setUp(self):
        super().setUp()
        self.base_datetime = before_now(days=3)

        transaction_event_data = {
            "level": "info",
            "message": "ayoo",
            "type": "transaction",
            "culprit": "app/components/events/eventEntries in map",
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        }
        with (
            mock.patch(
                "sentry.issues.ingest.send_issue_occurrence_to_eventstream",
                side_effect=send_issue_occurrence_to_eventstream,
            ) as mock_eventstream,
            mock.patch.object(
                PerformanceRenderBlockingAssetSpanGroupType,
                "noise_config",
                new=NoiseConfig(0, timedelta(minutes=1)),
            ),
        ):
            self.store_event(
                data={
                    **transaction_event_data,
                    "event_id": "a" * 32,
                    "timestamp": before_now(minutes=1).isoformat(),
                    "start_timestamp": (before_now(minutes=1, seconds=5)).isoformat(),
                    "tags": {"my_tag": 1},
                    "fingerprint": [
                        f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"
                    ],
                },
                project_id=self.project.id,
            )
            self.perf_group_1 = mock_eventstream.call_args[0][2].group

            self.store_event(
                data={
                    **transaction_event_data,
                    "event_id": "a" * 32,
                    "timestamp": before_now(minutes=2).isoformat(),
                    "start_timestamp": before_now(minutes=2, seconds=5).isoformat(),
                    "tags": {"my_tag": 1},
                    "fingerprint": [
                        f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group2"
                    ],
                },
                project_id=self.project.id,
            )
            self.perf_group_2 = mock_eventstream.call_args[0][2].group
        error_event_data = {
            "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            "message": "bar",
            "environment": "staging",
            "tags": {
                "server": "example.com",
                "url": "http://example.com",
                "sentry:user": "event2@example.com",
                "my_tag": 1,
            },
        }

        error_event = self.store_event(
            data={
                **error_event_data,
                "fingerprint": ["put-me-in-error_group_1"],
                "event_id": "c" * 32,
                "stacktrace": {"frames": [{"module": "error_group_1"}]},
            },
            project_id=self.project.id,
        )
        self.error_group_1 = error_event.group

        error_event_2 = self.store_event(
            data={
                **error_event_data,
                "fingerprint": ["put-me-in-error_group_2"],
                "event_id": "d" * 32,
                "stacktrace": {"frames": [{"module": "error_group_2"}]},
            },
            project_id=self.project.id,
        )
        self.error_group_2 = error_event_2.group

    def test_performance_query(self):
        with self.feature(
            [
                self.perf_group_1.issue_type.build_visible_feature_name(),
            ]
        ):
            results = self.make_query(search_filter_query="issue.category:performance my_tag:1")
            assert list(results) == [self.perf_group_1, self.perf_group_2]

            results = self.make_query(
                search_filter_query="issue.type:[performance_n_plus_one_db_queries, performance_render_blocking_asset_span] my_tag:1"
            )
            assert list(results) == [self.perf_group_1, self.perf_group_2]

    def test_performance_query_no_duplicates(self):
        # Regression test to catch an issue we had with performance issues showing duplicated in the
        # issue stream. This was  caused by us dual writing perf issues to transactions and to the
        # issue platform. We'd end up reading the same issue twice and duplicate it in the response.
        with self.feature(
            [
                self.perf_group_1.issue_type.build_visible_feature_name(),
            ]
        ):
            results = self.make_query(search_filter_query="!issue.category:error my_tag:1")
            assert list(results) == [self.perf_group_1, self.perf_group_2]

    def test_performance_issue_search_feature_off(self):
        with Feature({"organizations:performance-issues-search": False}):
            results = self.make_query(search_filter_query="issue.category:performance my_tag:1")
            assert list(results) == []
        with self.feature(
            [
                self.perf_group_1.issue_type.build_visible_feature_name(),
            ]
        ):
            results = self.make_query(search_filter_query="issue.category:performance my_tag:1")
            assert list(results) == [self.perf_group_1, self.perf_group_2]

    def test_error_performance_query(self):
        with self.feature(
            [
                self.perf_group_1.issue_type.build_visible_feature_name(),
            ]
        ):
            results = self.make_query(search_filter_query="my_tag:1")
            assert list(results) == [
                self.perf_group_1,
                self.perf_group_2,
                self.error_group_2,
                self.error_group_1,
            ]
            results = self.make_query(
                search_filter_query="issue.category:[performance, error] my_tag:1"
            )
            assert list(results) == [
                self.perf_group_1,
                self.perf_group_2,
                self.error_group_2,
                self.error_group_1,
            ]

            results = self.make_query(
                search_filter_query="issue.type:[performance_render_blocking_asset_span, error] my_tag:1"
            )
            assert list(results) == [
                self.perf_group_1,
                self.perf_group_2,
                self.error_group_2,
                self.error_group_1,
            ]

    def test_cursor_performance_issues(self):
        with self.feature(
            [
                self.perf_group_1.issue_type.build_visible_feature_name(),
            ]
        ):
            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            assert list(results) == [self.perf_group_1]
            assert results.hits == 2

            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                cursor=results.next,
                count_hits=True,
            )
            assert list(results) == [self.perf_group_2]
            assert results.hits == 2

            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                cursor=results.next,
                count_hits=True,
            )
            assert list(results) == []
            assert results.hits == 2

    def test_perf_issue_search_message_term_queries_postgres(self):
        from django.db.models import Q

        from sentry.utils import snuba

        transaction_name = "im a little tea pot"

        with (
            mock.patch(
                "sentry.issues.ingest.send_issue_occurrence_to_eventstream",
                side_effect=send_issue_occurrence_to_eventstream,
            ) as mock_eventstream,
            mock.patch.object(
                PerformanceRenderBlockingAssetSpanGroupType,
                "noise_config",
                new=NoiseConfig(0, timedelta(minutes=1)),
            ),
        ):
            tx = self.store_event(
                data={
                    "level": "info",
                    "culprit": "app/components/events/eventEntries in map",
                    "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
                    "fingerprint": [
                        f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group12"
                    ],
                    "event_id": "e" * 32,
                    "timestamp": self.base_datetime.isoformat(),
                    "start_timestamp": self.base_datetime.isoformat(),
                    "type": "transaction",
                    "transaction": transaction_name,
                },
                project_id=self.project.id,
            )
            assert "tea" in tx.search_message
            created_group = mock_eventstream.call_args[0][2].group

        find_group = Group.objects.filter(
            Q(type=PerformanceRenderBlockingAssetSpanGroupType.type_id, message__icontains="tea")
        ).first()

        assert created_group == find_group
        with self.feature(
            [
                created_group.issue_type.build_visible_feature_name(),
            ]
        ):
            result = snuba.raw_query(
                dataset=Dataset.IssuePlatform,
                start=self.base_datetime - timedelta(hours=1),
                end=self.base_datetime + timedelta(hours=1),
                selected_columns=[
                    "event_id",
                    "group_id",
                    "transaction_name",
                ],
                groupby=None,
                filter_keys={"project_id": [self.project.id], "event_id": [tx.event_id]},
                referrer="_insert_transaction.verify_transaction",
            )
            assert result["data"][0]["transaction_name"] == transaction_name
            assert result["data"][0]["group_id"] == created_group.id

            results = self.make_query(search_filter_query="issue.category:performance tea")
            assert set(results) == {created_group}

            results2 = self.make_query(search_filter_query="tea")
            assert set(results2) == {created_group}

    def test_search_message_error_and_perf_issues(self):
        with (
            mock.patch(
                "sentry.issues.ingest.send_issue_occurrence_to_eventstream",
                side_effect=send_issue_occurrence_to_eventstream,
            ) as mock_eventstream,
            mock.patch.object(
                PerformanceRenderBlockingAssetSpanGroupType,
                "noise_config",
                new=NoiseConfig(0, timedelta(minutes=1)),
            ),
        ):
            self.store_event(
                data={
                    "level": "info",
                    "culprit": "app/components/events/eventEntries in map",
                    "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
                    "fingerprint": [
                        f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group12"
                    ],
                    "event_id": "e" * 32,
                    "timestamp": self.base_datetime.isoformat(),
                    "start_timestamp": self.base_datetime.isoformat(),
                    "type": "transaction",
                    "transaction": "/api/0/events",
                },
                project_id=self.project.id,
            )
            perf_issue = mock_eventstream.call_args[0][2].group

        assert perf_issue

        error = self.store_event(
            data={
                "fingerprint": ["another-random-group"],
                "event_id": "d" * 32,
                "message": "Uncaught exception on api /api/0/events",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event3@example.com"},
                "timestamp": self.base_datetime.isoformat(),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        )
        error_issue = error.group
        assert error_issue

        assert error_issue != perf_issue

        with self.feature(
            [
                perf_issue.issue_type.build_visible_feature_name(),
            ]
        ):
            assert set(self.make_query(search_filter_query="is:unresolved /api/0/events")) == {
                perf_issue,
                error_issue,
            }

            assert set(self.make_query(search_filter_query="/api/0/events")) == {
                error_issue,
                perf_issue,
            }

    def test_compound_message_negation(self):
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "2" * 32,
                "message": "something",
                "timestamp": self.base_datetime.isoformat(),
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "level": "info",
                "culprit": "app/components/events/eventEntries in map",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
                "fingerprint": [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group12"],
                "event_id": "e" * 32,
                "timestamp": self.base_datetime.isoformat(),
                "start_timestamp": self.base_datetime.isoformat(),
                "type": "transaction",
                "transaction": "something",
            },
            project_id=self.project.id,
        )

        error_issues_only = self.make_query(
            search_filter_query="!message:else group.category:error"
        )
        error_and_perf_issues = self.make_query(search_filter_query="!message:else")

        assert set(error_and_perf_issues) > set(error_issues_only)


class EventsGenericSnubaSearchTest(TestCase, SharedSnubaMixin, OccurrenceTestMixin):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def setUp(self):
        super().setUp()
        self.base_datetime = before_now(days=3)

        event_id_1 = uuid.uuid4().hex
        _, group_info = self.process_occurrence(
            event_id=event_id_1,
            project_id=self.project.id,
            issue_title="File I/O on Main Thread",
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"my_tag": "1"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        self.profile_group_1 = group_info.group

        event_id_2 = uuid.uuid4().hex
        _, group_info = self.process_occurrence(
            event_id=event_id_2,
            project_id=self.project.id,
            fingerprint=["put-me-in-group-2"],
            issue_title="File I/O on Main Thread",
            event_data={
                "title": "some other problem",
                "platform": "python",
                "tags": {"my_tag": "1"},
                "timestamp": before_now(minutes=2).isoformat(),
                "received": before_now(minutes=2).isoformat(),
            },
        )
        assert group_info is not None
        self.profile_group_2 = group_info.group

        event_id_3 = uuid.uuid4().hex
        self.process_occurrence(
            event_id=event_id_3,
            project_id=self.project.id,
            fingerprint=["put-me-in-group-3"],
            event_data={
                "title": "some other problem",
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=2).isoformat(),
                "message_timestamp": before_now(minutes=2).isoformat(),
            },
        )

        error_event_data = {
            "timestamp": (self.base_datetime - timedelta(days=20)).isoformat(),
            "message": "bar",
            "environment": "staging",
            "tags": {
                "server": "example.com",
                "url": "http://example.com",
                "sentry:user": "event2@example.com",
                "my_tag": 1,
            },
        }

        error_event = self.store_event(
            data={
                **error_event_data,
                "fingerprint": ["put-me-in-error_group_1"],
                "event_id": "c" * 32,
                "stacktrace": {"frames": [{"module": "error_group_1"}]},
            },
            project_id=self.project.id,
        )
        self.error_group_1 = error_event.group

        error_event_2 = self.store_event(
            data={
                **error_event_data,
                "fingerprint": ["put-me-in-error_group_2"],
                "event_id": "d" * 32,
                "stacktrace": {"frames": [{"module": "error_group_2"}]},
            },
            project_id=self.project.id,
        )
        self.error_group_2 = error_event_2.group

    def test_no_feature(self):
        results = self.make_query(search_filter_query="issue.category:performance my_tag:1")
        assert list(results) == []

    def test_generic_query(self):
        with self.feature([ProfileFileIOGroupType.build_visible_feature_name()]):
            results = self.make_query(search_filter_query="issue.category:performance my_tag:1")
            assert list(results) == [self.profile_group_1, self.profile_group_2]
            results = self.make_query(
                search_filter_query="issue.type:profile_file_io_main_thread my_tag:1"
            )
            assert list(results) == [self.profile_group_1, self.profile_group_2]

    def test_generic_query_message(self):
        with self.feature([ProfileFileIOGroupType.build_visible_feature_name()]):
            results = self.make_query(search_filter_query="File I/O")
            assert list(results) == [self.profile_group_1, self.profile_group_2]

    def test_generic_query_perf(self):
        event_id = uuid.uuid4().hex
        group_type = PerformanceNPlusOneGroupType

        with mock.patch.object(
            PerformanceNPlusOneGroupType, "noise_config", new=NoiseConfig(0, timedelta(minutes=1))
        ):
            with self.feature(group_type.build_ingest_feature_name()):
                _, group_info = self.process_occurrence(
                    event_id=event_id,
                    project_id=self.project.id,
                    type=group_type.type_id,
                    fingerprint=["some perf issue"],
                    event_data={
                        "title": "some problem",
                        "platform": "python",
                        "tags": {"my_tag": "2"},
                        "timestamp": before_now(minutes=1).isoformat(),
                        "received": before_now(minutes=1).isoformat(),
                    },
                )
                assert group_info is not None

            with self.feature(
                [
                    group_type.build_visible_feature_name(),
                    "organizations:performance-issues-search",
                ]
            ):
                results = self.make_query(search_filter_query="issue.category:performance my_tag:2")
        assert list(results) == [group_info.group]

    def test_error_generic_query(self):
        with self.feature([ProfileFileIOGroupType.build_visible_feature_name()]):
            results = self.make_query(search_filter_query="my_tag:1")
            assert list(results) == [
                self.profile_group_1,
                self.profile_group_2,
                self.error_group_2,
                self.error_group_1,
            ]
            results = self.make_query(
                search_filter_query="issue.category:[performance, error] my_tag:1"
            )
            assert list(results) == [
                self.profile_group_1,
                self.profile_group_2,
                self.error_group_2,
                self.error_group_1,
            ]

            results = self.make_query(
                search_filter_query="issue.type:[profile_file_io_main_thread, error] my_tag:1"
            )
            assert list(results) == [
                self.profile_group_1,
                self.profile_group_2,
                self.error_group_2,
                self.error_group_1,
            ]

    def test_cursor_profile_issues(self):
        with self.feature([ProfileFileIOGroupType.build_visible_feature_name()]):
            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            assert list(results) == [self.profile_group_1]
            assert results.hits == 2

            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                cursor=results.next,
                count_hits=True,
            )
            assert list(results) == [self.profile_group_2]
            assert results.hits == 2

            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance my_tag:1",
                sort_by="date",
                limit=1,
                cursor=results.next,
                count_hits=True,
            )
            assert list(results) == []
            assert results.hits == 2

    def test_rejected_filters(self):
        """
        Any queries with `error.handled` or `error.unhandled` filters querying the search_issues dataset
        should be rejected and return empty results.
        """
        with self.feature([ProfileFileIOGroupType.build_visible_feature_name()]):
            results = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.unhandled:0",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            results2 = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.unhandled:1",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            result3 = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.handled:0",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            results4 = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.handled:1",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            results5 = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.main_thread:0",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            results6 = self.make_query(
                projects=[self.project],
                search_filter_query="issue.category:performance error.main_thread:1",
                sort_by="date",
                limit=1,
                count_hits=True,
            )

            assert (
                list(results)
                == list(results2)
                == list(result3)
                == list(results4)
                == list(results5)
                == list(results6)
                == []
            )

    def test_feedback_category_hidden_default(self):
        with self.feature([FeedbackGroup.build_visible_feature_name()]):
            event_id_1 = uuid.uuid4().hex
            self.process_occurrence(
                **{
                    "project_id": self.project.id,
                    "event_id": event_id_1,
                    "fingerprint": ["c" * 32],
                    "issue_title": "User Feedback",
                    "type": FeedbackGroup.type_id,
                    "detection_time": datetime.now().timestamp(),
                    "level": "info",
                },
                event_data={
                    "platform": "python",
                    "timestamp": before_now(minutes=1).isoformat(),
                    "received": before_now(minutes=1).isoformat(),
                },
            )
            results = self.make_query(
                date_from=self.base_datetime,
                date_to=self.base_datetime + timedelta(days=10),
            )
            assert set(results) == set()

    def test_feedback_category_show_when_filtered_on(self):
        with self.feature(
            [
                FeedbackGroup.build_visible_feature_name(),
                FeedbackGroup.build_ingest_feature_name(),
            ]
        ):
            event_id_1 = uuid.uuid4().hex
            _, group_info = self.process_occurrence(
                **{
                    "project_id": self.project.id,
                    "event_id": event_id_1,
                    "fingerprint": ["c" * 32],
                    "issue_title": "User Feedback",
                    "type": FeedbackGroup.type_id,
                    "detection_time": datetime.now().timestamp(),
                    "level": "info",
                },
                event_data={
                    "platform": "python",
                    "timestamp": before_now(minutes=1).isoformat(),
                    "received": before_now(minutes=1).isoformat(),
                },
            )
            results = self.make_query(
                search_filter_query="issue.category:feedback",
                date_from=self.base_datetime,
                date_to=self.base_datetime + timedelta(days=10),
            )
            assert group_info is not None
            assert list(results) == [group_info.group]
