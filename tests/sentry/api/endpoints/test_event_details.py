from __future__ import absolute_import

import six

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import UserReport
from sentry.testutils import APITestCase


class EventDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        prev_event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 24),
        )
        cur_event = self.create_event(
            event_id='b',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 25),
        )
        next_event = self.create_event(
            event_id='c',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 26),
        )

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': cur_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['nextEventID'] == six.text_type(next_event.id)
        assert response.data['previousEventID'] == six.text_type(prev_event.id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': prev_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(prev_event.id)
        assert response.data['nextEventID'] == six.text_type(cur_event.id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': next_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(next_event.id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(cur_event.id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_identical_datetime(self):
        self.login_as(user=self.user)

        group = self.create_group()
        created = datetime(2013, 8, 13, 3, 8, 24)
        events = []
        events.append(self.create_event(
            event_id='a',
            group=group,
            datetime=created,
        ))
        events.append(self.create_event(
            event_id='b',
            group=group,
            datetime=created,
        ))
        events.append(self.create_event(
            event_id='c',
            group=group,
            datetime=created,
        ))
        events.append(self.create_event(
            event_id='d',
            group=group,
            datetime=created,
        ))
        events.append(self.create_event(
            event_id='e',
            group=group,
            datetime=created,
        ))

        # First event, no prev
        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': events[0].id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[0].id)
        assert response.data['nextEventID'] == six.text_type(events[1].id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': events[1].id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[1].id)
        assert response.data['nextEventID'] == six.text_type(events[2].id)
        assert response.data['previousEventID'] == six.text_type(events[0].id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': events[2].id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[2].id)
        assert response.data['nextEventID'] == six.text_type(events[3].id)
        assert response.data['previousEventID'] == six.text_type(events[1].id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Middle event, has prev and next
        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': events[3].id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[3].id)
        assert response.data['nextEventID'] == six.text_type(events[4].id)
        assert response.data['previousEventID'] == six.text_type(events[2].id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        # Last event, no next
        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': events[4].id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(events[4].id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(events[3].id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_timestamps_out_of_order(self):
        self.login_as(user=self.user)

        group = self.create_group()
        cur_event = self.create_event(
            event_id='b',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 25),
        )
        next_event = self.create_event(
            event_id='c',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 26),
        )
        prev_event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 24),
        )

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': cur_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['nextEventID'] == six.text_type(next_event.id)
        assert response.data['previousEventID'] == six.text_type(prev_event.id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': prev_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(prev_event.id)
        assert response.data['nextEventID'] == six.text_type(cur_event.id)
        assert response.data['previousEventID'] is None
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': next_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(next_event.id)
        assert response.data['nextEventID'] is None
        assert response.data['previousEventID'] == six.text_type(cur_event.id)
        assert response.data['groupID'] == six.text_type(group.id)
        assert not response.data['userReport']

    def test_user_report(self):
        self.login_as(user=self.user)

        group = self.create_group()
        cur_event = self.create_event(
            event_id='a',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 24),
        )

        user_report = UserReport.objects.create(
            event_id=cur_event.event_id,
            project=group.project,
            email='foo@example.com',
            name='Jane Doe',
            comments='Hello world!',
        )

        url = reverse('sentry-api-0-event-details', kwargs={
            'event_id': cur_event.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(cur_event.id)
        assert response.data['userReport']['id'] == six.text_type(user_report.id)
