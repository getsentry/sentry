from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone

from sentry import tagstore
from sentry.models import Environment
from sentry.testutils import APITestCase


class GroupEventsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

        url = '/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(event_1.id),
                six.text_type(event_2.id),
            ]
        )

    def test_tags(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

        tagkey_1 = tagstore.create_tag_key(
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='foo')
        tagkey_2 = tagstore.create_tag_key(
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='bar')
        tagvalue_1 = tagstore.create_tag_value(
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='foo',
            value='baz')
        tagvalue_2 = tagstore.create_tag_value(
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='bar',
            value='biz')
        tagvalue_3 = tagstore.create_tag_value(
            project_id=group.project_id,
            environment_id=self.environment.id,
            key='bar',
            value='buz')

        tagstore.create_event_tags(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=self.environment.id,
            event_id=event_1.id,
            tags=[
                (tagkey_1.key, tagvalue_1.value),
                (tagkey_2.key, tagvalue_3.value),
            ],
        )
        tagstore.create_event_tags(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=self.environment.id,
            event_id=event_2.id,
            tags=[
                (tagkey_2.key, tagvalue_2.value),
            ],
        )

        url = '/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url + '?query=foo:baz', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(event_1.id)

        response = self.client.get(url + '?query=bar:biz', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(event_2.id)

        response = self.client.get(url + '?query=bar:biz%20foo:baz', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + '?query=bar:buz%20foo:baz', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(event_1.id)

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

    def test_search_event_by_id(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event('a' * 32, group=group)
        self.create_event('b' * 32, group=group)
        query = event_1.event_id

        url = '/api/0/issues/{}/events/?query={}'.format(group.id, query)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_1.event_id

    def test_search_event_by_message(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(event_id='a' * 32, group=group, message="foo bar hello world")

        event_2 = self.create_event(event_id='b' * 32, group=group, message='this bar hello world ')

        query_1 = "foo"
        query_2 = "hello+world"

        # Single Word Query
        url = '/api/0/issues/{}/events/?query={}'.format(group.id, query_1)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(
            event_1.id) and response.data[0]['eventID'] == event_1.event_id

        # Multiple Word Query
        url = '/api/0/issues/{}/events/?query={}'.format(group.id, query_2)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(event_1.id),
                six.text_type(event_2.id),
            ]
        )

    def test_environment(self):
        self.login_as(user=self.user)

        group = self.create_group()
        events = {}

        for name in ['production', 'development']:
            environment = Environment.get_or_create(group.project, name)

            tagstore.get_or_create_tag_key(
                project_id=group.project_id,
                environment_id=environment.id,
                key='environment',
            )

            tagstore.create_tag_value(
                project_id=group.project_id,
                environment_id=environment.id,
                key='environment',
                value=name,
            )

            events[name] = event = self.create_event(
                group=group,
                tags={'environment': name},
            )

            tagstore.create_event_tags(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=environment.id,
                event_id=event.id,
                tags=[
                    ('environment', name),
                ],
            )

        url = '/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url + '?environment=production', format='json')

        assert response.status_code == 200, response.content
        assert set(map(lambda x: x['id'], response.data)) == set([
            six.text_type(events['production'].id),
        ])

        url = '/api/0/issues/{}/events/'.format(group.id)
        response = self.client.get(url + '?environment=invalid', format='json')

        assert response.status_code == 200, response.content
        assert response.data == []

        url = '/api/0/issues/{}/events/'.format(group.id)
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
            'a' * 32,
            group=group,
            datetime=timezone.now() - timedelta(days=2),
        )
        event_2 = self.create_event('b' * 32, group=group)

        with self.options({'system.event-retention-days': 1}):
            response = self.client.get('/api/0/issues/{}/events/'.format(group.id))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(event_2.id),
            ]
        )
