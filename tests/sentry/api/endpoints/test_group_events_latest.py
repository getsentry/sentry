from __future__ import absolute_import

import six

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupEventsLatestEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupEventsLatestEndpointTest, self).setUp()

        self.login_as(user=self.user)
        project = self.create_project()

        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "development",
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )

    def test_get_simple(self):
        url = u"/api/0/issues/{}/events/latest/".format(self.event_a.group.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.event_c.event_id)
        assert response.data["previousEventID"] == six.text_type(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_get_with_environment(self):
        url = u"/api/0/issues/{}/events/latest/".format(self.event_a.group.id)
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.event_b.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
