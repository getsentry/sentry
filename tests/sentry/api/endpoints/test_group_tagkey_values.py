from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import GroupTagValue, TagKey
from sentry.testutils import APITestCase


class GroupTagKeyValuesTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(project=project)
        tagkey = TagKey.objects.create(project=project, key='foo')
        grouptagvalue = GroupTagValue.objects.create(group=group, key='foo', value='bar')

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-group-tagkey-values', kwargs={
            'group_id': group.id,
            'key': tagkey.key,
        })

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'
