from __future__ import absolute_import

import pytz

from datetime import datetime, timedelta
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from mock import patch


event_time = (datetime.utcnow() - timedelta(days=3)).replace(tzinfo=pytz.utc)


class OrganizationGroupIndexTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationGroupIndexTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band',
            members=[self.user])
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.other_project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Sumatra',
        )
        self.login_as(self.user)
        self.path = u'/organizations/{}/issues/'.format(self.org.slug)

    def test_with_onboarding(self):
        self.project.update(first_event=None)
        self.browser.get(self.path)
        self.wait_until_loaded()
        self.browser.wait_until_test_id('awaiting-events')
        self.browser.snapshot('organization issues onboarding')

    def test_with_no_results(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.wait_until_loaded()
        self.browser.wait_until_test_id('empty-state')
        self.browser.snapshot('organization issues no results')

    @patch('django.utils.timezone.now')
    def test_with_results(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'oh no',
                'timestamp': event_time.isoformat()[:19],
                'fingerprint': ['group-1']
            },
            project_id=self.project.id
        )
        self.store_event(
            data={
                'event_id': 'b' * 32,
                'message': 'oh snap',
                'timestamp': event_time.isoformat()[:19],
                'fingerprint': ['group-2']
            },
            project_id=self.project.id
        )
        self.browser.get(self.path)
        self.wait_until_loaded()
        self.browser.wait_until('.event-issue-header')
        self.browser.snapshot('organization issues with issues')

        groups = self.browser.find_elements_by_class_name('event-issue-header')
        assert len(groups) == 2
        assert 'oh snap' in groups[0].text
        assert 'oh no' in groups[1].text

    def wait_until_loaded(self):
        self.browser.wait_until_not('.loading')
