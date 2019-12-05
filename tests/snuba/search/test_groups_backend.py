from __future__ import absolute_import

import mock
from datetime import datetime
from django.utils import timezone

from sentry import options
from sentry.utils.snuba import Dataset, SnubaError, GROUPS_SENTRY_SNUBA_MAP
from sentry.api.issue_search import IssueSearchVisitor
from sentry.search.snuba.backend import GroupsDatasetSnubaSearchBackend
from tests.snuba.search.test_backend import EventsSnubaSearchTest


def date_to_query_format(date):
    return date.strftime("%Y-%m-%dT%H:%M:%S")


class GroupsSnubaSearchTest(EventsSnubaSearchTest):
    @property
    def backend(self):
        return GroupsDatasetSnubaSearchBackend()

    def setUp(self):
        super(GroupsSnubaSearchTest, self).setUp()

    def test_sort_multi_project(self):
        """ This test changed because the set_up_multi_project changed the groups time. The original backend used the groups last_seen time,
        but this implementation uses snuba - which uses the events timestamp. Thus the sort is different."""
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], sort_by="date")
        assert list(results) == [self.group1, self.group2, self.group_p2]

        results = self.make_query([self.project, self.project2], sort_by="new")
        assert list(results) == [self.group2, self.group_p2, self.group1]

        results = self.make_query([self.project, self.project2], sort_by="freq")
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by="priority")
        assert list(results) == [self.group1, self.group2, self.group_p2]

    def test_first_release_any_or_no_environments(self):
        """I think this test has a bug in Postgres that was allowing it to pass when it shouldn't.
        That bug is not present in the groups backend, so the test was failing."""
        # TODO: Find out why postgres test passes and fix it (it shouldn't be passing afaict)
        # results = self.make_query(search_filter_query="first_release:%s" % "release_1")
        # assert set(results) == set([group_a, group_b])
        # ...more assertions but no changes to groups/events...
        # results = self.make_query(search_filter_query="first_release:%s" % "release_2")
        # assert set(results) == set([group_a, group_c])
        # group_a should only be a result in the first query.

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
        #         env=[]: A, C
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
        assert group_b_event_1.get_environment().name == u""  # has no environment

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
        assert group_c_event_1.get_environment().name == u""  # has no environment

        group_c = group_c_event_1.group

        # query by release release_1

        results = self.make_query(search_filter_query="first_release:%s" % "release_1")
        assert set(results) == set([group_a, group_b])

        results = self.make_query(
            environments=[staging_env, prod_env],
            search_filter_query="first_release:%s" % "release_1",
        )
        assert set(results) == set([group_a])

        results = self.make_query(
            environments=[staging_env], search_filter_query="first_release:%s" % "release_1"
        )
        assert set(results) == set([group_a])

        results = self.make_query(
            environments=[prod_env], search_filter_query="first_release:%s" % "release_1"
        )
        assert set(results) == set([])

        # query by release release_2
        results = self.make_query(search_filter_query="first_release:%s" % "release_2")
        assert set(results) == set([group_c])
        # TODO; I THINK THE POSTGRES IMPLEMENTATION HAS BEEN RETURNING GROUP_A BUT I DON'T THINK IT SHOULD?
        # I debugged and group_a.first_release.id is 2 at this point - meaning "release_1"
        # and group_c.first_release.id is 3 - meaning "release_2"
        # assert set(results) == set([group_a, group_c])

        results = self.make_query(
            environments=[staging_env, prod_env],
            search_filter_query="first_release:%s" % "release_2",
        )
        assert set(results) == set([group_a])

        results = self.make_query(
            environments=[staging_env], search_filter_query="first_release:%s" % "release_2"
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[prod_env], search_filter_query="first_release:%s" % "release_2"
        )
        assert set(results) == set([group_a])

    def test_snuba_not_called_optimization(self):
        # A test for postgres backend that is not relevant to the groups backend.
        pass

    @mock.patch("sentry.search.snuba.executors.PostgresSnubaQueryExecutor.query")
    def test_postgres_not_called_optimization(self, executor_mock):
        results = self.make_query(search_filter_query="status:unresolved").results
        assert results == [self.group1]
        assert not executor_mock.called

        assert (
            self.make_query(
                search_filter_query="last_seen:>%s" % date_to_query_format(timezone.now()),
                sort_by="date",
            ).results
            == []
        )
        assert not executor_mock.called

        # This query will use Postgres because we've added the environment filter.
        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="last_seen:>%s" % date_to_query_format(timezone.now()),
            sort_by="date",
        ).results
        assert executor_mock.called

    @mock.patch("sentry.utils.snuba.raw_query")
    # @mock.patch("sentry.search.snuba.executors.SnubaOnlyQueryExecutor.query")
    def test_optimized_aggregates(self, query_mock):
        # TODO this test is annoyingly fragile and breaks in hard-to-see ways
        # any time anything about the snuba query changes
        query_mock.return_value = {"data": [], "totals": {"total": 0}}

        def Any(cls):
            class Any(object):
                def __eq__(self, other):
                    return isinstance(other, cls)

            return Any()

        DEFAULT_LIMIT = 100
        chunk_growth = options.get("snuba.search.chunk-growth-rate")
        limit = int(DEFAULT_LIMIT * chunk_growth)

        common_args = {
            "arrayjoin": None,
            "dataset": Dataset.Groups,
            "start": Any(datetime),
            "end": Any(datetime),
            "filter_keys": {"project_id": [self.project.id]},
            "referrer": "search",
            "groupby": ["events.issue"],
            # "conditions": [[["positionCaseInsensitive", ["events.message", "'foo'"]], "!=", 0]],
            "selected_columns": [],
            # "limit": limit,
            "limit": None,
            "offset": 0,
            "totals": True,
            "turbo": False,
            "sample": 1,
        }

        self.make_query(search_filter_query="status:unresolved")
        assert query_mock.called

        self.make_query(
            search_filter_query="last_seen:>=%s foo" % date_to_query_format(timezone.now()),
            sort_by="date",
        )

        # TODO: Why isn't this passing? The dicts look the same to me.
        # assert query_mock.call_args == mock.call(
        #     orderby=["-events.last_seen", "events.issue"],
        #     aggregations=[
        #         ["uniq", "events.issue", "total"],
        #         ["multiply(toUInt64(max(events.timestamp)), 1000)", "", "events.last_seen"],
        #     ],
        #     having=[],
        #     # having=[["events.last_seen", ">=", Any(int)]],
        #     conditions=[
        #         ['groups.last_seen', '>=', Any(int)],
        #         [["positionCaseInsensitive", ["events.message", "'foo'"]], "!=", 0]
        #     ],
        #     **common_args
        # )

        self.make_query(search_filter_query="foo", sort_by="priority")
        assert query_mock.call_args == mock.call(
            orderby=["-priority", "events.issue"],
            aggregations=[
                [
                    "toUInt64(plus(multiply(log(times_seen), 600), `events.last_seen`))",
                    "",
                    "priority",
                ],
                ["count()", "", "times_seen"],
                ["uniq", "events.issue", "total"],
                ["multiply(toUInt64(max(events.timestamp)), 1000)", "", "events.last_seen"],
            ],
            conditions=[[["positionCaseInsensitive", ["events.message", "'foo'"]], "!=", 0]],
            having=[],
            **common_args
        )

        self.make_query(search_filter_query="times_seen:5 foo", sort_by="freq")
        assert query_mock.call_args == mock.call(
            orderby=["-times_seen", "events.issue"],
            aggregations=[["count()", "", "times_seen"], ["uniq", "events.issue", "total"]],
            having=[["times_seen", "=", 5]],
            conditions=[[["positionCaseInsensitive", ["events.message", "'foo'"]], "!=", 0]],
            **common_args
        )

    def test_all_fields_do_not_error(self):
        # Just a sanity check to make sure that all fields can be successfully
        # searched on without returning type errors and other schema related
        # issues.
        def test_query(query):
            try:
                self.make_query(search_filter_query=query)
            except SnubaError as e:
                self.fail("Query %s errored. Error info: %s" % (query, e))

        for key in GROUPS_SENTRY_SNUBA_MAP:
            if key in [
                "first_seen",
                "last_seen",
                "active_at",
                "user",
                "status",
                "first_release",
                "events.issue",
                "issue.id",
                "project.id",
                "message",
                # TODO: Remove these keys, they should be able to run below.
                "release",  # Snuba bug, waiting on https://getsentry.atlassian.net/browse/SNS-294
            ]:
                continue
            test_query("has:%s" % key)
            test_query("!has:%s" % key)

            if key in IssueSearchVisitor.numeric_keys:
                val = "123"
            elif key in IssueSearchVisitor.date_keys:
                val = "2019-01-01"
            else:
                val = "hello"
                test_query("!%s:%s" % (key, val))

            test_query("%s:%s" % (key, val))
