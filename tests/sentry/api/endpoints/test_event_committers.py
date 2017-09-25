from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import Event
from sentry.testutils import APITestCase


class EventCommittersTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)

        group = self.create_group(project=project, first_release=release)

        event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
            tags={'sentry:release': release.version}
        )

        url = reverse(
            'sentry-api-0-event-file-committers',
            kwargs={
                'event_id': event.id,
                'project_slug': event.project.slug,
                'organization_slug': event.project.organization.slug,
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data['committers']) == 1
        assert response.data['committers'][0]['author']['username'] == 'admin@localhost'
        assert len(response.data['committers'][0]['commits']) == 1
        assert response.data['committers'][0]['commits'][0]['message'
                                                            ] == 'placeholder commit message'

        assert len(response.data['annotatedFrames']) == 1
        assert len(response.data['annotatedFrames'][0]['commits']) == 1
        assert response.data['annotatedFrames'][0]['commits'][0]['author']['username'
                                                                           ] == 'admin@localhost'
        # TODO(maxbittker) test more edge cases here

    def test_no_release(self):
        self.login_as(user=self.user)

        group = self.create_group()

        event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
        )

        url = reverse(
            'sentry-api-0-event-file-committers',
            kwargs={
                'event_id': event.id,
                'project_slug': event.project.slug,
                'organization_slug': event.project.organization.slug,
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 404, response.content
        assert response.data['detail'] == "Release not found"

    def test_null_stacktrace(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(
            project,
            self.user,
        )

        group = self.create_group(
            project=project,
            first_release=release,
        )

        event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2016, 8, 13, 3, 8, 25),
            tags={'sentry:release': release.version}
        )

        event = Event.objects.create(
            project_id=project.id,
            group_id=group.id,
            event_id='abcd',
            message='hello 123456',
            data={
                'environment': 'production',
                'type': 'default',
                'sentry.interfaces.Exception': {
                    'values': [
                        {
                            'type': 'ValueError',
                            'value': 'My exception value',
                            'module': '__builtins__',
                            'stacktrace': None,
                        }
                    ]
                },
                'tags': [
                    ['environment', 'production'],
                    ['sentry:release', release.version],
                ],
            },
        )

        url = reverse(
            'sentry-api-0-event-file-committers',
            kwargs={
                'event_id': event.id,
                'project_slug': event.project.slug,
                'organization_slug': event.project.organization.slug,
            }
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
