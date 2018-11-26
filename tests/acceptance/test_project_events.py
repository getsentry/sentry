from __future__ import absolute_import

import os

import json
import uuid
from datetime import datetime
from django.utils import timezone

from sentry.constants import DATA_ROOT
from sentry.event_manager import EventManager
from sentry.testutils import AcceptanceTestCase


class ProjectEventsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectEventsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.environment = self.create_environment(name="staging")
        self.login_as(self.user)
        self.path = u'/{}/{}/events/'.format(self.org.slug, self.project.slug)
        self.clock_seq = 0

    def next_uuid(self):
        self.clock_seq += 1
        return uuid.uuid1(node=4711, clock_seq=self.clock_seq).hex

    def create_sample_event(self, platform):
        json_path = os.path.join(DATA_ROOT, 'samples', '%s.json' % (platform.encode('utf-8'), ))
        with open(json_path) as fp:
            data = json.loads(fp.read())

        data.update(
            platform=platform,
            event_id=self.next_uuid(),
        )

        manager = EventManager(data)
        manager.normalize()
        event = manager.save(self.project.id, raw=True)

        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )

        return event

    def test_with_events(self):
        self.project.update(first_event=timezone.now())

        self.create_sample_event(platform='cocoa')
        self.create_sample_event(platform='cordova')
        self.create_sample_event(platform='aspnetcore')
        self.create_sample_event(platform='unity')
        self.create_sample_event(platform='elixir')
        self.create_sample_event(platform='empty-exception')
        self.create_sample_event(platform='java')
        self.create_sample_event(platform='javascript')
        self.create_sample_event(platform='native')
        self.create_sample_event(platform='php')
        self.create_sample_event(platform='pii')
        self.create_sample_event(platform='python')
        self.create_sample_event(platform='react-native')
        self.create_sample_event(platform='ruby')

        self.browser.get(self.path)
        self.browser.wait_until('.event-list')
        self.browser.wait_until('.table')
        self.browser.snapshot('project events with events')

    def test_with_no_events(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until('.event-list')
        self.browser.wait_until('.ref-empty-state')
        self.browser.snapshot('project events without events')
