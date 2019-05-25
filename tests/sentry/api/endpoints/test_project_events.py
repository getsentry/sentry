from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry import options
from sentry.testutils import APITestCase


class ProjectEventsTest(APITestCase):
    def setUp(self):
        super(ProjectEventsTest, self).setUp()
        options.set('snuba.events-queries.enabled', False)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

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
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(event_1.id),
                six.text_type(event_2.id),
            ]
        )

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
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(event_2.id),
            ]
        )
