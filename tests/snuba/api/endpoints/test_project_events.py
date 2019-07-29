from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(ProjectEventsTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id='b' * 32, group=group, datetime=self.min_ago)

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
        self.create_event(
            event_id='x' * 32,
            group=group,
            message="how to make fast",
            datetime=self.min_ago)
        event_2 = self.create_event(
            event_id='y' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago)

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
        assert response.data[0]['message'] == 'Delet the Data'

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        two_days_ago = timezone.now() - timedelta(days=2)
        self.create_event(event_id='c' * 32, group=group, datetime=two_days_ago)
        event_2 = self.create_event(event_id='d' * 32, group=group, datetime=self.min_ago)

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
