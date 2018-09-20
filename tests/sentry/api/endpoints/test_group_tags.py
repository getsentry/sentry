from __future__ import absolute_import

from sentry import tagstore
from sentry.testutils import APITestCase


class GroupTagsTest(APITestCase):
    def test_simple(self):
        this_group = self.create_group()
        this_group.data['tags'] = (['foo', ['bar', 'quux']], ['biz', 'baz'], [
                                   'sentry:release', 'releaseme'])

        this_group.save()

        other_group = self.create_group()
        other_group.data['tags'] = (['abc', 'xyz'],)
        other_group.save()

        for group in (this_group, other_group):
            for key, values in group.data['tags']:
                tagstore.create_tag_key(
                    project_id=group.project_id,
                    environment_id=None,
                    key=key,
                )
                tagstore.create_group_tag_key(
                    project_id=group.project_id,
                    group_id=group.id,
                    environment_id=None,
                    key=key,
                )

                if not isinstance(values, list):
                    values = [values]
                for value in values:
                    tagstore.create_tag_value(
                        project_id=group.project_id,
                        environment_id=None,
                        key=key,
                        value=value,
                    )
                    tagstore.create_group_tag_value(
                        project_id=group.project_id,
                        group_id=group.id,
                        environment_id=None,
                        key=key,
                        value=value,
                    )

        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/'.format(this_group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        data = sorted(response.data, key=lambda r: r['key'])
        assert data[0]['key'] == 'biz'
        assert len(data[0]['topValues']) == 1

        assert data[1]['key'] == 'foo'
        assert len(data[1]['topValues']) == 2

        assert data[2]['key'] == 'release'  # Formatted from sentry:release
        assert len(data[2]['topValues']) == 1

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
        assert response.data == []
