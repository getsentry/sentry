from __future__ import absolute_import

import six

from sentry.models import EventTag, TagKey, TagValue
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
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            six.text_type(event_1.id),
            six.text_type(event_2.id),
        ])

    def test_tags(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

        tagkey_1 = TagKey.objects.create(project=group.project, key='foo')
        tagkey_2 = TagKey.objects.create(project=group.project, key='bar')
        tagvalue_1 = TagValue.objects.create(project=group.project, key='foo', value='baz')
        tagvalue_2 = TagValue.objects.create(project=group.project, key='bar', value='biz')
        tagvalue_3 = TagValue.objects.create(project=group.project, key='bar', value='buz')

        EventTag.objects.create(
            project_id=group.project_id,
            group_id=group.id,
            event_id=event_1.id,
            key_id=tagkey_1.id,
            value_id=tagvalue_1.id,
        )
        EventTag.objects.create(
            project_id=group.project_id,
            group_id=group.id,
            event_id=event_2.id,
            key_id=tagkey_2.id,
            value_id=tagvalue_2.id,
        )
        EventTag.objects.create(
            project_id=group.project_id,
            group_id=group.id,
            event_id=event_1.id,
            key_id=tagkey_2.id,
            value_id=tagvalue_3.id,
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
