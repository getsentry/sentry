from __future__ import absolute_import


from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
import pytest


class OrganizationEventsTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTestBase, self).setUp()
        self.min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        self.url = reverse(
            'sentry-api-0-organization-events',
            kwargs={
                'organization_slug': self.organization.slug,
            }
        )

    def assert_events_in_response(self, response, event_ids):
        assert sorted(map(lambda x: x['eventID'], response.data)) == sorted(event_ids)


class OrganizationEventsV2EndpointTest(OrganizationEventsTestBase):

    def test_no_projects(self):
        self.login_as(user=self.user)
        with self.feature('organizations:events-v2'):
            response = self.client.get(self.url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_multi_project_feature_gate_rejection(self):
        self.login_as(user=self.user)
        team = self.create_team(organization=self.organization, members=[self.user])

        project = self.create_project(organization=self.organization, teams=[team])
        project2 = self.create_project(organization=self.organization, teams=[team])

        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group1'],
            },
            project_id=project.id
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group2'],
            },
            project_id=project2.id
        )

        query = {
            'field': ['id', 'project.id'],
            'project': [project.id, project2.id],
        }
        with self.feature({'organizations:events-v2': True, 'organizations:global-views': False}):
            response = self.client.get(self.url, query, format='json')
        assert response.status_code == 400
        assert 'events from multiple projects' in response.data['detail']

    def test_invalid_search_terms(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'how to make fast',
                'timestamp': self.min_ago,
            },
            project_id=project.id
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(self.url, {'query': 'hi \n there'}, format='json')

        assert response.status_code == 400, response.content
        assert response.data['detail'] == "Parse error: 'search' (column 4). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."

    def test_raw_data(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': self.two_min_ago,
                'user': {
                    'ip_address': '127.0.0.1',
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
                'user': {
                    'ip_address': '127.0.0.1',
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['id', 'project.id', 'user.email', 'user.ip', 'timestamp'],
                    'orderby': '-timestamp',
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == 'b' * 32
        assert response.data[0]['project.id'] == project.id
        assert response.data[0]['user.email'] == 'foo@example.com'

    def test_project_name(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'environment': 'staging',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['project.name', 'environment'],
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['project.name'] == project.slug
        assert 'project.id' not in response.data[0]
        assert response.data[0]['environment'] == 'staging'

    def test_implicit_groupby(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
            },
            project_id=project.id,
        )
        event1 = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['count(id)', 'project.id', 'issue.id'],
                    'orderby': 'issue.id',
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0] == {
            'project.id': project.id,
            'issue.id': event1.group_id,
            'count_id': 2,
            'latest_event': event1.event_id,
        }
        assert response.data[1] == {
            'project.id': project.id,
            'issue.id': event2.group_id,
            'count_id': 1,
            'latest_event': event2.event_id,
        }

    def test_orderby(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.two_min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['id', 'timestamp'],
                    'orderby': ['-timestamp', '-id']
                },
            )

        assert response.status_code == 200, response.content
        assert response.data[0]['id'] == 'c' * 32
        assert response.data[1]['id'] == 'b' * 32
        assert response.data[2]['id'] == 'a' * 32

    def test_sort_title(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'zlast',
                'timestamp': self.two_min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'message': 'second',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'message': 'first',
                'timestamp': self.min_ago,
            },
            project_id=project.id,
        )
        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['id', 'title'],
                    'sort': 'title'
                },
            )

        assert response.status_code == 200, response.content
        assert response.data[0]['id'] == 'c' * 32
        assert response.data[1]['id'] == 'b' * 32
        assert response.data[2]['id'] == 'a' * 32

    def test_sort_invalid(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.two_min_ago,
            },
            project_id=project.id,
        )
        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['id'],
                    'sort': 'garbage'
                },
            )
        assert response.status_code == 400
        assert 'order by' in response.content

    def test_aliased_fields(self):
        self.login_as(user=self.user)
        project = self.create_project()
        event1 = self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['issue.id', 'issue_title', 'count(id)', 'count_unique(user)'],
                    'orderby': 'issue.id'
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['issue.id'] == event1.group_id
        assert response.data[0]['count_id'] == 1
        assert response.data[0]['count_unique_user'] == 1
        assert response.data[1]['issue.id'] == event2.group_id
        assert response.data[1]['count_id'] == 2
        assert response.data[1]['count_unique_user'] == 2

    @pytest.mark.xfail(reason='aggregate comparisons need parser improvements')
    def test_aggregation_comparison(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        event = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'd' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_3'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'e' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_3'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['issue_title', 'count(id)', 'count_unique(user)'],
                    'query': 'count_id:>1 count_unique_user:>1',
                    'orderby': 'issue_title'
                },
            )

        assert response.status_code == 200, response.content

        assert len(response.data) == 1
        assert response.data[0]['issue.id'] == event.group_id
        assert response.data[0]['count_id'] == 2
        assert response.data[0]['count_unique_user'] == 2

    @pytest.mark.xfail(reason='aggregate comparisons need parser improvements')
    def test_aggregation_comparison_with_conditions(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_1'],
                'user': {
                    'email': 'foo@example.com',
                },
                'environment': 'prod',
            },
            project_id=project.id,
        )
        event = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
                'environment': 'staging',
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
                'environment': 'prod',
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                'event_id': 'd' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'foo@example.com',
                },
                'environment': 'prod',
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['issue_title', 'count(id)'],
                    'query': 'count_id:>1 user.email:foo@example.com environment:prod',
                    'orderby': 'issue_title'
                },
            )

        assert response.status_code == 200, response.content

        assert len(response.data) == 1
        assert response.data[0]['issue.id'] == event.group_id
        assert response.data[0]['count_id'] == 2

    def test_nonexistent_fields(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'how to make fast',
                'timestamp': self.min_ago,
            },
            project_id=project.id
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['issue_world.id'],
                },
            )
        assert response.status_code == 200, response.content
        assert response.data[0]['issue_world.id'] == ''

    def test_no_requested_fields_or_grouping(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'how to make fast',
                'timestamp': self.min_ago,
            },
            project_id=project.id
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'query': 'test'
                },
            )
        assert response.status_code == 400, response.content
        assert response.data['detail'] == 'No fields or groupings provided'

    def test_condition_on_aggregate_fails(self):
        self.login_as(user=self.user)
        project = self.create_project()
        self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group_2'],
                'user': {
                    'email': 'bar@example.com',
                },
            },
            project_id=project.id,
        )

        with self.feature('organizations:events-v2'):
            response = self.client.get(
                self.url,
                format='json',
                data={
                    'field': ['issue.id'],
                    'query': 'event_count:>0',
                    'orderby': 'issue.id'
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

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
                    'timestamp': self.min_ago,
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
