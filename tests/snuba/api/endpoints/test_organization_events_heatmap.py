from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventsHeatmapEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsHeatmapEndpointTest, self).setUp()
        self.min_ago = (timezone.now() - timedelta(minutes=1)).replace(microsecond=0)
        self.day_ago = (timezone.now() - timedelta(days=1)).replace(microsecond=0)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()
        self.url = reverse(
            'sentry-api-0-organization-events-heatmap',
            kwargs={
                'organization_slug': self.project.organization.slug,
            }
        )
        self.min_ago_iso = self.min_ago.isoformat()

    def test_simple(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'number': 'one'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(self.url, {'key': ['number', 'color']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'one',
                    'value': 'one',
                    'lastSeen': self.min_ago_iso,
                    'key': 'number',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Number',
            'key': 'number'
        }
        assert response.data[1] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'green',
                    'value': 'green',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Color',
            'key': 'color'
        }

    def test_single_key(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'world': 'hello'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'yellow'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'red'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'yellow'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(self.url, {'key': ['color']}, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'yellow',
                    'value': 'yellow',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Color',
            'key': 'color'
        }

    def test_with_message_query(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'how to make fast',
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'Delet the Data',
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'Data the Delet ',
                'tags': {'color': 'yellow'},
            },
            project_id=self.project2.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'query': 'delet', 'key': ['color']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        assert response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'yellow',
                    'value': 'yellow',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 2,
            'name': 'Color',
            'key': 'color'
        }

    def test_with_condition(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'how to make fast',
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'Delet the Data',
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'message': 'Data the Delet ',
                'tags': {'color': 'yellow'},
            },
            project_id=self.project2.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'query': 'color:yellow', 'key': ['color', 'project.name']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'yellow',
                    'value': 'yellow',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
            ],
            'totalValues': 1,
            'name': 'Color',
            'key': 'color'
        }

        assert response.data[1] == {
            'topValues': [
                {
                    'count': 1,
                    'name': self.project2.slug,
                    'value': self.project2.slug,
                    'lastSeen': self.min_ago_iso,
                    'key': 'project.name',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 1,
            'name': 'Project.Name',
            'key': 'project.name'
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
                    'key': ['color'],
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
                    'lastSeen': hour_ago.isoformat(),
                    'key': 'color',
                    'firstSeen': two_hours_ago.isoformat()
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
                'key': ['user'],
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
                    'lastSeen': self.day_ago.isoformat(),
                    'key': 'user',
                    'firstSeen': self.day_ago.isoformat()
                },
                {
                    'count': 1,
                    'name': self.user.email,
                    'value': self.user.email,
                    'lastSeen': self.day_ago.isoformat(),
                    'key': 'user',
                    'firstSeen': self.day_ago.isoformat()
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
        response = self.client.get(url, {'key': ['color']}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'A valid project must be included.'}

    def test_no_key_param(self):
        response = self.client.get(self.url, {'project': [self.project.id]}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'Tag keys must be specified.'}

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

        response = self.client.get(self.url, {'key': ['color']}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': 'You cannot view events from multiple projects.'}

    def test_project_selected(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'number': 'one'},
            },
            project_id=self.project2.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'key': [
                        'number', 'color', 'project.name'], 'project': [
                        self.project.id]}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0] == {
            'topValues': [],
            'totalValues': 1,
            'name': 'Number',
            'key': 'number'
        }
        assert response.data[1] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'green',
                    'value': 'green',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
            ],
            'totalValues': 1,
            'name': 'Color',
            'key': 'color'
        }

        assert response.data[2] == {
            'topValues': [
                {
                    'count': 1,
                    'name': self.project.slug,
                    'value': self.project.slug,
                    'lastSeen': self.min_ago_iso,
                    'key': 'project.name',
                    'firstSeen': self.min_ago_iso
                },
            ],
            'totalValues': 1,
            'name': 'Project.Name',
            'key': 'project.name'
        }

    def test_project_key(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'number': 'one'},
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'red'},
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'key': [
                        'project.name', 'number', 'color']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0] == {
            'topValues': [
                {
                    'count': 3,
                    'name': self.project.slug,
                    'value': self.project.slug,
                    'lastSeen': self.min_ago_iso,
                    'key': 'project.name',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': self.project2.slug,
                    'value': self.project2.slug,
                    'lastSeen': self.min_ago_iso,
                    'key': 'project.name',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Project.Name',
            'key': 'project.name'
        }
        assert response.data[1] == {
            'topValues': [
                {
                    'count': 1,
                    'name': 'one',
                    'value': 'one',
                    'lastSeen': self.min_ago_iso,
                    'key': 'number',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Number',
            'key': 'number'
        }
        assert response.data[2] == {
            'topValues': [
                {
                    'count': 2,
                    'name': 'green',
                    'value': 'green',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': 'red',
                    'value': 'red',
                    'lastSeen': self.min_ago_iso,
                    'key': 'color',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'Color',
            'key': 'color'
        }

    def test_non_tag_key(self):
        user1 = {
            'id': '1',
            'ip_address': '127.0.0.1',
            'email': 'foo@example.com',
            'username': 'foo',
        }
        user2 = {
            'id': '2',
            'ip_address': '127.0.0.2',
            'email': 'bar@example.com',
            'username': 'bar',
        }
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'user': user1,
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
                'user': user2,
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'green'},
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'red'},
                'user': user1,
            },
            project_id=self.project.id
        )

        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'key': [
                        'user.email', 'user.ip']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert response.data[0] == {
            'topValues': [
                {
                    'count': 2,
                    'name': user1['email'],
                    'value': user1['email'],
                    'lastSeen': self.min_ago_iso,
                    'key': 'user.email',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': user2['email'],
                    'value': user2['email'],
                    'lastSeen': self.min_ago_iso,
                    'key': 'user.email',
                    'firstSeen': self.min_ago_iso
                }
            ],
            'totalValues': 4,
            'name': 'User.Email',
            'key': 'user.email'
        }
        assert response.data[1] == {
            'topValues': [
                {
                    'count': 2,
                    'name': user1['ip_address'],
                    'value': user1['ip_address'],
                    'lastSeen': self.min_ago_iso,
                    'key': 'user.ip',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': user2['ip_address'],
                    'value': user2['ip_address'],
                    'lastSeen': self.min_ago_iso,
                    'key': 'user.ip',
                    'firstSeen': self.min_ago_iso
                },
            ],
            'totalValues': 4,
            'name': 'User.Ip',
            'key': 'user.ip'
        }

    def test_non_tag_key__multiple_values_and_no_value(self):
        frame = {
            'filename': 'server.php',
            'lineno': 21,
            'in_app': True,
        }

        # Check that error.type works with chained exceptions
        # as they create multiple results for exception_stacks.type
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'exception': {
                    'values': [
                        {'type': 'PDOException', 'stacktrace': {
                            'frames': [frame]}, 'value': 'Database error'},
                        {'type': 'QueryException', 'stacktrace': {
                            'frames': [frame]}, 'value': 'Query failed'},
                    ]
                }
            },
            project_id=self.project.id
        )
        # No stack traces
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'exception': {
                    'values': []
                }
            },
            project_id=self.project.id
        )

        response = self.client.get(
            self.url,
            {'key': ['error.type'], 'project': [self.project.id]},
            format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        assert response.data[0] == {
            'topValues': [
                {
                    'count': 1,
                    'name': '',
                    'value': '',
                    'lastSeen': self.min_ago_iso,
                    'key': 'error.type',
                    'firstSeen': self.min_ago_iso
                },
                {
                    'count': 1,
                    'name': 'QueryException',
                    'value': 'QueryException',
                    'lastSeen': self.min_ago_iso,
                    'key': 'error.type',
                    'firstSeen': self.min_ago_iso
                },
            ],
            'totalValues': 2,
            'name': 'Error.Type',
            'key': 'error.type'
        }

    def test_value_limit(self):
        for i in range(0, 12):
            self.store_event(
                data={
                    'event_id': uuid4().hex,
                    'timestamp': self.min_ago_iso,
                    'tags': {'color': 'color%d' % i}
                },
                project_id=self.create_project().id
            )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'yellow'}
            },
            project_id=self.project2.id
        )
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'yellow'}
            },
            project_id=self.project2.id
        )
        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'key': ['project.name', 'color']}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert len(response.data[0]['topValues']) == TOP_VALUES_DEFAULT_LIMIT
        assert response.data[0]['topValues'][0] == {
            'count': 2, 'name': self.project2.slug, 'value': self.project2.slug,
            'lastSeen': self.min_ago_iso, 'key': 'project.name', 'firstSeen': self.min_ago_iso
        }
        assert len(response.data[1]['topValues']) == TOP_VALUES_DEFAULT_LIMIT
        assert response.data[1]['topValues'][0] == {
            'count': 2, 'name': 'yellow', 'value': 'yellow',
            'lastSeen': self.min_ago_iso, 'key': 'color', 'firstSeen': self.min_ago_iso
        }

    def test_special_fields_ignored(self):
        self.store_event(
            data={
                'event_id': uuid4().hex,
                'timestamp': self.min_ago_iso,
                'tags': {'color': 'yellow'}
            },
            project_id=self.project2.id
        )
        with self.feature('organizations:global-views'):
            response = self.client.get(
                self.url, {
                    'key': ['color'], 'query': 'user_count:>5'}, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'topValues': [{
                'count': 1, 'name': 'yellow', 'value': 'yellow',
                'lastSeen': self.min_ago_iso, 'key': 'color', 'firstSeen': self.min_ago_iso
            }],
            'totalValues': 1,
            'name': 'Color',
            'key': 'color'
        }

    def test_malformed_query(self):
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

        response = self.client.get(
            self.url, {
                'key': ['color'], 'query': '\n\n\n\n'}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {
            'detail': "Parse error: 'search' (column 1). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."}

    def test_invalid_tag(self):
        response = self.client.get(
            self.url, {
                'key': ['color;;;']}, format='json')
        assert response.status_code == 400, response.content
        assert response.data == {'detail': "Tag key color;;; is not valid."}
