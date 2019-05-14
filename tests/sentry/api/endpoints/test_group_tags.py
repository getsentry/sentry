from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry import tagstore
from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class GroupTagsTest(APITestCase, SnubaTestCase):
    def _create_tags(self, group, environment_id=None):
        for key, values in group.data['tags']:
            tagstore.create_tag_key(
                project_id=group.project_id,
                environment_id=environment_id,
                key=key,
            )
            tagstore.create_group_tag_key(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=environment_id,
                key=key,
            )

            if not isinstance(values, list):
                values = [values]
            for value in values:
                tagstore.create_tag_value(
                    project_id=group.project_id,
                    environment_id=environment_id,
                    key=key,
                    value=value,
                )
                tagstore.create_group_tag_value(
                    project_id=group.project_id,
                    group_id=group.id,
                    environment_id=environment_id,
                    key=key,
                    value=value,
                )

    def test_simple(self):
        this_event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    'foo': 'bar',
                    'biz': 'baz',
                    'sentry:release': 'releaseme',
                },
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    'foo': 'quux',
                },
            },
            project_id=self.project.id,
        )
        this_group = this_event.group

        self.store_event(
            data={
                'fingerprint': ['put-me-in-group2'],
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    'abc': 'xyz',
                },
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/'.format(this_group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        print response.data
        assert len(response.data) == 4

        data = sorted(response.data, key=lambda r: r['key'])
        assert data[0]['key'] == 'biz'
        assert len(data[0]['topValues']) == 1

        assert data[1]['key'] == 'foo'
        assert len(data[1]['topValues']) == 2

        assert data[2]['key'] == 'level'
        assert len(data[2]['topValues']) == 1

        assert data[3]['key'] == 'release'  # Formatted from sentry:release
        assert len(data[3]['topValues']) == 1

        # Use the key= queryparam to grab results for specific tags
        url = u'/api/0/issues/{}/tags/?key=foo&key=sentry:release'.format(this_group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        data = sorted(response.data, key=lambda r: r['key'])

        assert data[0]['key'] == 'foo'
        assert len(data[0]['topValues']) == 2
        assert set(v['value'] for v in data[0]['topValues']) == set(['bar', 'quux'])

        assert data[1]['key'] == 'release'
        assert len(data[1]['topValues']) == 1

    def test_invalid_env(self):
        this_group = self.create_group()
        self.login_as(user=self.user)
        url = u'/api/0/issues/{}/tags/'.format(this_group.id)
        response = self.client.get(url, {'environment': 'notreal'}, format='json')
        assert response.status_code == 404

    def test_valid_env(self):
        env = self.create_environment(project=self.project)
        event = self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'environment': env.name,
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {
                    'foo': 'bar',
                    'biz': 'baz',
                },
            },
            project_id=self.project.id,
        )
        group = event.group

        self.login_as(user=self.user)
        url = u'/api/0/issues/{}/tags/'.format(group.id)
        response = self.client.get(url, {'environment': env.name}, format='json')
        assert response.status_code == 200
        assert len(response.data) == 4
