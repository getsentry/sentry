from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.models import OrganizationOnboardingTask, OnboardingTask, OnboardingTaskStatus


class ProjectUserFeedbackTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectUserFeedbackTest, self).setUp()
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
        self.path = u'/{}/{}/user-feedback/'.format(
            self.org.slug, self.project.slug)
        self.project.update(first_event=timezone.now())

    def test(self):
        self.create_group(
            project=self.project,
            message='Foo bar',
        )
        OrganizationOnboardingTask.objects.create_or_update(
            organization_id=self.project.organization_id,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        self.create_userreport(group=self.group, project=self.project, event=self.event)
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('project user feedback')

    def test_empty(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('project user feedback - empty')
