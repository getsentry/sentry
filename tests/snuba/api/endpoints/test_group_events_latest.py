from __future__ import absolute_import

import six

from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupEventsLatestTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupEventsLatestTest, self).setUp()
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))

        self.event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "fingerprint": ["group_1"],
                "timestamp": two_min_ago,
            },
            project_id=project.id,
        )

        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "fingerprint": ["group_1"],
                "timestamp": min_ago,
            },
            project_id=project.id,
        )

        self.group = Group.objects.first()

    def test_snuba_no_environment(self):
        url = u"/api/0/issues/{}/events/latest/".format(self.group.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == six.text_type(self.event2.event_id)

    def test_snuba_environment(self):
        url = u"/api/0/issues/{}/events/latest/".format(self.group.id)
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200
        assert response.data["id"] == six.text_type(self.event2.event_id)

    def test_simple(self):
        url = u"/api/0/issues/{}/events/latest/".format(self.group.id)
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == six.text_type(self.event2.event_id)
