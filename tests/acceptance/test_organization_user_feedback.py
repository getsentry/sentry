from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class OrganizationUserFeedbackTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationUserFeedbackTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(
            organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.login_as(self.user)
        self.path = u'/organizations/{}/user-feedback/'.format(self.org.slug)
        self.project.update(first_event=timezone.now())

    def test(self):
        with self.feature('organizations:sentry10'):
            self.create_group(
                project=self.project,
                message='Foo bar',
            )
            self.create_userreport(group=self.group, project=self.project, event=self.event)
            self.browser.get(self.path)
            # self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('organization user feedback')

    def test_empty(self):
        with self.feature('organizations:sentry10'):
            self.browser.get(self.path)
            # self.browser.wait_until_not('.loading')
            self.browser.snapshot('organization user feedback - empty')

    def test_no_access(self):
        self.browser.get(self.path)
        self.browser.snapshot('organization user feedback - no access')
