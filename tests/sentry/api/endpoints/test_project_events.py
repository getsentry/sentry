from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(ProjectEventsTest, self).setUp()

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]

        event_1 = self.store_event(
            data={"fingerprint": ["group_1"], "timestamp": min_ago}, project_id=project.id
        )

        event_2 = self.store_event(
            data={"fingerprint": ["group_1"], "timestamp": min_ago}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [six.text_type(event_1.event_id), six.text_type(event_2.event_id)]
        )

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        two_days_ago = (timezone.now() - timedelta(days=2)).isoformat()[:19]

        self.store_event(
            data={"fingerprint": ["group_2"], "timestamp": two_days_ago}, project_id=project.id
        )

        event_2 = self.store_event(
            data={"fingerprint": ["group_2"], "timestamp": min_ago}, project_id=project.id
        )

        with self.options({"system.event-retention-days": 1}):
            url = reverse(
                "sentry-api-0-project-events",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                },
            )
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [six.text_type(event_2.event_id)]
        )
