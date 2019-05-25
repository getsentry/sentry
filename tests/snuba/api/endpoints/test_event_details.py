from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.models import UserReport, Group
from sentry.testutils import APITestCase, SnubaTestCase


class EventDetailsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(EventDetailsTest, self).setUp()
        self.project = self.create_project()
        self.min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.two_min_ago = (timezone.now() - timedelta(minutes=2)).isoformat()[:19]
        self.three_min_ago = (timezone.now() - timedelta(minutes=3)).isoformat()[:19]

    def test_simple(self):
        self.login_as(user=self.user)

        prev_event = self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.three_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )
        cur_event = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.two_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )
        next_event = self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )

        group = Group.objects.first()

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': cur_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['nextEventID'] == six.text_type(next_event.event_id)
        assert response.data['previousEventID'] == six.text_type(prev_event.event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': prev_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(prev_event.id)
        assert response.data['nextEventID'] == six.text_type(cur_event.event_id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': next_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(next_event.id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(cur_event.event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_identical_datetime(self):
        self.login_as(user=self.user)

        events = []

        for eid in 'abcde':
            events.append(self.store_event(
                data={
                    'event_id': eid * 32,
                    'timestamp': self.min_ago,
                    'fingerprint': ['group-1'],
                },
                project_id=self.project.id
            ))

            group = Group.objects.first()

        # First event, no prev
        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': events[0].id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[0].id)
        assert response.data['nextEventID'] == six.text_type(events[1].event_id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': events[1].id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[1].id)
        assert response.data['nextEventID'] == six.text_type(events[2].event_id)
        assert response.data['previousEventID'] == six.text_type(events[0].event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': events[2].id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[2].id)
        assert response.data['nextEventID'] == six.text_type(events[3].event_id)
        assert response.data['previousEventID'] == six.text_type(events[1].event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': events[3].id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[3].id)
        assert response.data['nextEventID'] == six.text_type(events[4].event_id)
        assert response.data['previousEventID'] == six.text_type(events[2].event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Last event, no next
        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': events[4].id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[4].id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(events[3].event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_timestamps_out_of_order(self):
        self.login_as(user=self.user)

        cur_event = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.two_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )
        next_event = self.store_event(
            data={
                'event_id': 'c' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )
        prev_event = self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.three_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )

        group = Group.objects.first()

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': cur_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['nextEventID'] == six.text_type(next_event.event_id)
        assert response.data['previousEventID'] == six.text_type(prev_event.event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': prev_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(prev_event.id)
        assert response.data['nextEventID'] == six.text_type(cur_event.event_id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': next_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(next_event.id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(cur_event.event_id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_user_report(self):
        self.login_as(user=self.user)

        cur_event = self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.min_ago,
            },
            project_id=self.project.id
        )

        group = Group.objects.first()

        user_report = UserReport.objects.create(
            event_id=cur_event.event_id,
            project=group.project,
            email='foo@example.com',
            name='Jane Doe',
            comments='Hello world!',
        )

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': cur_event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['userReport']['id'] == six.text_type(user_report.id)

    def test_event_ordering(self):
        # Test that a real "prev" event that happened at an earlier time is not
        # masked by multiple subsequent events in the same second.
        self.login_as(user=self.user)

        before = self.store_event(
            data={
                'event_id': 'a' * 32,
                'timestamp': self.two_min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )

        event = self.store_event(
            data={
                'event_id': 'b' * 32,
                'timestamp': self.min_ago,
                'fingerprint': ['group-1'],
            },
            project_id=self.project.id
        )

        # Masking events: same time as event, but higher ids
        for eid in 'cdef':
            self.store_event(
                data={
                    'event_id': eid * 32,
                    'timestamp': self.min_ago,
                    'fingerprint': ['group-1'],
                },
                project_id=self.project.id
            )

        url = reverse(
            'sentry-api-0-event-details', kwargs={
                'event_id': event.id,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(event.id)
        assert response.data['previousEventID'] == six.text_type(before.event_id)
