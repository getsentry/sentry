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

    def assert_events_in_response(self, response, event_ids):
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(event_ids)

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
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

    def test_simple_superuser(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

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
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

    def test_message_search_raw_text(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event('x' * 32, group=group, message="how to make fast", datetime=self.min_ago)
        event_2 = self.create_event(
            'y' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago,
        )

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

    def test_message_search_tags(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event('x' * 32, group=group, message="how to make fast", datetime=self.min_ago)
        event_2 = self.create_event(
            'y' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago,
            tags={'user': {'email': 'foo@example.com'}},
        )

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        response = self.client.get(url, {'query': 'user.email:foo@example.com'}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_2.event_id
        assert response.data[0]['message'] == 'Delet the Data'

    def test_invalid_search_terms(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event('x' * 32, group=group, message="how to make fast", datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        response = self.client.get(url, {'query': 'hi \n there'}, format='json')

        assert response.status_code == 400, response.content
        assert response.data['detail'] == "Parse error: 'search' (column 1)"

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
        self.assert_events_in_response(response, [event_1.event_id])

        # test only returns events from project user has access to
        response = self.client.get(base_url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

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
        self.assert_events_in_response(response, [event_1.event_id])

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
        self.assert_events_in_response(response, [event_1.event_id])

    def test_environment_filtering(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        environment = self.create_environment(project=project, name="production")
        environment2 = self.create_environment(project=project)
        null_env = self.create_environment(project=project, name='')
        group = self.create_group(project=project)

        event_1 = self.create_event(
            'a' * 32, group=group, datetime=self.min_ago, tags={'environment': environment.name}
        )
        event_2 = self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, tags={'environment': environment.name}
        )
        event_3 = self.create_event(
            'c' * 32, group=group, datetime=self.min_ago, tags={'environment': environment2.name}
        )
        event_4 = self.create_event(
            'd' * 32, group=group, datetime=self.min_ago, tags={'environment': None}
        )

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        # test as part of query param
        url = '%s?environment=%s' % (base_url, environment.name)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        # test multiple as part of query param
        url = '%s?%s' % (base_url, urlencode((
            ('environment', environment.name),
            ('environment', environment2.name),
        )))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_3.event_id])

        # test multiple as part of query param with no env
        url = '%s?%s' % (base_url, urlencode((
            ('environment', environment.name),
            ('environment', null_env.name),
        )))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_4.event_id])

        # test as part of search
        url = '%s?query=environment:%s' % (base_url, environment.name)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        # test as part of search - no environment
        url = '%s?query=environment:""' % (base_url, )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_4.event_id])

        # test nonexistent environment
        url = '%s?environment=notanenvironment' % (base_url,)
        response = self.client.get(url, format='json')
        assert response.status_code == 404

    def test_custom_tags(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            'a' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'apple'}
        )
        self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
        )

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get('%s?query=fruit:apple' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

    def test_wildcard_search(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            'a' * 32, group=group, datetime=self.min_ago, tags={'sentry:release': '3.1.2'}
        )
        self.create_event(
            'b' * 32, group=group, datetime=self.min_ago, tags={'sentry:release': '4.1.2'}
        )
        event_2 = self.create_event(
            'c' * 32, group=group, datetime=self.min_ago, tags={'user': {'email': 'foo@example.com'}}
        )

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get('%s?query=release:3.1.*' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

        response = self.client.get('%s?query=user.email:*@example.com' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])
