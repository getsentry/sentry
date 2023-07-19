import functools
import hashlib
import itertools
import logging
import uuid
from datetime import datetime, timedelta
from time import sleep
from unittest.mock import patch

import pytz
from django.utils import timezone

from sentry import eventstream, tagstore, tsdb
from sentry.issues.escalating import get_group_hourly_count, query_groups_past_counts
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import (
    Environment,
    Group,
    GroupHash,
    GroupRelease,
    GroupStatus,
    Release,
    UserReport,
)
from sentry.similarity import _make_index_backend, features
from sentry.tasks.merge import merge_groups
from sentry.tasks.unmerge import (
    get_caches,
    get_event_user_from_interface,
    get_fingerprint,
    get_group_backfill_attributes,
    get_group_creation_attributes,
    unmerge,
)
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.tsdb.base import TSDBModel
from sentry.types.group import GroupSubStatus
from sentry.utils import redis
from sentry.utils.dates import to_timestamp

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))


@patch("sentry.similarity.features.index", new=index)
class UnmergeTestCase(TestCase, SnubaTestCase):
    def create_message_event(
        self,
        template,
        parameters,
        environment,
        release,
        project,
        now,
        sequence,
        tag_values,
        user_values,
        fingerprint="group1",
    ):

        i = next(sequence)

        event_id = uuid.UUID(fields=(i, 0x0, 0x1000, 0x80, 0x80, 0x808080808080)).hex

        tags = [["color", next(tag_values)]]

        if release:
            tags.append(["sentry:release", release])

        event = self.store_event(
            data={
                "event_id": event_id,
                "message": template % parameters,
                "type": "default",
                "user": next(user_values),
                "tags": tags,
                "fingerprint": [fingerprint],
                "timestamp": iso_format(now + timedelta(seconds=i)),
                "environment": environment,
                "release": release,
            },
            project_id=project.id,
        )

        UserReport.objects.create(
            project_id=project.id,
            group_id=event.group.id,
            event_id=event_id,
            name="Log Hat",
            email="ceo@corptron.com",
            comments="Quack",
        )

        features.record([event])

        return event

    def test_get_fingerprint(self):
        assert (
            get_fingerprint(
                self.store_event(data={"message": "Hello world"}, project_id=self.project.id)
            )
            == hashlib.md5(b"Hello world").hexdigest()
        )

        assert (
            get_fingerprint(
                self.store_event(
                    data={"message": "Hello world", "fingerprint": ["Not hello world"]},
                    project_id=self.project.id,
                )
            )
            == hashlib.md5(b"Not hello world").hexdigest()
        )

    def test_get_group_creation_attributes(self):
        now = datetime.utcnow().replace(microsecond=0, tzinfo=timezone.utc)
        e1 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "platform": "javascript",
                "message": "Hello from JavaScript",
                "type": "default",
                "level": "info",
                "tags": {"logger": "javascript"},
                "timestamp": iso_format(now),
            },
            project_id=self.project.id,
        )
        e2 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "platform": "python",
                "message": "Hello from Python",
                "type": "default",
                "level": "error",
                "tags": {"logger": "python"},
                "timestamp": iso_format(now),
            },
            project_id=self.project.id,
        )
        e3 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "platform": "java",
                "message": "Hello from Java",
                "type": "default",
                "level": "debug",
                "tags": {"logger": "java"},
                "timestamp": iso_format(now),
            },
            project_id=self.project.id,
        )
        events = [e1, e2, e3]

        assert get_group_creation_attributes(get_caches(), events) == {
            "active_at": now,
            "first_seen": now,
            "last_seen": now,
            "platform": "java",
            "message": "Hello from JavaScript",
            "level": logging.INFO,
            "score": Group.calculate_score(3, now),
            "logger": "java",
            "times_seen": 3,
            "first_release": None,
            "culprit": "",
            "data": {
                "type": "default",
                "last_received": e1.data["received"],
                "metadata": {"title": "Hello from JavaScript"},
            },
        }

    def test_get_group_backfill_attributes(self):
        now = datetime.utcnow().replace(microsecond=0, tzinfo=timezone.utc)

        assert get_group_backfill_attributes(
            get_caches(),
            Group(
                active_at=now,
                first_seen=now,
                last_seen=now,
                platform="javascript",
                message="Hello from JavaScript",
                level=logging.INFO,
                score=Group.calculate_score(3, now),
                logger="javascript",
                times_seen=1,
                first_release=None,
                culprit="",
                data={"type": "default", "last_received": to_timestamp(now), "metadata": {}},
            ),
            [
                self.store_event(
                    data={
                        "platform": "python",
                        "message": "Hello from Python",
                        "timestamp": iso_format(now - timedelta(hours=1)),
                        "type": "default",
                        "level": "debug",
                        "tags": {"logger": "java"},
                    },
                    project_id=self.project.id,
                ),
                self.store_event(
                    data={
                        "platform": "java",
                        "message": "Hello from Java",
                        "timestamp": iso_format(now - timedelta(hours=2)),
                        "type": "default",
                        "level": "debug",
                        "tags": {"logger": "java"},
                    },
                    project_id=self.project.id,
                ),
            ],
        ) == {
            "active_at": now - timedelta(hours=2),
            "first_seen": now - timedelta(hours=2),
            "platform": "java",
            "score": Group.calculate_score(3, now),
            "logger": "java",
            "times_seen": 3,
            "first_release": None,
        }

    @with_feature("projects:similarity-indexing")
    @with_feature("organizations:escalating-issues-v2")
    def test_unmerge(self):
        now = before_now(minutes=5).replace(microsecond=0, tzinfo=pytz.utc)

        def time_from_now(offset=0):
            return now + timedelta(seconds=offset)

        project = self.create_project()
        sequence = itertools.count(0)
        tag_values = itertools.cycle(["red", "green", "blue"])
        user_values = itertools.cycle([{"id": 1}, {"id": 2}])

        events = {}

        for event in (
            self.create_message_event(
                "This is message #%s.",
                i,
                environment="production",
                release="version",
                project=project,
                now=now,
                tag_values=tag_values,
                user_values=user_values,
                sequence=sequence,
            )
            for i in range(10)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        for event in (
            self.create_message_event(
                "This is message #%s!",
                i,
                environment="production",
                release="version2",
                project=project,
                now=now,
                sequence=sequence,
                tag_values=tag_values,
                user_values=user_values,
                fingerprint="group2",
            )
            for i in range(10, 16)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        event = self.create_message_event(
            "This is message #%s!",
            17,
            environment="staging",
            release="version3",
            project=project,
            now=now,
            sequence=sequence,
            tag_values=tag_values,
            user_values=user_values,
            fingerprint="group3",
        )

        events.setdefault(get_fingerprint(event), []).append(event)

        merge_source, source, destination = list(Group.objects.all())
        source.status = GroupStatus.IGNORED
        source.substatus = GroupSubStatus.UNTIL_ESCALATING
        source.save()

        production_environment = Environment.objects.get(
            organization_id=project.organization_id, name="production"
        )

        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(
                project.id, [merge_source.id], source.id
            )
            merge_groups.delay(
                [merge_source.id],
                source.id,
                eventstream_state=eventstream_state,
                handle_forecasts_ids=[source.id, merge_source.id],
                merge_forecasts=True,
            )

        sleep(1)
        single_hour = get_group_hourly_count(source)
        single_past = query_groups_past_counts([source])
        past = query_groups_past_counts(list(Group.objects.all()))
        generate_and_save_forecasts(list(Group.objects.all()))
        forecast = EscalatingGroupForecast.fetch(source.project.id, source.id).forecast
        # assert single_hour == 16
        assert single_past[0]["count()"] == 16
        assert past[0]["count()"] == 16
        assert past[1]["count()"] == 1
        assert forecast == [160] * 14  # change to 40 after default merges

        assert {
            (gtv.value, gtv.times_seen)
            for gtv in tagstore.get_group_tag_values(
                source,
                production_environment.id,
                "color",
                tenant_ids={"referrer": "get_tag_values", "organization_id": 1},
            )
        } == {("red", 6), ("green", 5), ("blue", 5)}

        similar_items = features.compare(source)
        assert len(similar_items) == 2
        assert similar_items[0][0] == source.id
        assert similar_items[0][1]["message:message:character-shingles"] == 1.0
        assert similar_items[1][0] == destination.id
        assert similar_items[1][1]["message:message:character-shingles"] < 1.0

        with self.tasks():
            unmerge.delay(
                project_id=project.id,
                source_id=source.id,
                destination_id=destination.id,
                fingerprints=[list(events.keys())[0]],
                actor_id=None,
                batch_size=5,
            )

        sleep(1)
        forecast = EscalatingGroupForecast.fetch(source.project.id, source.id).forecast
        single_hour = get_group_hourly_count(source)
        past = query_groups_past_counts(list(Group.objects.all()))
        single_past = query_groups_past_counts([source])
        assert single_hour == 6
        assert single_past[0]["count()"] == 6
        assert past[0]["count()"] == 6
        assert past[1]["count()"] == 11
        assert forecast == [60] * 14

        assert (
            list(
                Group.objects.filter(id=merge_source.id).values_list(
                    "times_seen", "first_seen", "last_seen"
                )
            )
            == []
        )

        assert list(
            Group.objects.filter(id=source.id).values_list("times_seen", "first_seen", "last_seen")
        ) == [(6, time_from_now(10), time_from_now(15))]

        assert list(
            Group.objects.filter(id=destination.id).values_list(
                "times_seen", "first_seen", "last_seen"
            )
        ) == [(11, time_from_now(0), time_from_now(16))]

        assert source.id != destination.id
        assert source.project == destination.project

        destination_event_ids = set(map(lambda event: event.event_id, list(events.values())[1]))

        assert destination_event_ids == set(
            UserReport.objects.filter(group_id=source.id).values_list("event_id", flat=True)
        )

        assert list(
            GroupHash.objects.filter(group_id=source.id).values_list("hash", flat=True)
        ) == [list(events.keys())[1]]

        assert set(
            GroupRelease.objects.filter(group_id=source.id).values_list(
                "environment", "first_seen", "last_seen"
            )
        ) == {("production", time_from_now(10), time_from_now(15))}

        assert {
            (gtv.value, gtv.times_seen)
            for gtv in tagstore.get_group_tag_values(
                destination,
                production_environment.id,
                "color",
                tenant_ids={"referrer": "get_tag_values", "organization_id": 1},
            )
        } == {("red", 4), ("green", 3), ("blue", 3)}

        destination_event_ids = set(
            map(lambda event: event.event_id, list(events.values())[0] + list(events.values())[2])
        )

        assert destination_event_ids == set(
            UserReport.objects.filter(group_id=destination.id).values_list("event_id", flat=True)
        )

        assert set(
            GroupHash.objects.filter(group_id=destination.id).values_list("hash", flat=True)
        ) == {list(events.keys())[0], list(events.keys())[2]}

        assert set(
            GroupRelease.objects.filter(group_id=destination.id).values_list(
                "environment", "first_seen", "last_seen"
            )
        ) == {
            ("production", time_from_now(0), time_from_now(9)),
            ("staging", time_from_now(16), time_from_now(16)),
        }

        assert {
            (gtk.value, gtk.times_seen)
            for gtk in tagstore.get_group_tag_values(
                destination,
                production_environment.id,
                "color",
                tenant_ids={"referrer": "get_tag_values", "organization_id": 1},
            )
        } == {("red", 4), ("blue", 3), ("green", 3)}

        rollup_duration = 3600

        time_series = tsdb.get_range(
            TSDBModel.group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            time_from_now(17),
            rollup_duration,
            tenant_ids={"referrer": "get_range", "organization_id": 1},
        )

        environment_time_series = tsdb.get_range(
            TSDBModel.group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            time_from_now(17),
            rollup_duration,
            environment_ids=[production_environment.id],
            tenant_ids={"referrer": "get_range", "organization_id": 1},
        )

        def get_expected_series_values(rollup, events, function=None):
            if function is None:

                def function(aggregate, event):
                    return (aggregate if aggregate is not None else 0) + 1

            expected = {}
            for event in events:
                k = float((to_timestamp(event.datetime) // rollup_duration) * rollup_duration)
                expected[k] = function(expected.get(k), event)

            return expected

        def assert_series_contains(expected, actual, default=0):
            actual = dict(actual)

            for key, value in expected.items():
                assert actual.get(key, 0) == value

            for key in set(actual.keys()) - set(expected.keys()):
                assert actual.get(key, 0) == default

        assert_series_contains(
            get_expected_series_values(rollup_duration, list(events.values())[1]),
            time_series[source.id],
            0,
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration, list(events.values())[0] + list(events.values())[2]
            ),
            time_series[destination.id],
            0,
        )

        assert_series_contains(
            get_expected_series_values(rollup_duration, list(events.values())[1]),
            environment_time_series[source.id],
            0,
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration, list(events.values())[0][:-1] + list(events.values())[2]
            ),
            environment_time_series[destination.id],
            0,
        )

        time_series = tsdb.get_distinct_counts_series(
            TSDBModel.users_affected_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            time_from_now(17),
            rollup_duration,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )

        environment_time_series = tsdb.get_distinct_counts_series(
            TSDBModel.users_affected_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            time_from_now(17),
            rollup_duration,
            environment_id=production_environment.id,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )

        def collect_by_user_tag(aggregate, event):
            aggregate = aggregate if aggregate is not None else set()
            aggregate.add(get_event_user_from_interface(event.data["user"]).tag_value)
            return aggregate

        for series in [time_series, environment_time_series]:
            assert_series_contains(
                {
                    timestamp: len(values)
                    for timestamp, values in get_expected_series_values(
                        rollup_duration, list(events.values())[1], collect_by_user_tag
                    ).items()
                },
                series[source.id],
            )

            assert_series_contains(
                {
                    timestamp: len(values)
                    for timestamp, values in get_expected_series_values(
                        rollup_duration,
                        list(events.values())[0] + list(events.values())[2],
                        collect_by_user_tag,
                    ).items()
                },
                time_series[destination.id],
            )

        def strip_zeroes(data):
            for group_id, series in data.items():
                for _, values in series:
                    for key, val in list(values.items()):
                        if val == 0:
                            values.pop(key)

            return data

        def collect_by_release(group, aggregate, event):
            aggregate = aggregate if aggregate is not None else {}
            release = event.get_tag("sentry:release")
            if not release:
                return aggregate
            release = GroupRelease.objects.get(
                group_id=group.id,
                environment=event.data["environment"],
                release_id=Release.objects.get(
                    organization_id=project.organization_id, version=release
                ).id,
            ).id
            aggregate[release] = aggregate.get(release, 0) + 1
            return aggregate

        items = {}
        for i in [source.id, destination.id]:
            items[i] = list(GroupRelease.objects.filter(group_id=i).values_list("id", flat=True))

        time_series = strip_zeroes(
            tsdb.get_frequency_series(
                TSDBModel.frequent_releases_by_group,
                items,
                now - timedelta(seconds=rollup_duration),
                time_from_now(17),
                rollup_duration,
                tenant_ids={"referrer": "r", "organization_id": 1234},
            )
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                list(events.values())[1],
                functools.partial(collect_by_release, source),
            ),
            time_series[source.id],
            {},
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                list(events.values())[0] + list(events.values())[2],
                functools.partial(collect_by_release, destination),
            ),
            time_series[destination.id],
            {},
        )

        items = {}
        for i in [source.id, destination.id]:
            items[i] = list(Environment.objects.all().values_list("id", flat=True))

        time_series = strip_zeroes(
            tsdb.get_frequency_series(
                TSDBModel.frequent_environments_by_group,
                items,
                now - timedelta(seconds=rollup_duration),
                time_from_now(17),
                rollup_duration,
                tenant_ids={"referrer": "r", "organization_id": 1234},
            )
        )

        def collect_by_environment(aggregate, event):
            aggregate = aggregate if aggregate is not None else {}
            environment = Environment.objects.get(
                organization_id=project.organization_id, name=event.data["environment"]
            ).id
            aggregate[environment] = aggregate.get(environment, 0) + 1
            return aggregate

        assert_series_contains(
            get_expected_series_values(
                rollup_duration, list(events.values())[1], collect_by_environment
            ),
            time_series[source.id],
            {},
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                list(events.values())[0] + list(events.values())[2],
                collect_by_environment,
            ),
            time_series[destination.id],
            {},
        )

        source_similar_items = features.compare(source)
        assert source_similar_items[0] == (
            source.id,
            {
                "exception:message:character-shingles": None,
                "exception:stacktrace:application-chunks": None,
                "exception:stacktrace:pairs": None,
                "message:message:character-shingles": 1.0,
            },
        )
        assert source_similar_items[1][0] == destination.id
        assert source_similar_items[1][1]["message:message:character-shingles"] < 1.0

        destination_similar_items = features.compare(destination)
        assert destination_similar_items[0] == (
            destination.id,
            {
                "exception:message:character-shingles": None,
                "exception:stacktrace:application-chunks": None,
                "exception:stacktrace:pairs": None,
                "message:message:character-shingles": 1.0,
            },
        )
        assert destination_similar_items[1][0] == source.id
        assert destination_similar_items[1][1]["message:message:character-shingles"] < 1.0

    @with_feature("organizations:escalating-issues-v2")
    def test_no_dest(self):
        now = before_now(minutes=5).replace(microsecond=0, tzinfo=pytz.utc)

        project = self.create_project()
        sequence = itertools.count(0)
        tag_values = itertools.cycle(["red", "green"])
        user_values = itertools.cycle([{"id": 1}, {"id": 2}])

        events = {}

        # Create 6 events for the child group now
        for event in (
            self.create_message_event(
                "This is message #%s!",
                i,
                environment="production",
                release="version",
                project=project,
                now=now,
                sequence=sequence,
                tag_values=tag_values,
                user_values=user_values,
            )
            for i in range(6)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        # Create 10 events for the primary group now
        for event in (
            self.create_message_event(
                "This is message #%s.",
                i,
                environment="production",
                release="version2",
                project=project,
                now=now,
                tag_values=tag_values,
                user_values=user_values,
                sequence=sequence,
                fingerprint="group2",
            )
            for i in range(6, 16)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        child, primary = list(Group.objects.all())
        primary.status = GroupStatus.IGNORED
        primary.substatus = GroupSubStatus.UNTIL_ESCALATING
        primary.save()

        # The following event counts should be true here:
        # get_group_hourly_count(primary) == 10
        # get_group_hourly_count(child) == 6
        # query_groups_past_counts should show the same counts

        # Merge primary and child
        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [child.id], primary.id)
            merge_groups.delay(
                [child.id],
                primary.id,
                eventstream_state=eventstream_state,
                handle_forecasts_ids=[primary.id, child.id],
                merge_forecasts=True,
            )

        sleep(1)
        # The following event counts should be true here:
        # get_group_hourly_count(primary) == 16
        # query_groups_past_counts should show the same count

        # Unmerge primary to create new_child
        with self.tasks():
            unmerge.delay(
                project_id=project.id,
                source_id=primary.id,
                destination_id=None,
                fingerprints=[list(events.keys())[0]],
                actor_id=None,
                batch_size=5,
            )
        sleep(1)
        # The event counts for primary should be 10; the event counts for new_child should be 6
        primary, new_child = list(Group.objects.all())
        primary_unmerge_hour_count = get_group_hourly_count(
            primary
        )  # incorrect: returns 16, which is the count before unmerge
        past = query_groups_past_counts(list(Group.objects.all()))  # correct
        primary_unmerge_past_count = query_groups_past_counts(
            [primary]
        )  # incorrect: returns 16, which is the count before unmerge
        child_unmerge_hour_count = get_group_hourly_count(new_child)
        child_unmerge_past_count = query_groups_past_counts([new_child])
        assert past[0]["count()"] == 10
        assert past[1]["count()"] == 6
        assert primary_unmerge_hour_count == 10
        assert primary_unmerge_past_count[0]["count()"] == 10
        assert child_unmerge_hour_count == 6
        assert child_unmerge_past_count[0]["count()"] == 6
