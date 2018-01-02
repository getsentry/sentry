from __future__ import absolute_import

from sentry import tagstore
from sentry.testutils import APITestCase


class GroupTagsTest(APITestCase):
    def test_simple(self):
        this_group = self.create_group()
        this_group.data['tags'] = (['foo', 'bar'], ['biz', 'baz'])
        this_group.save()

        other_group = self.create_group()
        other_group.data['tags'] = (['abc', 'xyz'], )
        other_group.save()

        for group in (this_group, other_group):
            for key, value in group.data['tags']:
                tagstore.create_tag_key(
                    project_id=group.project_id,
                    environment_id=None,
                    key=key,
                )
                tagstore.create_tag_value(
                    project_id=group.project_id,
                    environment_id=None,
                    key=key,
                    value=value,
                )
                tagstore.create_group_tag_key(
                    project_id=group.project_id,
                    group_id=group.id,
                    environment_id=None,
                    key=key,
                )
                tagstore.create_group_tag_value(
                    project_id=group.project_id,
                    group_id=group.id,
                    environment_id=None,
                    key=key,
                    value=value,
                )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/'.format(this_group.id)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
