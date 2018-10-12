from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event('a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event('b' * 32, group=group2, datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
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
        self.create_event('x' * 32, group=group, message="how to make fast", datetime=self.min_ago)
        event_2 = self.create_event(
            'y' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        response = self.client.get(url, {'query': 'delet'}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_2.event_id
        assert response.data[0]['message'] == 'Delet the Data'

    def test_project_filtering(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        project2 = self.create_project(organization=org, teams=[team])
        project3 = self.create_project(organization=org)
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        group3 = self.create_group(project=project3)
        event_1 = self.create_event('a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event('b' * 32, group=group2, datetime=self.min_ago)
        self.create_event('c' * 32, group=group3, datetime=self.min_ago)

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        # test bad project id
        url = '%s?project=abc' % (base_url,)
        response = self.client.get(url, format='json')
        assert response.status_code == 400

        # test including project user doesn't have access to
        url = '%s?project=%s&project=%s' % (base_url, project.id, project3.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 403

        # test filtering by project
        url = '%s?project=%s' % (base_url, project.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                event_1.event_id,
            ]
        )

        # test only returns events from project user has access to
        response = self.client.get(base_url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                event_1.event_id,
                event_2.event_id,
            ]
        )

    def test_stats_period(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event('a' * 32, group=group, datetime=self.min_ago)
        self.create_event('b' * 32, group=group2, datetime=self.day_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        url = '%s?statsPeriod=2h' % (url,)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                event_1.event_id,
            ]
        )

    def test_time_range(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event('a' * 32, group=group, datetime=self.min_ago)
        self.create_event('b' * 32, group=group2, datetime=self.day_ago)

        now = timezone.now()

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        # test swapped order of start/end
        url = '%s?%s' % (base_url, urlencode({
            'end': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'start': now.strftime('%Y-%m-%dT%H:%M:%S'),
        }))
        response = self.client.get(url, format='json')
        assert response.status_code == 400

        url = '%s?%s' % (base_url, urlencode({
            'start': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': now.strftime('%Y-%m-%dT%H:%M:%S'),
        }))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(
            [
                event_1.event_id,
            ]
        )
