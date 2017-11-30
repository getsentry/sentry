from __future__ import absolute_import

import functools
import hashlib
import itertools
import logging
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta

import pytz
from django.utils import timezone
from mock import patch

from sentry import tagstore
from sentry.app import tsdb
from sentry.event_manager import ScoreClause
from sentry.models import (
    Activity, Environment, EnvironmentProject, Event, EventMapping, Group, GroupHash, GroupRelease,
    Release, UserReport
)
from sentry.similarity import features, _make_index_backend
from sentry.tasks.unmerge import (
    get_caches, get_event_user_from_interface, get_fingerprint, get_group_backfill_attributes,
    get_group_creation_attributes, unmerge
)
from sentry.testutils import TestCase
from sentry.utils.dates import to_timestamp
from sentry.utils import redis

from six.moves import xrange

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get('default').get_local_client(0))


def test_get_fingerprint():
    assert get_fingerprint(
        Event(
            data={
                'sentry.interfaces.Message': {
                    'message': 'Hello world',
                },
            },
        )
    ) == hashlib.md5('Hello world').hexdigest()

    assert get_fingerprint(
        Event(
            data={
                'fingerprint': ['Not hello world'],
                'sentry.interfaces.Message': {
                    'message': 'Hello world',
                },
            },
        )
    ) == hashlib.md5('Not hello world').hexdigest()


