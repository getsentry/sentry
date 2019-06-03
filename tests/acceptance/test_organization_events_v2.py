from __future__ import absolute_import

from datetime import datetime, timedelta
from django.utils import timezone
import pytz
from mock import patch
from sentry.testutils import AcceptanceTestCase, SnubaTestCase


FEATURE_NAME = 'organizations:events-v2'


class OrganizationEventsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=None, name='Rowdy Tiger')
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        self.login_as(self.user)
        self.path = u'/organizations/{}/events/'.format(self.org.slug)

    def test_all_events_empty(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('events-v2 - all events empty state')

    @patch('django.utils.timezone.now')
    def test_all_events(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'oh no',
                'timestamp': min_ago,
                'fingerprint': ['group-1']
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('events-v2 - all events')

    @patch('django.utils.timezone.now')
    def test_errors(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'oh no',
                'timestamp': min_ago,
                'fingerprint': ['group-1']
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'message': 'oh no',
                'timestamp': min_ago,
                'fingerprint': ['group-1']
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path + '?view=errors')
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('events-v2 - errors')
