from __future__ import absolute_import

from django.utils import timezone

from sentry.models import Activity
from sentry.testutils import AcceptanceTestCase


class OrganizationActivityTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationActivityTest, self).setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = u"/organizations/{}/activity/".format(self.org.slug)
        self.project.update(first_event=timezone.now())

    def test(self):
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=Activity.NOTE,
            user=self.user,
            data={"text": "hello world"},
        )

        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator", timeout=100000)
        self.browser.wait_until('[data-test-id="activity-feed-list"]')
        self.browser.snapshot("organization activity feed")

    def test_empty(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("organization activity feed - empty")
