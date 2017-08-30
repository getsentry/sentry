from __future__ import absolute_import

from sentry.models import GroupTagKey, GroupTagValue, TagKey, TagValue
from sentry.testutils import APITestCase


class GroupTagsTest(APITestCase):
    def test_simple(self):
        group = self.create_group()
        group.data['tags'] = (['foo', 'bar'], ['biz', 'baz'])
        group.save()

        for key, value in group.data['tags']:
            TagKey.objects.create(
                project_id=group.project_id,
                key=key,
            )
            TagValue.objects.create(
                project_id=group.project_id,
                key=key,
                value=value,
            )
            GroupTagKey.objects.create(
                project_id=group.project_id,
                group_id=group.id,
                key=key,
            )
            GroupTagValue.objects.create(
                project_id=group.project_id,
                group_id=group.id,
                key=key,
                value=value,
            )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/'.format(group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
