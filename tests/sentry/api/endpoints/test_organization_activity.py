from __future__ import absolute_import

import six

from sentry.models import Activity
from sentry.testutils import APITestCase


class OrganizationActivityTest(APITestCase):
    def test_simple(self):
        group = self.group
        org = group.organization

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=self.user,
            data={'text': 'hello world'},
        )

        self.login_as(user=self.user)

        url = '/api/0/organizations/{}/activity/'.format(org.slug)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(activity.id)
