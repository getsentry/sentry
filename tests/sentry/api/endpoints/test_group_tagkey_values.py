from __future__ import absolute_import

from sentry.models import GroupTagValue, TagKey, TagValue
from sentry.testutils import APITestCase


class GroupTagKeyValuesTest(APITestCase):
    def test_simple(self):
        key, value = 'foo', 'bar'

        project = self.create_project()
        group = self.create_group(project=project)
        TagKey.objects.create(project=project, key=key)
        TagValue.objects.create(
            project=project,
            key=key,
            value=value,
        )
        GroupTagValue.objects.create(
            project=project,
            group=group,
            key=key,
            value=value,
        )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/{}/values/'.format(group.id, key)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'
