from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.utils.samples import create_sample_event


class ProjectIssuesGroupingTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectIssuesGroupingTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.org.flags.early_adopter = True
        self.org.save()
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

    def create_sample_event(self, platform):
        event = create_sample_event(
            project=self.project,
            platform=platform,
            event_id="d964fdbd649a4cf8bfc35d18082b6b0e",
            timestamp=1452683305,
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        return event

    # TODO(billy): skip until we enable for early adopters
    #  def test_issues_similar_issues_tab(self):
    #  event = self.create_sample_event(
    #  platform='python',
    #  )

    #  self.browser.get(
    #  '/{}/{}/issues/{}/similar/'.format(self.org.slug, self.project.slug, event.group.id)
    #  )
    #  self.browser.wait_until('.similar-list-container')
    #  self.browser.snapshot('issue details, similar issues tab')
