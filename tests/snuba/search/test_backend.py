from __future__ import absolute_import

from sentry.utils.compat import mock
import pytz
from datetime import datetime, timedelta
from django.utils import timezone
from hashlib import md5

from sentry import options
from sentry.api.issue_search import convert_query_values, IssueSearchVisitor, parse_search_query
from sentry.models import (
    Environment,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupEnvironment,
    GroupStatus,
    GroupSubscription,
)
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.testutils import SnubaTestCase, TestCase, xfail_if_not_postgres
from sentry.testutils.helpers.datetime import iso_format
from sentry.utils.snuba import Dataset, SENTRY_SNUBA_MAP, SnubaError


def date_to_query_format(date):
    return date.strftime("%Y-%m-%dT%H:%M:%S")


class EventsSnubaSearchTest(TestCase, SnubaTestCase):
    @property
    def backend(self):
        return EventsDatasetSnubaSearchBackend()

    def setUp(self):
        super(EventsSnubaSearchTest, self).setUp()
        self.base_datetime = (datetime.utcnow() - timedelta(days=3)).replace(tzinfo=pytz.utc)

        event1_timestamp = iso_format(self.base_datetime - timedelta(days=21))
        self.event1 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "event_id": "a" * 32,
                "message": "foo. Also, this message is intended to be greater than 256 characters so that we can put some unique string identifier after that point in the string. The purpose of this is in order to verify we are using snuba to search messages instead of Postgres (postgres truncates at 256 characters and clickhouse does not). santryrox.",
                "environment": "production",
                "tags": {"server": "example.com", "sentry:user": "event1@example.com"},
                "timestamp": event1_timestamp,
                "stacktrace": {"frames": [{"module": "group1"}]},
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
                "timestamp": iso_format(self.base_datetime),
                "stacktrace": {"frames": [{"module": "group1"}]},
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
        self.group1.save()
        self.store_group(self.group1)

        self.event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "event_id": "b" * 32,
                "timestamp": iso_format(self.base_datetime - timedelta(days=20)),
                "message": "bar",
                "stacktrace": {"frames": [{"module": "group2"}]},
                "environment": "staging",
                "tags": {
                    "server": "example.com",
                    "url": "http://example.com",
                    "sentry:user": "event2@example.com",
                },
            },
            project_id=self.project.id,
        )

        self.group2 = Group.objects.get(id=self.event2.group.id)
        assert self.group2.id == self.event2.group.id
        assert self.group2.first_seen == self.group2.last_seen == self.event2.datetime

        self.group2.status = GroupStatus.RESOLVED
        self.group2.times_seen = 10
        self.group2.save()
        self.store_group(self.group2)

        GroupBookmark.objects.create(user=self.user, group=self.group2, project=self.group2.project)

        GroupAssignee.objects.create(user=self.user, group=self.group2, project=self.group2.project)

        GroupSubscription.objects.create(
            user=self.user, group=self.group1, project=self.group1.project, is_active=True
        )

        GroupSubscription.objects.create(
            user=self.user, group=self.group2, project=self.group2.project, is_active=False
        )

        self.environments = {
            "production": self.event1.get_environment(),
            "staging": self.event2.get_environment(),
        }

    def store_event(self, data, *args, **kwargs):
        event = super(EventsSnubaSearchTest, self).store_event(data, *args, **kwargs)
        environment_name = data.get("environment")
        if environment_name:
            GroupEnvironment.objects.filter(
                group_id=event.group_id,
                environment__name=environment_name,
                first_seen__gt=event.datetime,
            ).update(first_seen=event.datetime)
        return event

    def set_up_multi_project(self):
        self.project2 = self.create_project(organization=self.project.organization)
        self.event_p2 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["put-me-in-groupP2"],
                "timestamp": iso_format(self.base_datetime - timedelta(days=21)),
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

    def build_search_filter(self, query, projects=None, user=None, environments=None):
        user = user if user is not None else self.user
        projects = projects if projects is not None else [self.project]
        return convert_query_values(parse_search_query(query), projects, user, environments)

    def make_query(
        self,
        projects=None,
        search_filter_query=None,
        environments=None,
        sort_by="date",
        limit=None,
        count_hits=False,
        date_from=None,
        date_to=None,
    ):
        search_filters = []
        projects = projects if projects is not None else [self.project]
        if search_filter_query is not None:
            search_filters = self.build_search_filter(
                search_filter_query, projects, environments=environments
            )

        kwargs = {}
        if limit is not None:
            kwargs["limit"] = limit

        return self.backend.query(
            projects,
            search_filters=search_filters,
            environments=environments,
            count_hits=count_hits,
            sort_by=sort_by,
            date_from=date_from,
            date_to=date_to,
            **kwargs
        )

    def test_query(self):
        results = self.make_query(search_filter_query="foo")
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query="bar")
        assert set(results) == set([self.group2])

    def test_query_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], search_filter_query="foo")
        assert set(results) == set([self.group1, self.group_p2])

    def test_query_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="foo"
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="bar"
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="bar"
        )
        assert set(results) == set([self.group2])

    def test_query_for_text_in_long_message(self):
        results = self.make_query(
            [self.project],
            environments=[self.environments["production"]],
            search_filter_query="santryrox",
        )

        assert set(results) == set([self.group1])

    def test_multi_environments(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"], self.environments["staging"]],
        )
        assert set(results) == set([self.group1, self.group2, self.group_p2])

    def test_query_with_environment_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"]],
            search_filter_query="foo",
        )
        assert set(results) == set([self.group1, self.group_p2])

        results = self.make_query(
            [self.project, self.project2],
            environments=[self.environments["production"]],
            search_filter_query="bar",
        )
        assert set(results) == set([])

    def test_sort(self):
        results = self.make_query(sort_by="date")
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by="new")
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(sort_by="freq")
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by="priority")
        assert list(results) == [self.group1, self.group2]

        results = self.make_query(sort_by="user")
        assert list(results) == [self.group1, self.group2]

    def test_sort_with_environment(self):
        for dt in [
            self.group1.first_seen + timedelta(days=1),
            self.group1.first_seen + timedelta(days=2),
            self.group1.last_seen + timedelta(days=1),
        ]:
            self.store_event(
                data={
                    "fingerprint": ["put-me-in-group2"],
                    "timestamp": iso_format(dt),
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

        results = self.make_query(
            environments=[self.environments["production"]], sort_by="priority"
        )
        assert list(results) == [self.group2, self.group1]

        results = self.make_query(environments=[self.environments["production"]], sort_by="user")
        assert list(results) == [self.group1, self.group2]

    def test_status(self):
        results = self.make_query(search_filter_query="is:unresolved")
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query="is:resolved")
        assert set(results) == set([self.group2])

    def test_status_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:unresolved"
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:resolved"
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:resolved"
        )
        assert set(results) == set([])

    def test_tags(self):
        results = self.make_query(search_filter_query="environment:staging")
        assert set(results) == set([self.group2])

        results = self.make_query(search_filter_query="environment:example.com")
        assert set(results) == set([])

        results = self.make_query(search_filter_query="has:environment")
        assert set(results) == set([self.group2, self.group1])

        results = self.make_query(search_filter_query="environment:staging server:example.com")
        assert set(results) == set([self.group2])

        results = self.make_query(search_filter_query='url:"http://example.com"')
        assert set(results) == set([self.group2])

        results = self.make_query(search_filter_query="environment:staging has:server")
        assert set(results) == set([self.group2])

        results = self.make_query(search_filter_query="environment:staging server:bar.example.com")
        assert set(results) == set([])

    def test_tags_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="server:example.com"
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="server:example.com"
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="has:server"
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query='url:"http://example.com"',
        )
        assert set(results) == set([])

        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query='url:"http://example.com"',
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="server:bar.example.com",
        )
        assert set(results) == set([])

    def test_bookmarked_by(self):
        results = self.make_query(search_filter_query="bookmarks:%s" % self.user.username)
        assert set(results) == set([self.group2])

    def test_bookmarked_by_with_environment(self):
        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="bookmarks:%s" % self.user.username,
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="bookmarks:%s" % self.user.username,
        )
        assert set(results) == set([])

    def test_search_filter_query_with_custom_priority_tag(self):
        priority = "high"
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": iso_format(self.group2.first_seen + timedelta(days=1)),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"priority": priority},
            },
            project_id=self.project.id,
        )

        results = self.make_query(search_filter_query="priority:%s" % priority)

        assert set(results) == set([self.group2])

    def test_search_filter_query_with_custom_priority_tag_and_priority_sort(self):
        priority = "high"
        for i in range(1, 3):
            self.store_event(
                data={
                    "fingerprint": ["put-me-in-group1"],
                    "timestamp": iso_format(self.group2.last_seen + timedelta(days=i)),
                    "stacktrace": {"frames": [{"module": "group1"}]},
                    "message": "group1",
                    "tags": {"priority": priority},
                },
                project_id=self.project.id,
            )
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": iso_format(self.group2.last_seen + timedelta(days=2)),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"priority": priority},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="priority:%s" % priority, sort_by="priority")
        assert list(results) == [self.group1, self.group2]

    def test_search_tag_overlapping_with_internal_fields(self):
        # Using a tag of email overlaps with the promoted user.email column in events.
        # We don't want to bypass public schema limits in issue search.
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": iso_format(self.group2.first_seen + timedelta(days=1)),
                "stacktrace": {"frames": [{"module": "group2"}]},
                "message": "group2",
                "tags": {"email": "tags@example.com"},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="email:tags@example.com")
        assert set(results) == set([self.group2])

    def test_project(self):
        results = self.make_query([self.create_project(name="other")])
        assert set(results) == set([])

    def test_pagination(self):
        for options_set in [
            {"snuba.search.min-pre-snuba-candidates": None},
            {"snuba.search.min-pre-snuba-candidates": 500},
        ]:
            with self.options(options_set):
                results = self.backend.query([self.project], limit=1, sort_by="date")
                assert set(results) == set([self.group1])
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == set([self.group2])
                assert results.prev.has_results
                assert not results.next.has_results

                # note: previous cursor
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by="date"
                )
                assert set(results) == set([self.group1])
                assert results.prev.has_results
                assert results.next.has_results

                # note: previous cursor, paging too far into 0 results
                results = self.backend.query(
                    [self.project], cursor=results.prev, limit=1, sort_by="date"
                )
                assert set(results) == set([])
                assert not results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == set([self.group1])
                assert results.prev.has_results
                assert results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == set([self.group2])
                assert results.prev.has_results
                assert not results.next.has_results

                results = self.backend.query(
                    [self.project], cursor=results.next, limit=1, sort_by="date"
                )
                assert set(results) == set([])
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
                    "timestamp": iso_format(dt),
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

    def test_active_at_filter(self):
        results = self.make_query(
            search_filter_query="activeSince:>=%s" % date_to_query_format(self.group2.active_at)
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query="activeSince:<=%s"
            % date_to_query_format(self.group1.active_at + timedelta(minutes=1))
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            search_filter_query="activeSince:>=%s activeSince:<=%s"
            % (
                date_to_query_format(self.group1.active_at),
                date_to_query_format(self.group1.active_at + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_age_filter(self):
        results = self.make_query(
            search_filter_query="firstSeen:>=%s" % date_to_query_format(self.group2.first_seen)
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            search_filter_query="firstSeen:<=%s"
            % date_to_query_format(self.group1.first_seen + timedelta(minutes=1))
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            search_filter_query="firstSeen:>=%s firstSeen:<=%s"
            % (
                date_to_query_format(self.group1.first_seen),
                date_to_query_format(self.group1.first_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_age_filter_with_environment(self):
        # add time instead to make it greater than or less than as needed.
        group1_first_seen = GroupEnvironment.objects.get(
            environment=self.environments["production"], group=self.group1
        ).first_seen

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:>=%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:<=%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="firstSeen:>%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set([])
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(group1_first_seen + timedelta(days=1)),
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
        assert set(results) == set([])

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="firstSeen:>%s" % date_to_query_format(group1_first_seen),
        )
        assert set(results) == set([self.group1])

    def test_times_seen_filter(self):
        results = self.make_query([self.project], search_filter_query="times_seen:2")
        assert set(results) == set([self.group1])

        results = self.make_query([self.project], search_filter_query="times_seen:>=2")
        assert set(results) == set([self.group1])

        results = self.make_query([self.project], search_filter_query="times_seen:<=1")
        assert set(results) == set([self.group2])

    def test_last_seen_filter(self):
        results = self.make_query(
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen)
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            search_filter_query="lastSeen:>=%s lastSeen:<=%s"
            % (
                date_to_query_format(self.group1.last_seen),
                date_to_query_format(self.group1.last_seen + timedelta(minutes=1)),
            )
        )
        assert set(results) == set([self.group1])

    def test_last_seen_filter_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:<=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="lastSeen:>%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([])

        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(self.group1.last_seen + timedelta(days=1)),
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
        assert set(results) == set([])

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="lastSeen:>%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set()

        results = self.make_query(
            environments=[Environment.objects.get(name="development")],
            search_filter_query="lastSeen:>=%s" % date_to_query_format(self.group1.last_seen),
        )
        assert set(results) == set([self.group1])

    def test_date_filter(self):
        results = self.make_query(
            date_from=self.event2.datetime,
            search_filter_query="timestamp:>=%s" % date_to_query_format(self.event2.datetime),
        )
        assert set(results) == set([self.group1, self.group2])

        results = self.make_query(
            date_to=self.event1.datetime + timedelta(minutes=1),
            search_filter_query="timestamp:<=%s"
            % date_to_query_format(self.event1.datetime + timedelta(minutes=1)),
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
            search_filter_query="timestamp:>=%s timestamp:<=%s"
            % (
                date_to_query_format(self.event1.datetime),
                date_to_query_format(self.event2.datetime + timedelta(minutes=1)),
            ),
        )
        assert set(results) == set([self.group1, self.group2])

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
        assert set(results) == set([self.group1, self.group2])

    def test_date_filter_with_environment(self):
        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            date_from=self.event2.datetime,
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            [self.project],
            environments=[self.environments["production"]],
            date_to=self.event1.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group1])

        results = self.backend.query(
            [self.project],
            environments=[self.environments["staging"]],
            date_from=self.event1.datetime,
            date_to=self.event2.datetime + timedelta(minutes=1),
        )
        assert set(results) == set([self.group2])

    def test_unassigned(self):
        results = self.make_query(search_filter_query="is:unassigned")
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query="is:assigned")
        assert set(results) == set([self.group2])

    def test_unassigned_with_environment(self):
        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:unassigned"
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            environments=[self.environments["staging"]], search_filter_query="is:assigned"
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["production"]], search_filter_query="is:assigned"
        )
        assert set(results) == set([])

    def test_assigned_to(self):
        results = self.make_query(search_filter_query="assigned:%s" % self.user.username)
        assert set(results) == set([self.group2])

        # test team assignee
        ga = GroupAssignee.objects.get(
            user=self.user, group=self.group2, project=self.group2.project
        )
        ga.update(team=self.team, user=None)
        assert GroupAssignee.objects.get(id=ga.id).user is None

        results = self.make_query(search_filter_query="assigned:%s" % self.user.username)
        assert set(results) == set([self.group2])

        # test when there should be no results
        other_user = self.create_user()
        results = self.make_query(search_filter_query="assigned:%s" % other_user.username)
        assert set(results) == set([])

        owner = self.create_user()
        self.create_member(
            organization=self.project.organization, user=owner, role="owner", teams=[]
        )

        # test that owners don't see results for all teams
        results = self.make_query(search_filter_query="assigned:%s" % owner.username)
        assert set(results) == set([])

    def test_assigned_to_with_environment(self):
        results = self.make_query(
            environments=[self.environments["staging"]],
            search_filter_query="assigned:%s" % self.user.username,
        )
        assert set(results) == set([self.group2])

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="assigned:%s" % self.user.username,
        )
        assert set(results) == set([])

    def test_subscribed_by(self):
        results = self.make_query(
            [self.group1.project], search_filter_query="subscribed:%s" % self.user.username
        )
        assert set(results) == set([self.group1])

    def test_subscribed_by_with_environment(self):
        results = self.make_query(
            [self.group1.project],
            environments=[self.environments["production"]],
            search_filter_query="subscribed:%s" % self.user.username,
        )
        assert set(results) == set([self.group1])

        results = self.make_query(
            [self.group1.project],
            environments=[self.environments["staging"]],
            search_filter_query="subscribed:%s" % self.user.username,
        )
        assert set(results) == set([])

    @mock.patch("sentry.utils.snuba.raw_query")
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

    @mock.patch("sentry.utils.snuba.raw_query")
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
            "dataset": Dataset.Events,
            "start": Any(datetime),
            "end": Any(datetime),
            "filter_keys": {
                "project_id": [self.project.id],
                "group_id": [self.group1.id, self.group2.id],
            },
            "referrer": "search",
            "groupby": ["group_id"],
            "conditions": [[["positionCaseInsensitive", ["message", "'foo'"]], "!=", 0]],
            "selected_columns": [],
            "limit": limit,
            "offset": 0,
            "totals": True,
            "turbo": False,
            "sample": 1,
        }

        self.make_query(search_filter_query="status:unresolved")
        assert not query_mock.called

        self.make_query(
            search_filter_query="last_seen:>=%s foo" % date_to_query_format(timezone.now()),
            sort_by="date",
        )
        query_mock.call_args[1]["aggregations"].sort()
        assert query_mock.call_args == mock.call(
            orderby=["-last_seen", "group_id"],
            aggregations=[
                ["multiply(toUInt64(max(timestamp)), 1000)", "", "last_seen"],
                ["uniq", "group_id", "total"],
            ],
            having=[["last_seen", ">=", Any(int)]],
            **common_args
        )

        self.make_query(search_filter_query="foo", sort_by="priority")
        query_mock.call_args[1]["aggregations"].sort()
        assert query_mock.call_args == mock.call(
            orderby=["-priority", "group_id"],
            aggregations=[
                ["count()", "", "times_seen"],
                ["multiply(toUInt64(max(timestamp)), 1000)", "", "last_seen"],
                ["toUInt64(plus(multiply(log(times_seen), 600), last_seen))", "", "priority"],
                ["uniq", "group_id", "total"],
            ],
            having=[],
            **common_args
        )

        self.make_query(search_filter_query="times_seen:5 foo", sort_by="freq")
        query_mock.call_args[1]["aggregations"].sort()
        assert query_mock.call_args == mock.call(
            orderby=["-times_seen", "group_id"],
            aggregations=[["count()", "", "times_seen"], ["uniq", "group_id", "total"]],
            having=[["times_seen", "=", 5]],
            **common_args
        )

        self.make_query(search_filter_query="foo", sort_by="user")
        query_mock.call_args[1]["aggregations"].sort()
        assert query_mock.call_args == mock.call(
            orderby=["-user_count", "group_id"],
            aggregations=[
                ["uniq", "group_id", "total"],
                ["uniq", "tags[sentry:user]", "user_count"],
            ],
            having=[],
            **common_args
        )

    def test_pre_and_post_filtering(self):
        prev_max_pre = options.get("snuba.search.max-pre-snuba-candidates")
        options.set("snuba.search.max-pre-snuba-candidates", 1)
        try:
            # normal queries work as expected
            results = self.make_query(search_filter_query="foo")
            assert set(results) == set([self.group1])
            results = self.make_query(search_filter_query="bar")
            assert set(results) == set([self.group2])

            # no candidate matches in Sentry, immediately return empty paginator
            results = self.make_query(search_filter_query="NO MATCHES IN SENTRY")
            assert set(results) == set()

            # too many candidates, skip pre-filter, requires >1 postfilter queries
            results = self.make_query()
            assert set(results) == set([self.group1, self.group2])
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
            assert set(results) == set([self.group1])
        finally:
            options.set("snuba.search.pre-snuba-candidates-optimizer", prev_optimizer_enabled)

    def test_search_out_of_range(self):
        the_date = datetime(2000, 1, 1, 0, 0, 0, tzinfo=pytz.utc)
        results = self.make_query(
            search_filter_query="event.timestamp:>%s event.timestamp:<%s" % (the_date, the_date),
            date_from=the_date,
            date_to=the_date,
        )
        assert set(results) == set([])

    def test_hits_estimate(self):
        # 400 Groups/Events
        # Every 3rd one is Unresolved
        # Every 2nd one has tag match=1
        for i in range(400):
            event = self.store_event(
                data={
                    "event_id": md5("event {}".format(i).encode("utf-8")).hexdigest(),
                    "fingerprint": ["put-me-in-group{}".format(i)],
                    "timestamp": iso_format(self.base_datetime - timedelta(days=21)),
                    "message": "group {} event".format(i),
                    "stacktrace": {"frames": [{"module": "module {}".format(i)}]},
                    "tags": {"match": "{}".format(i % 2)},
                    "environment": "production",
                },
                project_id=self.project.id,
            )

            group = event.group
            group.times_seen = 5
            group.status = GroupStatus.UNRESOLVED if i % 3 == 0 else GroupStatus.RESOLVED
            group.save()
            self.store_group(group)

        # Sample should estimate there are roughly 66 overall matching groups
        # based on a random sample of 100 (or $sample_size) of the total 200
        # snuba matches, of which 33% should pass the postgres filter.
        with self.options(
            {
                # Too small to pass all django candidates down to snuba
                "snuba.search.max-pre-snuba-candidates": 5,
                "snuba.search.hits-sample-size": 50,
            }
        ):
            first_results = self.make_query(
                search_filter_query="is:unresolved match:1", limit=10, count_hits=True
            )

            # Deliberately do not assert that the value is within some margin
            # of error, as this will fail tests at some rate corresponding to
            # our confidence interval.
            assert first_results.hits > 10

            # When searching for the same tags, we should get the same set of
            # hits as the sampling is based on the hash of the query.
            second_results = self.make_query(
                search_filter_query="is:unresolved match:1", limit=10, count_hits=True
            )

            assert first_results.results == second_results.results

            # When using a different search, we should get a different sample
            # but still should have some hits.
            third_results = self.make_query(
                search_filter_query="is:unresolved match:0", limit=10, count_hits=True
            )

            assert third_results.hits > 10
            assert third_results.results != second_results.results

    def test_first_release(self):

        # expect no groups within the results since there are no releases

        results = self.make_query(search_filter_query="first_release:%s" % "fake")
        assert set(results) == set([])

        # expect no groups even though there is a release; since no group
        # is attached to a release

        release_1 = self.create_release(self.project)

        results = self.make_query(search_filter_query="first_release:%s" % release_1.version)
        assert set(results) == set([])

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
        assert set(results) == set([group])

    def test_first_release_environments(self):
        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="first_release:%s" % "fake",
        )
        assert set(results) == set([])

        release = self.create_release(self.project)
        group_env = GroupEnvironment.get_or_create(
            group_id=self.group1.id, environment_id=self.environments["production"].id
        )[0]

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="first_release:%s" % release.version,
        )
        assert set(results) == set([])

        group_env.first_release = release
        group_env.save()

        results = self.make_query(
            environments=[self.environments["production"]],
            search_filter_query="first_release:%s" % release.version,
        )
        assert set(results) == set([self.group1])

    def test_query_enclosed_in_quotes(self):
        results = self.make_query(search_filter_query='"foo"')
        assert set(results) == set([self.group1])

        results = self.make_query(search_filter_query='"bar"')
        assert set(results) == set([self.group2])

    @xfail_if_not_postgres("Wildcard searching only supported in Postgres")
    def test_wildcard(self):
        escaped_event = self.store_event(
            data={
                "fingerprint": ["hello-there"],
                "event_id": "f" * 32,
                "message": "somet[hing]",
                "environment": "production",
                "tags": {"server": "example.net"},
                "timestamp": iso_format(self.base_datetime),
                "stacktrace": {"frames": [{"module": "group1"}]},
            },
            project_id=self.project.id,
        )
        # Note: Adding in `environment:production` so that we make sure we query
        # in both snuba and postgres
        results = self.make_query(search_filter_query="environment:production so*t")
        assert set(results) == set([escaped_event.group])
        # Make sure it's case insensitive
        results = self.make_query(search_filter_query="environment:production SO*t")
        assert set(results) == set([escaped_event.group])
        results = self.make_query(search_filter_query="environment:production so*zz")
        assert set(results) == set()
        results = self.make_query(search_filter_query="environment:production [hing]")
        assert set(results) == set([escaped_event.group])
        results = self.make_query(search_filter_query="environment:production s*]")
        assert set(results) == set([escaped_event.group])
        results = self.make_query(search_filter_query="environment:production server:example.*")
        assert set(results) == set([self.group1, escaped_event.group])
        results = self.make_query(search_filter_query="environment:production !server:*net")
        assert set(results) == set([self.group1])
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
                "timestamp": iso_format(self.base_datetime),
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
                "timestamp": iso_format(self.base_datetime),
                "stacktrace": {"frames": [{"module": "group2"}]},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="environment:production !server:*net")
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(search_filter_query="environment:production server:*net")
        assert set(results) == set([tag_event.group])
        results = self.make_query(search_filter_query="environment:production !server:example.net")
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(search_filter_query="environment:production server:example.net")
        assert set(results) == set([tag_event.group])
        results = self.make_query(search_filter_query="environment:production has:server")
        assert set(results) == set([self.group1, tag_event.group])
        results = self.make_query(search_filter_query="environment:production !has:server")
        assert set(results) == set([no_tag_event.group])

    def test_null_promoted_tags(self):
        tag_event = self.store_event(
            data={
                "fingerprint": ["hello-there"],
                "event_id": "f" * 32,
                "message": "something",
                "environment": "production",
                "tags": {"logger": "csp"},
                "timestamp": iso_format(self.base_datetime),
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
                "timestamp": iso_format(self.base_datetime),
                "stacktrace": {"frames": [{"module": "group2"}]},
            },
            project_id=self.project.id,
        )
        results = self.make_query(search_filter_query="environment:production !logger:*sp")
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(search_filter_query="environment:production logger:*sp")
        assert set(results) == set([tag_event.group])
        results = self.make_query(search_filter_query="environment:production !logger:csp")
        assert set(results) == set([self.group1, no_tag_event.group])
        results = self.make_query(search_filter_query="environment:production logger:csp")
        assert set(results) == set([tag_event.group])
        results = self.make_query(search_filter_query="environment:production has:logger")
        assert set(results) == set([tag_event.group])
        results = self.make_query(search_filter_query="environment:production !has:logger")
        assert set(results) == set([self.group1, no_tag_event.group])

    def test_sort_multi_project(self):
        self.set_up_multi_project()
        results = self.make_query([self.project, self.project2], sort_by="date")
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by="new")
        assert list(results) == [self.group2, self.group_p2, self.group1]

        results = self.make_query([self.project, self.project2], sort_by="freq")
        assert list(results) == [self.group1, self.group_p2, self.group2]

        results = self.make_query([self.project, self.project2], sort_by="priority")
        assert list(results) == [self.group1, self.group2, self.group_p2]

        results = self.make_query([self.project, self.project2], sort_by="user")
        assert list(results) == [self.group1, self.group2, self.group_p2]

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
        assert set(results) == set([group_a, group_c])

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

    def test_all_fields_do_not_error(self):
        # Just a sanity check to make sure that all fields can be successfully
        # searched on without returning type errors and other schema related
        # issues.
        def test_query(query):
            try:
                self.make_query(search_filter_query=query)
            except SnubaError as e:
                self.fail("Query %s errored. Error info: %s" % (query, e))

        for key in SENTRY_SNUBA_MAP:
            if key in ["project.id", "issue.id"]:
                continue
            test_query("has:%s" % key)
            test_query("!has:%s" % key)
            if key == "error.handled":
                val = 1
            elif key in IssueSearchVisitor.numeric_keys:
                val = "123"
            elif key in IssueSearchVisitor.date_keys:
                val = "2019-01-01"
            elif key in IssueSearchVisitor.boolean_keys:
                val = "true"
            else:
                val = "abadcafedeadbeefdeaffeedabadfeed"
                test_query("!%s:%s" % (key, val))
                test_query('%s:%s' % (key, 'abadcafe*'))

            test_query("%s:%s" % (key, val))
