from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event_1 = self.create_event('a' * 32, group=group, datetime=timezone.now() - timedelta(minutes=1))
        event_2 = self.create_event('b' * 32, group=group, datetime=timezone.now() - timedelta(minutes=1))

        url = reverse(
            'sentry-api-0-project-events',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                event_1.event_id,
                event_2.event_id,
            ]
        )

    def test_message_search(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event('x' * 32, group=group, message="how to make fast", datetime=timezone.now() - timedelta(minutes=1))
        event_2 = self.create_event('y' * 32, group=group, message="delet the data", datetime=timezone.now() - timedelta(minutes=1))

        url = reverse(
            'sentry-api-0-project-events',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url, {'query': 'delet'}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_2.event_id
        assert response.data[0]['message'] == 'delet the data'

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            'a' *
            32,
            group=group,
            datetime=timezone.now() - timedelta(days=2),
        )
        event_2 = self.create_event('b' * 32, group=group)

        with self.options({'system.event-retention-days': 1}):
            url = reverse(
                'sentry-api-0-project-events',
                kwargs={
                    'organization_slug': project.organization.slug,
                    'project_slug': project.slug,
                }
            )
            response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_2.event_id
