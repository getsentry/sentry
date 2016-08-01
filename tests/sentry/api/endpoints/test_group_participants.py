from __future__ import absolute_import, print_function

import six

from sentry.models import GroupSubscription
from sentry.testutils import APITestCase


class GroupParticipantsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        GroupSubscription.objects.create(
            user=self.user,
            group=group,
            project=group.project,
            is_active=True,
        )

        url = '/api/0/issues/{}/participants/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.user.id)
