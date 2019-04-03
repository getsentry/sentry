from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationHealthTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationHealthTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)

    def test_time_range(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago,
                          tags=[('sentry:user', 'id:%s' % (self.user.id,))])
        self.create_event(event_id='b' * 32, group=group2, datetime=self.day_ago,
                          tags=[('sentry:user', 'id:%s' % (self.user.id,))])

        now = timezone.now()

        base_url = reverse(
            'sentry-api-0-organization-health-graph',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        # test swapped order of start/end
        url = '%s?%s' % (base_url, urlencode({
            'end': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'start': now.strftime('%Y-%m-%dT%H:%M:%S'),
            'tag': 'user',
        }))
        response = self.client.get(url, format='json')
        assert response.status_code == 400

        url = '%s?%s' % (base_url, urlencode({
            'start': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': now.strftime('%Y-%m-%dT%H:%M:%S'),
            'tag': 'user',
        }))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['totals']['count'] == 1

    def test_environments(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        environment = self.create_environment(project=project, name='production')
        environment2 = self.create_environment(project=project)
        environment3 = self.create_environment(project=project)
        no_env = self.create_environment(project=project, name='')

        for event_id, env in [
            ('a' * 32, environment),
            ('b' * 32, environment2),
            ('c' * 32, environment3),
            ('d' * 32, no_env),
        ]:
            self.store_event(
                data={
                    'event_id': event_id,
                    'timestamp': self.min_ago.isoformat()[:19],
                    'fingerprint': ['put-me-in-group1'],
                    'environment': env.name or None,
                    'user': {'id': self.user.id},
                },
                project_id=project.id
            )

        base_url = reverse(
            'sentry-api-0-organization-health-graph',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        now = timezone.now()

        # test multiple environments
        url = '%s?%s' % (base_url, urlencode((
            ('start', (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S')),
            ('end', now.strftime('%Y-%m-%dT%H:%M:%S')),
            ('tag', 'user'),
            ('environment', environment2.name),
            ('environment', environment.name),
        )))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['totals']['count'] == 2, response.data

        # test 'no environment' environment
        url = '%s?%s' % (base_url, urlencode((
            ('start', (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S')),
            ('end', now.strftime('%Y-%m-%dT%H:%M:%S')),
            ('tag', 'user'),
            ('environment', no_env.name),
        )))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['totals']['count'] == 1

        # test 'no environment' environment with named envs
        url = '%s?%s' % (base_url, urlencode((
            ('start', (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S')),
            ('end', now.strftime('%Y-%m-%dT%H:%M:%S')),
            ('tag', 'user'),
            ('environment', no_env.name),
            ('environment', environment.name),
        )))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['totals']['count'] == 2

        # test nonexistent environment
        url = '%s?environment=notanenvironment&tag=user' % (base_url,)
        response = self.client.get(url, format='json')
        assert response.status_code == 404
