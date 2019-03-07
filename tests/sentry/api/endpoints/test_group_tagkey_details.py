from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.testutils import APITestCase


class GroupTagDetailsTest(APITestCase):
    def test_simple(self):
        group = self.create_group()
        group.data['tags'] = (['foo', 'bar'], )
        group.save()

        key, value = group.data['tags'][0]
        tagkey = tagstore.create_tag_key(
            project_id=group.project_id,
            environment_id=None,
            key=key,
            values_seen=2
        )
        tagstore.create_tag_value(
            project_id=group.project_id,
            environment_id=None,
            key=key,
            value=value,
            times_seen=4
        )
        tagstore.create_group_tag_key(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=None,
            key=key,
            values_seen=1,
        )
        tagstore.create_group_tag_value(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=None,
            key=key,
            value=value,
            times_seen=3,
        )

        self.login_as(user=self.user)

        url = u'/api/0/issues/{}/tags/{}/'.format(group.id, tagkey.key)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data['key'] == six.text_type(tagkey.key)
        assert response.data['totalValues'] == 3
