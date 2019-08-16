from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class ProjectEventDetailsTest(APITestCase):
    def setUp(self):
        super(ProjectEventDetailsTest, self).setUp()
        self.login_as(user=self.user)
        project = self.create_project()

        one_min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        three_min_ago = (timezone.now() - timedelta(minutes=3)).isoformat()[:19]

        self.prev_event = self.store_event(
            data={"timestamp": three_min_ago, "fingerprint": ["group-1"]}, project_id=project.id
        )
        self.cur_event = self.store_event(
            data={"timestamp": two_min_ago, "fingerprint": ["group-1"]}, project_id=project.id
        )
        self.next_event = self.store_event(
            data={
                "timestamp": one_min_ago,
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"environment": "production"},
            },
            project_id=project.id,
        )

    def test_simple(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_event.event_id,
                "project_slug": self.cur_event.project.slug,
                "organization_slug": self.cur_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.cur_event.event_id)
        assert response.data["nextEventID"] == six.text_type(self.next_event.event_id)
        assert response.data["previousEventID"] == six.text_type(self.prev_event.event_id)
        assert response.data["groupID"] == six.text_type(self.cur_event.group.id)

        # Same event can be looked up by primary key
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_event.event_id,
                "project_slug": self.cur_event.project.slug,
                "organization_slug": self.cur_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.cur_event.event_id)
        assert response.data["nextEventID"] == six.text_type(self.next_event.event_id)
        assert response.data["previousEventID"] == six.text_type(self.prev_event.event_id)
        assert response.data["groupID"] == six.text_type(self.cur_event.group.id)

    def test_prev_has_no_prev(self):
        # Test that the "previous" event does not itself have a "previousEventID"
        # pointing back to the current event. i.e. test that there is not a redirect
        # loop between next and previous events that occur within the same second.

        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.prev_event.event_id,
                "project_slug": self.prev_event.project.slug,
                "organization_slug": self.prev_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.prev_event.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == self.cur_event.event_id
        assert response.data["groupID"] == six.text_type(self.prev_event.group.id)
