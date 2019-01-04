from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ProjectUserFeedback(AcceptanceTestCase):
    def setUp(self):
        super(ProjectUserFeedback, self).setUp()
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

        # self.group = self.create_group(project=self.project)
        # self.event = self.create_event(
        #     group=self.group,
        #     message="message!",
        #     platform="python",
        # )
        # self.create_userreport(group=self.group, project=self.project, event=self.event)

        self.path = u'/{}/{}/user-feedback/'.format(
            self.org.slug,
            self.project.slug,
        )

    def test(self):
        self.browser.get(self.path)
        # self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project user feedback')