@patch('sentry.similarity.features.index', new=index)
class UnmergeTestCase(TestCase):
    def test_get_group_creation_attributes(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=pytz.utc)
        events = [
            Event(
                platform='javascript',
                message='Hello from JavaScript',
                datetime=now,
                data={
                    'type': 'default',
                    'metadata': {},
                    'tags': [
                        ['level', 'info'],
                        ['logger', 'javascript'],
                    ],
                },
            ),
            Event(
                platform='python',
                message='Hello from Python',
                datetime=now - timedelta(hours=1),
                data={
                    'type': 'default',
                    'metadata': {},
                    'tags': [
                        ['level', 'error'],
                        ['logger', 'python'],
                    ],
                },
            ),
            Event(
                platform='java',
                message='Hello from Java',
                datetime=now - timedelta(hours=2),
                data={
                    'type': 'default',
                    'metadata': {},
                    'tags': [
                        ['level', 'debug'],
                        ['logger', 'java'],
                    ],
                },
            ),
        ]

        assert get_group_creation_attributes(
            get_caches(),
            events,
        ) == {
            'active_at': now - timedelta(hours=2),
            'first_seen': now - timedelta(hours=2),
            'last_seen': now,
            'platform': 'java',
            'message': 'Hello from JavaScript',
            'level': logging.INFO,
            'score': ScoreClause.calculate(3, now),
            'logger': 'java',
            'times_seen': 3,
            'first_release': None,
            'culprit': '',
            'data': {
                'type': 'default',
                'last_received': to_timestamp(now),
                'metadata': {},
            },
        }

    def test_get_group_backfill_attributes(self):
        now = datetime(2017, 5, 3, 6, 6, 6, tzinfo=pytz.utc)
        assert get_group_backfill_attributes(
            get_caches(),
            Group(
                active_at=now,
                first_seen=now,
                last_seen=now,
                platform='javascript',
                message='Hello from JavaScript',
                level=logging.INFO,
                score=ScoreClause.calculate(3, now),
                logger='javascript',
                times_seen=1,
                first_release=None,
                culprit='',
                data={
                    'type': 'default',
                    'last_received': to_timestamp(now),
                    'metadata': {},
                },
            ),
            [
                Event(
                    platform='python',
                    message='Hello from Python',
                    datetime=now - timedelta(hours=1),
                    data={
                        'type': 'default',
                        'metadata': {},
                        'tags': [
                            ['level', 'error'],
                            ['logger', 'python'],
                        ],
                    },
                ),
                Event(
                    platform='java',
                    message='Hello from Java',
                    datetime=now - timedelta(hours=2),
                    data={
                        'type': 'default',
                        'metadata': {},
                        'tags': [
                            ['level', 'debug'],
                            ['logger', 'java'],
                        ],
                    },
                ),
            ],
        ) == {
            'active_at': now - timedelta(hours=2),
            'first_seen': now - timedelta(hours=2),
            'platform': 'java',
            'score': ScoreClause.calculate(3, now),
            'logger': 'java',
            'times_seen': 3,
            'first_release': None,
        }

    def test_unmerge(self):
        def shift(i):
            return timedelta(seconds=1 << i)

        now = timezone.now().replace(microsecond=0) - shift(16)

        project = self.create_project()
        source = self.create_group(project)

        sequence = itertools.count(0)
        tag_values = itertools.cycle(['red', 'green', 'blue'])
        user_values = itertools.cycle([
            {
                'id': 1
            },
            {
                'id': 2
            },
        ])

        environment = Environment.objects.create(
            organization_id=project.organization_id,
            name='production',
        )
        EnvironmentProject.objects.create(
            environment=environment,
            project=project,
        )

        def create_message_event(template, parameters):
            i = next(sequence)

            event_id = uuid.UUID(
                fields=(i, 0x0, 0x1000, 0x80, 0x80, 0x808080808080, ),
            ).hex

            event = Event.objects.create(
                project_id=project.id,
                group_id=source.id,
                event_id=event_id,
                message='%s' % (id, ),
                datetime=now + shift(i),
                data={
                    'environment':
                    'production',
                    'type':
                    'default',
                    'metadata': {
                        'title': template % parameters,
                    },
                    'sentry.interfaces.Message': {
                        'message': template,
                        'params': parameters,
                        'formatted': template % parameters,
                    },
                    'sentry.interfaces.User':
                    next(user_values),
                    'tags': [
                        ['color', next(tag_values)],
                        ['environment', 'production'],
                        ['sentry:release', 'version'],
                    ],
                },
            )

            with self.tasks():
                Group.objects.add_tags(
                    source,
                    environment,
                    tags=event.get_tags(),
                )

            EventMapping.objects.create(
                project_id=project.id,
                group_id=source.id,
                event_id=event_id,
                date_added=event.datetime,
            )

            UserReport.objects.create(
                project_id=project.id,
                group_id=source.id,
                event_id=event_id,
                name='Log Hat',
                email='ceo@corptron.com',
                comments='Quack',
            )

            features.record([event])

            return event

        events = OrderedDict()

        for event in (create_message_event('This is message #%s.', i) for i in xrange(10)):
            events.setdefault(get_fingerprint(event), []).append(event)

        for event in (create_message_event('This is message #%s!', i) for i in xrange(10, 17)):
            events.setdefault(get_fingerprint(event), []).append(event)

        assert len(events) == 2
        assert sum(map(len, events.values())) == 17

        # XXX: This is super contrived considering that it doesn't actually go
        # through the event pipeline, but them's the breaks, eh?
        for fingerprint in events.keys():
            GroupHash.objects.create(
                project=project,
                group=source,
                hash=fingerprint,
            )

        assert set(
            [(gtk.key, gtk.values_seen)
             for gtk in tagstore.get_group_tag_keys(source.project_id, source.id, None)]
        ) == set([
            (u'color', 3),
            (u'environment', 1),
            (u'sentry:release', 1)
        ])

        assert set(
            [(gtv.key, gtv.value, gtv.times_seen)
             for gtv in tagstore.get_group_tag_values(source.project_id, source.id, environment_id=None)]
        ) == set([
            (u'color', u'red', 6),
            (u'color', u'green', 6),
            (u'color', u'blue', 5),
            (u'environment', u'production', 17),
            (u'sentry:release', u'version', 17),
        ])

        assert features.compare(source) == [
            (source.id, {
                'exception:message:character-shingles': None,
                'exception:stacktrace:application-chunks': None,
                'exception:stacktrace:pairs': None,
                'message:message:character-shingles': 1.0
            }),
        ]

        with self.tasks():
            unmerge.delay(
                source.project_id,
                source.id,
                None,
                [events.keys()[1]],
                None,
                batch_size=5,
            )

        assert list(
            Group.objects.filter(id=source.id).values_list(
                'times_seen',
                'first_seen',
                'last_seen',
            )
        ) == [(10, now + shift(0), now + shift(9), )]

        source_activity = Activity.objects.get(
            group_id=source.id,
            type=Activity.UNMERGE_SOURCE,
        )

        destination = Group.objects.get(
            id=source_activity.data['destination_id'],
        )

        assert list(
            Group.objects.filter(id=destination.id).values_list(
                'times_seen',
                'first_seen',
                'last_seen',
            )
        ) == [(7, now + shift(10), now + shift(16), )]

        assert source_activity.data == {
            'destination_id': destination.id,
            'fingerprints': [events.keys()[1]],
        }

        assert source.id != destination.id
        assert source.project == destination.project

        assert Activity.objects.get(
            group_id=destination.id,
            type=Activity.UNMERGE_DESTINATION,
        ).data == {
            'source_id': source.id,
            'fingerprints': [events.keys()[1]],
        }

        source_event_event_ids = map(
            lambda event: event.event_id,
            events.values()[0],
        )

        assert source.event_set.count() == 10

        assert set(
            EventMapping.objects.filter(
                group_id=source.id,
            ).values_list('event_id', flat=True)
        ) == set(source_event_event_ids)

        assert set(
            UserReport.objects.filter(
                group_id=source.id,
            ).values_list('event_id', flat=True)
        ) == set(source_event_event_ids)

        assert set(GroupHash.objects.filter(
            group_id=source.id,
        ).values_list('hash', flat=True)) == set([events.keys()[0]])

        assert set(
            GroupRelease.objects.filter(
                group_id=source.id,
            ).values_list('environment', 'first_seen', 'last_seen')
        ) == set([
            (u'production', now + shift(0), now + shift(9), ),
        ])

        assert set(
            [(gtk.key, gtk.values_seen)
             for gtk in tagstore.get_group_tag_keys(source.project_id, source.id, None)]
        ) == set([
            (u'color', 3),
            (u'environment', 1),
            (u'sentry:release', 1),
        ])

        assert set(
            [(gtv.key, gtv.value, gtv.times_seen,
              gtv.first_seen, gtv.last_seen)
             for gtv in tagstore.get_group_tag_values(source.project_id, source.id, environment_id=None)]
        ) == set([
            (u'color', u'red', 4, now + shift(0), now + shift(9), ),
            (u'color', u'green', 3, now + shift(1), now + shift(7), ),
            (u'color', u'blue', 3, now + shift(2), now + shift(8), ),
            (u'environment', u'production', 10, now + shift(0), now + shift(9), ),
            (u'sentry:release', u'version', 10, now + shift(0), now + shift(9), ),
        ])

        destination_event_event_ids = map(
            lambda event: event.event_id,
            events.values()[1],
        )

        assert destination.event_set.count() == 7

        assert set(
            EventMapping.objects.filter(
                group_id=destination.id,
            ).values_list('event_id', flat=True)
        ) == set(destination_event_event_ids)

        assert set(
            UserReport.objects.filter(
                group_id=destination.id,
            ).values_list('event_id', flat=True)
        ) == set(destination_event_event_ids)

        assert set(
            GroupHash.objects.filter(
                group_id=destination.id,
            ).values_list('hash', flat=True)
        ) == set([events.keys()[1]])

        assert set(
            GroupRelease.objects.filter(
                group_id=destination.id,
            ).values_list('environment', 'first_seen', 'last_seen')
        ) == set([
            (u'production', now + shift(10), now + shift(16), ),
        ])

        assert set([(gtk.key, gtk.values_seen) for gtk in tagstore.get_group_tag_keys(source.project_id, source.id, None)]
                   ) == set(
            [
                (u'color', 3),
                (u'environment', 1),
                (u'sentry:release', 1),
            ]
        )

        assert set(
            [(gtv.key, gtv.value, gtv.times_seen,
              gtv.first_seen, gtv.last_seen)
             for gtv in tagstore.get_group_tag_values(destination.project_id, destination.id, environment_id=None)]
        ) == set([
            (u'color', u'red', 2, now + shift(12), now + shift(15), ),
            (u'color', u'green', 3, now + shift(10), now + shift(16), ),
            (u'color', u'blue', 2, now + shift(11), now + shift(14), ),
            (u'environment', u'production', 7, now + shift(10), now + shift(16), ),
            (u'sentry:release', u'version', 7, now + shift(10), now + shift(16), ),
        ])

        rollup_duration = 3600

        time_series = tsdb.get_range(
            tsdb.models.group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
        )

        environment_time_series = tsdb.get_range(
            tsdb.models.group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
            environment_id=environment.id,
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

        for series in [time_series, environment_time_series]:
            assert_series_contains(
                get_expected_series_values(rollup_duration, events.values()[0]),
                series[source.id],
                0,
            )

            assert_series_contains(
                get_expected_series_values(rollup_duration, events.values()[1]),
                series[destination.id],
                0,
            )

        time_series = tsdb.get_distinct_counts_series(
            tsdb.models.users_affected_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
        )

        environment_time_series = tsdb.get_distinct_counts_series(
            tsdb.models.users_affected_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
            environment_id=environment.id,
        )

        def collect_by_user_tag(aggregate, event):
            aggregate = aggregate if aggregate is not None else set()
            aggregate.add(
                get_event_user_from_interface(
                    event.data['sentry.interfaces.User'],
                ).tag_value,
            )
            return aggregate

        for series in [time_series, environment_time_series]:
            assert_series_contains(
                {
                    timestamp: len(values)
                    for timestamp, values in get_expected_series_values(
                        rollup_duration,
                        events.values()[0],
                        collect_by_user_tag,
                    ).items()
                },
                series[source.id],
            )

            assert_series_contains(
                {
                    timestamp: len(values)
                    for timestamp, values in get_expected_series_values(
                        rollup_duration,
                        events.values()[1],
                        collect_by_user_tag,
                    ).items()
                },
                time_series[destination.id],
            )

        time_series = tsdb.get_most_frequent_series(
            tsdb.models.frequent_releases_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
        )

        def collect_by_release(group, aggregate, event):
            aggregate = aggregate if aggregate is not None else {}
            release = GroupRelease.objects.get(
                group_id=group.id,
                environment=event.data['environment'],
                release_id=Release.objects.get(
                    organization_id=project.organization_id,
                    version=event.get_tag('sentry:release'),
                ).id,
            ).id
            aggregate[release] = aggregate.get(release, 0) + 1
            return aggregate

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                events.values()[0],
                functools.partial(
                    collect_by_release,
                    source,
                ),
            ),
            time_series[source.id],
            {},
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                events.values()[1],
                functools.partial(
                    collect_by_release,
                    destination,
                ),
            ),
            time_series[destination.id],
            {},
        )

        time_series = tsdb.get_most_frequent_series(
            tsdb.models.frequent_environments_by_group,
            [source.id, destination.id],
            now - timedelta(seconds=rollup_duration),
            now + shift(16),
            rollup_duration,
        )

        def collect_by_environment(aggregate, event):
            aggregate = aggregate if aggregate is not None else {}
            environment = Environment.objects.get(
                organization_id=project.organization_id,
                name=event.data['environment'],
            ).id
            aggregate[environment] = aggregate.get(environment, 0) + 1
            return aggregate

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                events.values()[0],
                collect_by_environment,
            ),
            time_series[source.id],
            {},
        )

        assert_series_contains(
            get_expected_series_values(
                rollup_duration,
                events.values()[1],
                collect_by_environment,
            ),
            time_series[destination.id],
            {},
        )

        source_similar_items = features.compare(source)
        assert source_similar_items[0] == (source.id, {
            'exception:message:character-shingles': None,
            'exception:stacktrace:application-chunks': None,
            'exception:stacktrace:pairs': None,
            'message:message:character-shingles': 1.0,
        })
        assert source_similar_items[1][0] == destination.id
        assert source_similar_items[1][1]['message:message:character-shingles'] < 1.0

        destination_similar_items = features.compare(destination)
        assert destination_similar_items[0] == (
            destination.id, {
                'exception:message:character-shingles': None,
                'exception:stacktrace:application-chunks': None,
                'exception:stacktrace:pairs': None,
                'message:message:character-shingles': 1.0
            }
        )
        assert destination_similar_items[1][0] == source.id
        assert destination_similar_items[1][1]['message:message:character-shingles'] < 1.0
