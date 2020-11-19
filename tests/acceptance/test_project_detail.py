from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:project-detail"


class ProjectDetailTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectDetailTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)

        self.team1 = self.create_team(organization=self.org, name="Mariachi Band 1")
        self.team2 = self.create_team(organization=self.org, name="Mariachi Band 2")
        self.team3 = self.create_team(organization=self.org, name="Mariachi Band 3")
        self.team4 = self.create_team(organization=self.org, name="Mariachi Band 4")
        self.team5 = self.create_team(organization=self.org, name="Mariachi Band 5")
        self.team6 = self.create_team(organization=self.org, name="Mariachi Band 6")

        self.project = self.create_project(
            organization=self.org,
            teams=[self.team1, self.team2, self.team3, self.team4, self.team5, self.team6],
            name="Bengal",
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team1])

        self.login_as(self.user)
        self.path = u"/organizations/{}/projects/{}/".format(self.org.slug, self.project.slug)

    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("project detail")

    def test_no_feature(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("project detail no feature")
