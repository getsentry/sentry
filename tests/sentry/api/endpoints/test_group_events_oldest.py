from __future__ import absolute_import

import six

from datetime import datetime

from sentry.testutils import APITestCase


class GroupEventsOldestTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event_1 = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 25),
        )
        self.create_event(
            event_id='b',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 26),
        )

        url = '/api/0/issues/{}/events/oldest/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert response.data['id'] == six.text_type(event_1.id)
