from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from freezegun import freeze_time

from sentry.testutils import APITestCase, SnubaTestCase


class GroupEventsTest(APITestCase, SnubaTestCase):
    """
    This is more or less an exact copy of the tests under:

        /tests/sentry/api/endpoints/test_group_events.py

    with the removal of any explicit tagstore key/value creation calls, and
    comparing the resulting events by `eventID`, instead of `id`.
    """

    def setUp(self):
        super(GroupEventsTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(
            event_id='a' * 32,
            datetime=self.min_ago,
            group=group
        )
        event_2 = self.create_event(
            event_id='b' * 32,
            datetime=self.min_ago,
            group=group
        )

        url = u'/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                six.text_type(event_1.event_id),
                six.text_type(event_2.event_id),
            ]
        )

    def test_tags(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(
            event_id='a' * 32,
            datetime=self.min_ago,
            group=group,
            tags={
                'foo': 'baz',
                'bar': 'buz',
            }
        )
        event_2 = self.create_event(
            event_id='b' * 32,
            datetime=self.min_ago - timedelta(minutes=1),
            group=group,
            tags={
                'bar': 'biz',
            }
        )

        url = u'/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url + '?query=foo:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == six.text_type(event_1.event_id)

        response = self.client.get(url + '?query=!foo:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == six.text_type(event_2.event_id)

        response = self.client.get(url + '?query=bar:biz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == six.text_type(event_2.event_id)

        response = self.client.get(url + '?query=bar:biz%20foo:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=bar:buz%20foo:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == six.text_type(event_1.event_id)

        response = self.client.get(url + '?query=bar:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=a:b', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=bar:b', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=bar:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=!bar:baz', format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['eventID'] == six.text_type(event_1.event_id)
        assert response.data[1]['eventID'] == six.text_type(event_2.event_id)

    def test_search_event_by_id(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(
            event_id='a' * 32,
            datetime=self.min_ago,
            group=group
        )
        self.create_event(
            event_id='b' * 32,
            datetime=self.min_ago,
            group=group
        )

        url = u'/api/0/issues/{}/events/?query={}'.format(group.id, event_1.event_id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_1.event_id

    def test_search_event_by_message(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(
            event_id='a' * 32,
            datetime=self.min_ago,
            group=group,
            message="foo bar hello world"
        )

        event_2 = self.create_event(
            event_id='b' * 32,
            datetime=self.min_ago,
            group=group,
            message='this bar hello world '
        )

        query_1 = "foo"
        query_2 = "hello+world"

        # Single Word Query
        url = u'/api/0/issues/{}/events/?query={}'.format(group.id, query_1)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_1.event_id

        # Multiple Word Query
        url = u'/api/0/issues/{}/events/?query={}'.format(group.id, query_2)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                six.text_type(event_1.event_id),
                six.text_type(event_2.event_id),
            ]
        )

    def test_environment(self):
        self.login_as(user=self.user)
        events = {}

        for name in ['production', 'development']:
            events[name] = self.store_event(
                data={
                    'fingerprint': ['put-me-in-group1'],
                    'timestamp': self.min_ago.isoformat()[:19],
                    'environment': name
                },
                project_id=self.project.id
            )

        # Asserts that all are in the same group
        group_id, = set(e.group.id for e in events.values())

        url = u'/api/0/issues/{}/events/'.format(group_id)
        response = self.client.get(url + '?environment=production', format='json')

        assert response.status_code == 200, response.content
        assert set(map(lambda x: x['eventID'], response.data)) == set([
            six.text_type(events['production'].event_id),
        ])

        response = self.client.get(
            url,
            data={'environment': ['production', 'development']},
            format='json',
        )
        assert response.status_code == 200, response.content
        assert set(map(lambda x: x['eventID'], response.data)) == set([
            six.text_type(event.event_id)
            for event in events.values()
        ])

        response = self.client.get(url + '?environment=invalid', format='json')

        assert response.status_code == 200, response.content
        assert response.data == []

        response = self.client.get(
            url + '?environment=production&query=environment:development',
            format='json')

        assert response.status_code == 200, response.content
        assert response.data == []

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            event_id='a' * 32,
            group=group,
            datetime=timezone.now() - timedelta(days=2),
        )
        event_2 = self.create_event(
            event_id='b' * 32,
            datetime=self.min_ago,
            group=group
        )

        with self.options({'system.event-retention-days': 1}):
            response = self.client.get(u'/api/0/issues/{}/events/'.format(group.id))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                six.text_type(event_2.event_id),
            ]
        )

    def test_search_event_has_tags(self):
        self.login_as(user=self.user)

        group = self.create_group()
        self.create_event(
            event_id='a' * 32,
            datetime=self.min_ago,
            group=group,
            message="foo",
            tags={
                'logger': 'python'
            }
        )

        response = self.client.get(u'/api/0/issues/{}/events/'.format(group.id))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['tags'][0]['key'] == 'logger'
        assert response.data[0]['tags'][0]['value'] == 'python'

    @freeze_time()
    def test_date_filters(self):
        self.login_as(user=self.user)

        first_seen = timezone.now() - timedelta(days=5)

        group = self.create_group(first_seen=first_seen)
        event_1 = self.create_event(
            event_id='a' * 32,
            datetime=first_seen,
            group=group,
            message='foo',
            tags={
                'logger': 'python',
            }
        )
        event_2 = self.create_event(
            event_id='b' * 32,
            datetime=timezone.now() - timedelta(days=1),
            group=group,
            message='bar',
        )

        response = self.client.get(
            u'/api/0/issues/{}/events/'.format(group.id),
            data={
                'statsPeriod': '6d',
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                six.text_type(event_1.event_id),
                six.text_type(event_2.event_id),
            ]
        )

        response = self.client.get(
            u'/api/0/issues/{}/events/'.format(group.id),
            data={
                'statsPeriod': '2d',
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == six.text_type(event_2.event_id)

    def test_multiple_group(self):
        self.login_as(user=self.user)

        event_1 = self.store_event(
            data={
                'fingerprint': ['group_1'],
                'event_id': 'a' * 32,
                'message': 'foo',
                'timestamp': self.min_ago.isoformat()[:19],
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                'fingerprint': ['group_2'],
                'event_id': 'b' * 32,
                'message': 'group2',
                'timestamp': self.min_ago.isoformat()[:19],
            },
            project_id=self.project.id,
        )

        for event in (event_1, event_2):
            url = u'/api/0/issues/{}/events/'.format(event.group.id)
            response = self.client.get(url, format='json')
            assert response.status_code == 200, response.content
            assert len(response.data) == 1, response.data
            assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
                [
                    six.text_type(event.event_id),
                ]
            )

    def test_boolean_feature_flag_failure(self):
        self.login_as(user=self.user)
        group = self.create_group()

        for query in ['title:hi OR title:hello', 'title:hi AND title:hello']:
            url = u'/api/0/issues/{}/events/?query={}'.format(group.id, query)
            response = self.client.get(url, format='json')
            assert response.status_code == 400
            assert response.data == {
                'detail':
                'Boolean search operator OR and AND not allowed in this search.',
            }
