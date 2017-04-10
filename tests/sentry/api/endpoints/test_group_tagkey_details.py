from __future__ import absolute_import

import six

from sentry.models import GroupTagKey, GroupTagValue, TagKey, TagValue
from sentry.testutils import APITestCase


class GroupTagDetailsTest(APITestCase):
    def test_simple(self):
        group = self.create_group()
        group.data['tags'] = (['foo', 'bar'],)
        group.save()

        key, value = group.data['tags'][0]

        tagkey = TagKey.objects.create(
            project=group.project,
            key=key,
            values_seen=2,
        )
        TagValue.objects.create(
            project=group.project,
            key=key,
            value=value,
            times_seen=4,
        )
        GroupTagKey.objects.create(
            project=group.project,
            group=group,
            key=key,
            values_seen=1,
        )
        GroupTagValue.objects.create(
            project=group.project,
            group=group,
            key=key,
            value=value,
            times_seen=3,
        )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/{}/'.format(group.id, tagkey.key)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(tagkey.id)
        assert response.data['key'] == six.text_type(tagkey.key)
        assert response.data['uniqueValues'] == 1
        assert response.data['totalValues'] == 3
