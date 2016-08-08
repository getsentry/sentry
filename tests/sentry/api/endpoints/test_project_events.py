from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectEventsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event_1 = self.create_event('a' * 32, group=group)
        event_2 = self.create_event('b' * 32, group=group)

        url = reverse('sentry-api-0-project-events', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            six.text_type(event_1.id),
            six.text_type(event_2.id),
        ])
