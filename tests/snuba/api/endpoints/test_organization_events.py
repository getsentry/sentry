from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventsTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTestBase, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)


class OrganizationEventsEndpointTest(OrganizationEventsTestBase):
    def assert_events_in_response(self, response, event_ids):
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(event_ids)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id='b' * 32, group=group2, datetime=self.min_ago)

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
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id='b' * 32, group=group2, datetime=self.min_ago)

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
        self.create_event(
            event_id='x' * 32,
            group=group,
            message="how to make fast",
            datetime=self.min_ago,
        )
        event_2 = self.create_event(
            event_id='y' * 32,
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
        event_1 = self.create_event(
            event_id='x' * 32,
            group=group,
            message="how to make fast",
            datetime=self.min_ago,
        )
        event_2 = self.create_event(
            event_id='y' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago,
            user={'email': 'foo@example.com'},
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

        response = self.client.get(url, {'query': '!user.email:foo@example.com'}, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['eventID'] == event_1.event_id
        assert response.data[0]['message'] == 'how to make fast'

    def test_invalid_search_terms(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            event_id='x' * 32,
            group=group,
            message="how to make fast",
            datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        response = self.client.get(url, {'query': 'hi \n there'}, format='json')

        assert response.status_code == 400, response.content
        assert response.data['detail'] == "Parse error: 'search' (column 4). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."

    def test_project_filtering(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        project2 = self.create_project(organization=org, teams=[team])
        project3 = self.create_project(organization=org)
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        group3 = self.create_group(project=project3)
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id='b' * 32, group=group2, datetime=self.min_ago)
        self.create_event(event_id='c' * 32, group=group3, datetime=self.min_ago)

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
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id='b' * 32, group=group2, datetime=self.day_ago)

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
        event_1 = self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id='b' * 32, group=group2, datetime=self.day_ago)

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

        events = []
        for event_id, env in [
            ('a' * 32, environment),
            ('b' * 32, environment),
            ('c' * 32, environment2),
            ('d' * 32, null_env),
        ]:
            events.append(self.store_event(
                data={
                    'event_id': event_id,
                    'timestamp': self.min_ago.isoformat()[:19],
                    'fingerprint': ['put-me-in-group1'],
                    'environment': env.name or None,
                },
                project_id=project.id
            ))

        event_1, event_2, event_3, event_4 = events

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
            event_id='a' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'apple'}
        )
        event_2 = self.create_event(
            event_id='b' * 32, group=group, datetime=self.min_ago, tags={'fruit': 'orange'}
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
        response = self.client.get('%s?query=!fruit:apple' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

    def test_wildcard_search(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            event_id='a' * 32, group=group, datetime=self.min_ago, tags={'sentry:release': '3.1.2'}
        )
        event_2 = self.create_event(
            event_id='b' * 32, group=group, datetime=self.min_ago, tags={'sentry:release': '4.1.2'}
        )
        event_3 = self.create_event(
            event_id='c' * 32, group=group, datetime=self.min_ago, user={'email': 'foo@example.com'}
        )

        event_4 = self.create_event(
            event_id='d' * 32, group=group, datetime=self.min_ago, user={'email': 'foo@example.commmmmmmm'}
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

        response = self.client.get('%s?query=!release:3.1.*' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response,
            [event_2.event_id, event_3.event_id, event_4.event_id],
        )

        response = self.client.get('%s?query=user.email:*@example.com' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_3.event_id])

        response = self.client.get(
            '%s?query=!user.email:*@example.com' % (base_url,),
            format='json',
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response,
            [event_1.event_id, event_2.event_id, event_4.event_id],
        )

    def test_has_tag(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            event_id='a' * 32, group=group, datetime=self.min_ago, user={'email': 'foo@example.com'},
        )
        event_2 = self.create_event(
            event_id='b' * 32,
            group=group,
            datetime=self.min_ago,
            tags={
                'example_tag': 'example_value'})

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get('%s?query=has:user.email' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

        # test custom tag
        response = self.client.get('%s?query=has:example_tag' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

        response = self.client.get('%s?query=!has:user.email' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

        # test custom tag
        response = self.client.get('%s?query=!has:example_tag' % (base_url,), format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_event_id_direct_hit(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)
        self.create_event(
            event_id='a' * 32,
            group=group,
            message="best event",
            datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get(url, {'query': 'a' * 32}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response['X-Sentry-Direct-Hit'] == '1'

    def test_event_id_direct_hit_miss(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        self.create_project(organization=org, teams=[team])

        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get(url, {'query': 'a' * 32}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_boolean_feature_flag_failure(self):
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        for query in ['title:hi OR title:hello', 'title:hi AND title:hello']:
            response = self.client.get(url, {'query': query}, format='json')
            assert response.status_code == 400
            assert response.content == '{"detail": "Boolean search operator OR and AND not allowed in this search."}'

    def test_group_filtering(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        team = self.create_team(organization=org, members=[user])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        events = []
        for event_id, fingerprint in [
            ('a' * 32, 'put-me-in-group1'),
            ('b' * 32, 'put-me-in-group1'),
            ('c' * 32, 'put-me-in-group2'),
            ('d' * 32, 'put-me-in-group3'),
        ]:
            events.append(self.store_event(
                data={
                    'event_id': event_id,
                    'timestamp': self.min_ago.isoformat()[:19],
                    'fingerprint': [fingerprint],
                },
                project_id=project.id
            ))

        event_1, event_2, event_3, event_4 = events
        group_1, group_2, group_3 = event_1.group, event_3.group, event_4.group

        base_url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': org.slug,
            }
        )

        response = self.client.get(base_url, format='json', data={'group': [group_1.id]})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        response = self.client.get(base_url, format='json', data={'group': [group_3.id]})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_4.event_id])

        response = self.client.get(
            base_url,
            format='json',
            data={'group': [group_1.id, group_3.id]},
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response,
            [event_1.event_id, event_2.event_id, event_4.event_id],
        )

        response = self.client.get(
            base_url,
            format='json',
            data={'group': [group_1.id, group_2.id, group_3.id]},
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 4
        self.assert_events_in_response(
            response,
            [event_1.event_id, event_2.event_id, event_3.event_id, event_4.event_id],
        )


class OrganizationEventsStatsEndpointTest(OrganizationEventsTestBase):
    def setUp(self):
        super(OrganizationEventsStatsEndpointTest, self).setUp()
        self.login_as(user=self.user)

        self.day_ago = self.day_ago.replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()

        self.group = self.create_group(project=self.project)
        self.group2 = self.create_group(project=self.project2)

        self.user = self.create_user()
        self.user2 = self.create_user()
        self.create_event(
            event_id='a' * 32,
            group=self.group,
            datetime=self.day_ago + timedelta(minutes=1),
            tags={'sentry:user': self.user.email},
        )
        self.create_event(
            event_id='b' * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(hours=1, minutes=1),
            tags={'sentry:user': self.user2.email},
        )
        self.create_event(
            event_id='c' * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(hours=1, minutes=2),
            tags={'sentry:user': self.user2.email},
        )

    def test_simple(self):
        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        response = self.client.get('%s?%s' % (url, urlencode({
            'start': self.day_ago.isoformat()[:19],
            'end': (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
            'interval': '1h',
        })), format='json')

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data['data']] == [
            [],
            [{'count': 1}],
            [{'count': 2}],
        ]

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data['data']) == 0

    def test_groupid_filter(self):
        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': self.organization.slug,
            }
        )
        url = '%s?%s' % (url, urlencode({
            'start': self.day_ago.isoformat()[:19],
            'end': (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
            'interval': '1h',
            'group': self.group.id
        }))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data['data'])

    def test_groupid_filter_invalid_value(self):
        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': self.organization.slug,
            }
        )
        url = '%s?group=not-a-number' % (url,)
        response = self.client.get(url, format='json')

        assert response.status_code == 400, response.content

    def test_user_count(self):
        self.create_event(
            event_id='d' * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(minutes=2),
            tags={'sentry:user': self.user2.email},
        )
        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        response = self.client.get('%s?%s' % (url, urlencode({
            'start': self.day_ago.isoformat()[:19],
            'end': (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
            'interval': '1h',
            'yAxis': 'user_count',
        })), format='json')

        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data['data']] == [
            [],
            [{'count': 2}],
            [{'count': 1}],
        ]

    def test_with_event_count_flag(self):
        url = reverse(
            'sentry-api-0-organization-events-stats',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        response = self.client.get('%s?%s' % (url, urlencode({
            'start': self.day_ago.isoformat()[:19],
            'end': (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
            'interval': '1h',
            'yAxis': 'event_count',
        })), format='json')

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data['data']] == [
            [],
            [{'count': 1}],
            [{'count': 2}],
        ]


class OrganizationEventsHeatmapEndpointTest(OrganizationEventsTestBase):
    def setUp(self):
        super(OrganizationEventsHeatmapEndpointTest, self).setUp()
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()
        self.url = reverse(
            'sentry-api-0-organization-events-heatmap',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        self.min_ago = self.min_ago.replace(microsecond=0)
        self.day_ago = self.day_ago.replace(microsecond=0)

    def test_simple(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'number': 'one'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(self.url, {'keys': ['color', 'number']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'one',
                    'value': 'one',
                    'lastSeen': self.min_ago,
                    'key': 'number',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 1,
            'name': 'Number',
            'key': 'number'
        }
        response.data[1] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'green',
                    'value': 'green',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 3,
            'name': 'Color',
            'key': 'color'
        }

    def test_single_key(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'world': 'hello'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'yellow'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'yellow'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(self.url, {'keys': ['color']}, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'yellow',
                    'value': 'yellow',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 3,
            'name': 'Color',
            'key': 'color'
        }

    def test_with_query(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'message': 'how to make fast',
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'message': 'Delet the Data',
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'message': 'Data the Delet ',
                'tags': {'color': 'yellow'},
            },
            project_id=self.project2.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'query': 'delet', 'keys': ['color']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'yellow',
                    'value': 'yellow',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 3,
            'name': 'Color',
            'key': 'color'
        }

    def test_start_end(self):
        two_days_ago = self.day_ago - timedelta(days=1)
        hour_ago = self.min_ago - timedelta(hours=1)
        two_hours_ago = hour_ago - timedelta(hours=1)

        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': two_days_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': hour_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': two_hours_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': timezone.now().isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project2.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url,
                {
                    'start': self.day_ago.isoformat()[:19],
                    'end': self.min_ago.isoformat()[:19],
                    'keys': ['color'],
                },
                format='json'
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': hour_ago,
                    'key': 'color',
                    'firstSeen': two_hours_ago
                }
            ],
            'totalValues': 2,
            'name': 'Color',
            'key': 'color'
        }

    def test_excluded_tag(self):
        self.user = self.create_user()
        self.user2 = self.create_user()
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.day_ago.isoformat(),
                'tags': {'sentry:user': self.user.email},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.day_ago.isoformat(),
                'tags': {'sentry:user': self.user2.email},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.day_ago.isoformat(),
                'tags': {'sentry:user': self.user2.email},
            },
            project_id=self.project.id
        )

        response = self.client.get(
            self.url,
            {
                'keys': ['user'],
                'project': [self.project.id]
            },
            format='json'
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 2,
                    'name': self.user2.email,
                    'value': self.user2.email,
                    'lastSeen': self.day_ago,
                    'key': 'user',
                    'firstSeen': self.day_ago
                },
                {
                    'count': 1,
                    'name': self.user.email,
                    'value': self.user.email,
                    'lastSeen': self.day_ago,
                    'key': 'user',
                    'firstSeen': self.day_ago
                }
            ],
            'totalValues': 3,
            'name': 'User',
            'key': 'user'
        }

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        url = reverse(
            'sentry-api-0-organization-events-heatmap',
            kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, {'keys': ['color']}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'A valid project must be included.'}

    def test_multiple_projects_without_global_view(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
            },
            project_id=self.project2.id
        )

        response = self.client.get(self.url, {'keys': ['color']}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'You cannot view events from multiple projects.'}

    def test_project_key(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'number': 'one'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago.isoformat(),
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'keys': [
                        'color', 'number', 'project.name']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        response.data[0] == {
            'topValues': [
                {
                    'count': 3,
                    'name': self.project.slug,
                    'value': self.project.slug,
                    'lastSeen': self.min_ago,
                    'key': 'project',
                    'firstSeen': self.min_ago
                },
                {
                    'count': 1,
                    'name': self.project2.slug,
                    'value': self.project2.slug,
                    'lastSeen': self.min_ago,
                    'key': 'project',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 4,
            'uniqueValues': 2,
            'name': 'Project',
            'key': 'project'
        }
        response.data[1] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'one',
                    'value': 'one',
                    'lastSeen': self.min_ago,
                    'key': 'number',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 1,
            'name': 'Number',
            'key': 'number'
        }
        response.data[2] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'green',
                    'value': 'green',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago,
                    'key': 'color',
                    'firstSeen': self.min_ago
                }
            ],
            'totalValues': 3,
            'name': 'Color',
            'key': 'color'
        }


class OrganizationEventsMetaEndpoint(OrganizationEventsTestBase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        self.create_event(event_id='a' * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id='m' * 32, group=group2, datetime=self.min_ago)

        url = reverse(
            'sentry-api-0-organization-events-meta',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        # this is not exact because of turbo=True
        assert response.data['count'] == 10

    def test_search(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            event_id='x' * 32,
            group=group,
            message="how to make fast",
            datetime=self.min_ago)
        self.create_event(
            event_id='m' * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago,
        )

        url = reverse(
            'sentry-api-0-organization-events-meta',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        response = self.client.get(url, {'query': 'delet'}, format='json')

        assert response.status_code == 200, response.content
        # this is not exact because of turbo=True
        assert response.data['count'] == 10

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-organization-events-meta',
            kwargs={
                'organization_slug': org.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['count'] == 0
